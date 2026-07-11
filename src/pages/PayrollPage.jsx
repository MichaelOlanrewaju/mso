import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useStaff, usePayroll, usePendingPayroll } from "../hooks/usePayroll"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira } from "../utils/format"
import { PrintHeader, PrintWatermark } from "../components/ui/PrintElements"
import ConfirmSubmitModal from "../components/ui/ConfirmSubmitModal"

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function normaliseMonth(raw) {
  if (!raw) return ""
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (!isNaN(d.getTime()))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  return s
}

function monthLabel(m) {
  const s = normaliseMonth(m)
  if (!s) return "—"
  const [y, mo] = s.split("-")
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString("en-NG", { month: "long", year: "numeric" })
}

const ROLE_LABELS = { owner:"Owner", gm:"General Manager", supervisor:"Supervisor", cashier:"Cashier", attendant:"Attendant" }
const PALETTE = ["#179DD0","#16A34A","#179DD0","#DC2626","#7C3AED","#0891B2","#059669"]
const avatarBg = n => PALETTE[(n||" ").charCodeAt(0) % PALETTE.length]
const ini = n => {
  const parts = (n||"").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  return parts.map(w => w[0]).slice(0, 2).join("").toUpperCase()
}

/* ─────────────────────────────────────────────────────────────
   SHARED COMPONENTS
───────────────────────────────────────────────────────────── */
function Avatar({ name, size = 40 }) {
  const bg = avatarBg(name)
  const letters = ini(name)
  return (
    <div className="flex flex-shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.34 }}>
      {letters}
    </div>
  )
}

function StatusChip({ status }) {
  const map = {
    PENDING:  { bg: "bg-amber-light",  text: "text-amber",    dot: "bg-amber",  label: "Pending Approval" },
    APPROVED: { bg: "bg-green-light",  text: "text-green",    dot: "bg-green",  label: "Approved" },
    REJECTED: { bg: "bg-red-light",    text: "text-red",      dot: "bg-red",    label: "Rejected" },
  }
  const m = map[status] || map.PENDING
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${m.bg} ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

function PayslipRow({ name, line, isLast }) {
  const bonus = Number(line.bonus) || 0
  const net = (Number(line.basicSalary)||0) + (Number(line.allowances)||0) + bonus - (Number(line.deductions)||0)
  return (
    <div className={`px-4 py-4 ${!isLast ? "border-b border-surface" : ""}`}>
      <div className="flex items-center gap-3">
        <Avatar name={name} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-[13.5px] font-bold text-ink">{name || "Unknown"}</div>
            {bonus > 0 && (
              <span className="flex-shrink-0 rounded-full bg-green-light px-1.5 py-0.5 text-[9px] font-bold text-green">
                +{naira(bonus)} bonus
              </span>
            )}
          </div>
          <div className="text-[10.5px] capitalize text-ink-4">{ROLE_LABELS[line.role] || line.role}</div>
        </div>
        <div className="text-right">
          <div className="mono text-[15px] font-extrabold text-navy">{naira(net)}</div>
          <div className="text-[9.5px] text-ink-4">net pay</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 divide-x divide-border rounded-[10px] border border-border">
        {[["Basic", line.basicSalary, "text-ink"], ["Allow.", line.allowances, "text-cyan-dark"], ["Deduct.", line.deductions, "text-red"]].map(([l, v, c]) => (
          <div key={l} className="px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.4px] text-ink-4">{l}</div>
            <div className={`mono text-[12.5px] font-bold ${c}`}>{naira(Number(v) || 0)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryStrip({ items }) {
  return (
    <div className="grid gap-px bg-border" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(([label, value, color]) => (
        <div key={label} className="flex flex-col bg-white px-3 py-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-ink-4">{label}</div>
          <div className={`mono text-[15px] font-extrabold ${color || "text-ink"}`}>{value}</div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   GM VIEW
   Rule: once submitted → read-only until owner acts
───────────────────────────────────────────────────────────── */
function GMView({ auth, navigate }) {
  const [searchParams] = useSearchParams()
  const [month, setMonth] = useState(searchParams.get("month") || currentMonth())
  const [tab, setTab] = useState("run")
  const { status: staffStatus, staff } = useStaff(auth.username)
  const { status: payStatus, lines, saving, savePayrollRun } = usePayroll(month, auth.username)
  const [draft, setDraft] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [remarks, setRemarks] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const seededKey = useRef("")
  usePageTitle("Payroll — MSO Limpid")

  // Seed draft ONLY for fresh months (no existing record)
  useEffect(() => {
    if (payStatus !== "ready" || staffStatus !== "ready") return
    const key = `${month}::${lines.length}`
    if (seededKey.current === key) return
    seededKey.current = key

    if (lines.length > 0) {
      setDraft(null) // existing record — don't seed
    } else {
      const d = {}
      staff.forEach(s => {
        if (s.name && s.name.trim()) {
          d[s.name] = { role: s.role, basicSalary: s.basicSalary || 0, allowances: 0, bonus: 0, deductions: 0 }
        }
      })
      setDraft(d)
    }
    setFeedback(null)
  }, [payStatus, staffStatus, month, lines.length, staff])

  const runStatus  = lines.length > 0 ? lines[0].status : null
  const isPending  = runStatus === "PENDING"
  const isApproved = runStatus === "APPROVED"
  const isRejected = runStatus === "REJECTED"
  const hasRecord  = lines.length > 0

  // For rejected: seed editable draft from submitted lines
  const activeDraft = useMemo(() => {
    if (isRejected && !draft) {
      const d = {}
      lines.forEach(l => { d[l.staffName] = { role: l.role, basicSalary: l.basicSalary, allowances: l.allowances, bonus: l.bonus, deductions: l.deductions } })
      return d
    }
    return draft || {}
  }, [isRejected, draft, lines])

  const draftEntries = Object.entries(activeDraft)

  const draftTotals = useMemo(() => {
    const vals = Object.values(activeDraft)
    const b = vals.reduce((s, l) => s + (Number(l.basicSalary) || 0), 0)
    const a = vals.reduce((s, l) => s + (Number(l.allowances) || 0), 0)
    const bo = vals.reduce((s, l) => s + (Number(l.bonus) || 0), 0)
    const d = vals.reduce((s, l) => s + (Number(l.deductions) || 0), 0)
    return { b, a, bo, d, net: b + a + bo - d, count: vals.length }
  }, [activeDraft])

  const recordTotals = useMemo(() => ({
    net:   lines.reduce((s, l) => s + (l.netPay || 0), 0),
    basic: lines.reduce((s, l) => s + (l.basicSalary || 0), 0),
    allow: lines.reduce((s, l) => s + (l.allowances || 0), 0),
    bonus: lines.reduce((s, l) => s + (l.bonus || 0), 0),
    count: lines.length,
  }), [lines])

  const doSubmit = async () => {
    setConfirmOpen(false)
    setFeedback(null)
    const entries = isRejected ? Object.entries(activeDraft) : draftEntries
    const payLines = entries.map(([staffName, l]) => ({
      staffName, role: l.role,
      basicSalary: Number(l.basicSalary) || 0,
      allowances:  Number(l.allowances) || 0,
      bonus:       Number(l.bonus) || 0,
      deductions:  Number(l.deductions) || 0,
    }))
    const res = await savePayrollRun({ month, username: auth.username, lines: payLines, remarks })
    if (res.ok) {
      setFeedback({ ok: true, text: `${monthLabel(month)} payroll submitted for owner approval.` })
      seededKey.current = "" // reset so it reloads as a record
    } else {
      setFeedback({ ok: false, text: res.error || "Save failed — try again." })
    }
  }

  const handleSubmit = () => {
    setFeedback(null)
    const entries = isRejected ? Object.entries(activeDraft) : draftEntries
    if (entries.length === 0) {
      setFeedback({ ok: false, text: "No staff with names found. Go to Staff Roster and make sure names are filled in." })
      return
    }
    setConfirmOpen(true)
  }

  const reviewRows = [
    { label: "Staff", value: String(draftTotals.count) },
    { label: "Total Basic Salary", value: naira(draftTotals.b) },
    { label: "Total Allowances", value: naira(draftTotals.a) },
    ...(draftTotals.bo > 0 ? [{ label: "Total Bonus", value: naira(draftTotals.bo) }] : []),
    { label: "Total Deductions", value: `−${naira(draftTotals.d)}` },
    { label: "Net Payroll", value: naira(draftTotals.net) },
    ...(remarks.trim() ? [{ label: "Remarks", value: remarks.trim() }] : []),
  ]
  const reviewWarnings = []
  if (draftEntries.some(([, l]) => !Number(l.basicSalary))) {
    reviewWarnings.push("At least one staff member has no Basic Salary entered — double-check before submitting.")
  }
  if (!remarks.trim()) {
    reviewWarnings.push("No remarks added — if anything's unusual this month (a bonus, a deduction reason), the owner won't see context unless you add it.")
  }

  const loading = payStatus === "loading" || staffStatus === "loading"

  return (
    <div className="min-h-screen pb-20" style={{ background: "#F2F3F7" }}>
      <SafeAreaDebug />

      {/* Dark sticky header */}
      <div className="sticky top-0 z-[200] print:hidden" style={{ background: "linear-gradient(135deg,#06091A,#0D1226)" }}>
        <div className="px-4 pb-0 pt-[max(var(--sat),52px)]">
          <div className="flex items-center gap-3 pb-3">
            <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/10 bg-white/5 text-white/60">
              <i className="bi bi-arrow-left" />
            </button>
            <div className="flex-1">
              <div className="text-[17px] font-extrabold tracking-[-0.02em] text-white">Payroll</div>
              <div className="text-[10px] text-white/40">MSO Limpid Co. Ltd</div>
            </div>
            <button type="button" onClick={() => navigate("/add-staff-mso")}
              className="flex h-9 items-center gap-1.5 rounded-[9px] border border-white/10 bg-white/10 px-3 text-[11.5px] font-bold text-white">
              <i className="bi bi-person-plus" /> Staff
            </button>
          </div>
        </div>
        <div className="flex border-t border-white/10">
          {[["run", "Monthly Run"], ["roster", "Staff Roster"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`flex-1 py-3 text-[12.5px] font-bold transition-colors ${tab === k ? "border-b-2 border-cyan text-white" : "text-white/40"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5">
        <PrintWatermark />
        <PrintHeader title="Payroll — Monthly Run" subtitle={monthLabel(month)} />

        {/* ── MONTHLY RUN TAB ── */}
        {tab === "run" && (
          <>
            {/* Month + status row */}
            <div className="mb-4 flex items-center justify-between rounded-[14px] bg-white px-4 py-3.5 shadow-sm">
              <div>
                <div className="mb-0.5 text-[9.5px] font-bold uppercase tracking-[0.8px] text-ink-4">Pay Period</div>
                <input type="month" value={month} max={currentMonth()}
                  onChange={e => { if (e.target.value) { setMonth(e.target.value); seededKey.current = ""; setFeedback(null) } }}
                  className="bg-transparent text-[18px] font-extrabold text-ink outline-none [color-scheme:light]" />
              </div>
              {runStatus && <StatusChip status={runStatus} />}
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`mb-4 flex items-start gap-2.5 rounded-[12px] border px-4 py-3.5 text-[13px] font-semibold ${
                feedback.ok ? "border-green/20 bg-green-light text-green" : "border-red/20 bg-red-light text-red"}`}>
                <i className={`bi mt-0.5 flex-shrink-0 text-[15px] ${feedback.ok ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />
                <div className="flex-1 leading-snug">{feedback.text}</div>
                <button type="button" onClick={() => setFeedback(null)}>
                  <i className="bi bi-x-lg text-[12px] opacity-40" />
                </button>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <span className="h-8 w-8 animate-spin-fast rounded-full border-[3px] border-cyan/20 border-t-cyan" />
                <div className="text-[12.5px] text-ink-4">Loading payroll…</div>
              </div>
            )}

            {/* ══ RECORD EXISTS (pending or approved) — READ ONLY ══ */}
            {!loading && hasRecord && !isRejected && (
              <>
                {isPending && (
                  <div className="mb-4 overflow-hidden rounded-[16px] border border-amber/20 bg-white shadow-sm">
                    <div className="flex items-center gap-3 bg-amber-light px-4 py-4">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber text-white">
                        <i className="bi bi-hourglass-split text-[17px]" />
                      </div>
                      <div>
                        <div className="text-[14px] font-extrabold text-amber">Submitted — Awaiting Approval</div>
                        <div className="text-[11.5px] text-amber/80">
                          {monthLabel(month)} payroll is with the owner. You cannot make changes until they respond.
                        </div>
                      </div>
                    </div>
                    <SummaryStrip items={[
                      ["Staff", recordTotals.count, "text-ink"],
                      ["Basic", naira(recordTotals.basic), "text-ink"],
                      ["Allow.", naira(recordTotals.allow), "text-cyan-dark"],
                      ["Net Pay", naira(recordTotals.net), "text-navy"],
                    ]} />
                  </div>
                )}

                {isApproved && (
                  <div className="mb-4 overflow-hidden rounded-[16px] bg-white shadow-sm">
                    <div className="flex items-center gap-3 bg-green-light px-4 py-4">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-green text-white">
                        <i className="bi bi-check2-all text-[20px]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-extrabold text-green">Payroll Approved ✓</div>
                        <div className="text-[11.5px] text-green/70">
                          Approved by {lines[0]?.approvedBy || "owner"} · {monthLabel(month)}
                        </div>
                      </div>
                      <button type="button" onClick={() => window.print()}
                        className="flex h-9 items-center gap-1.5 rounded-[9px] border border-green/30 bg-white px-3 text-[11.5px] font-bold text-green print:hidden">
                        <i className="bi bi-printer" /> Print
                      </button>
                    </div>
                    <SummaryStrip items={[
                      ["Staff", recordTotals.count, "text-ink"],
                      ["Basic", naira(recordTotals.basic), "text-ink"],
                      ["Allow.", naira(recordTotals.allow), "text-cyan-dark"],
                      ...(recordTotals.bonus > 0 ? [["Bonus", naira(recordTotals.bonus), "text-green"]] : []),
                      ["Net Pay", naira(recordTotals.net), "text-navy"],
                    ]} />
                  </div>
                )}

                {lines[0]?.remarks && (
                  <div className="mb-5 rounded-[14px] border border-amber/20 bg-amber-light px-4 py-3.5">
                    <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.7px] text-amber">General Remarks</div>
                    <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">{lines[0].remarks}</div>
                  </div>
                )}

                {/* Full breakdown */}
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1px] text-ink-4">Payroll Breakdown</div>
                <div className="overflow-hidden rounded-[16px] bg-white shadow-sm">
                  {lines.map((l, idx) => (
                    <PayslipRow key={l.staffName || idx} name={l.staffName}
                      line={{ role: l.role, basicSalary: l.basicSalary, allowances: l.allowances, bonus: l.bonus, deductions: l.deductions }}
                      isLast={idx === lines.length - 1} />
                  ))}
                  <div className="grid grid-cols-4 border-t-2 border-navy/10 bg-navy/5 px-4 py-3">
                    {[["Basic", naira(recordTotals.basic), "text-ink"], ["Allow.+Bonus", naira(recordTotals.allow + recordTotals.bonus), "text-cyan-dark"], ["Deduct.", "₦0", "text-red"], ["Net", naira(recordTotals.net), "text-navy font-extrabold"]].map(([l, v, c]) => (
                      <div key={l} className={l === "Net" ? "text-right" : ""}>
                        <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-ink-4">{l}</div>
                        <div className={`mono text-[12.5px] font-bold ${c}`}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ══ PREPARE SCREEN (no record or rejected) ══ */}
            {!loading && (!hasRecord || isRejected) && (
              <>
                {isRejected && (
                  <div className="mb-4 flex items-center gap-3 rounded-[14px] border border-red/20 bg-red-light px-4 py-4">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-red text-white">
                      <i className="bi bi-x-circle text-[18px]" />
                    </div>
                    <div>
                      <div className="text-[14px] font-extrabold text-red">Payroll Rejected</div>
                      <div className="text-[11.5px] text-red/80">Edit the figures below and resubmit.</div>
                    </div>
                  </div>
                )}

                {draftEntries.length === 0 && (
                  <div className="flex flex-col items-center gap-3 rounded-[16px] bg-white px-6 py-16 text-center shadow-sm">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
                      <i className="bi bi-people text-[28px] text-ink-4" />
                    </div>
                    <div className="text-[14.5px] font-bold text-ink">No staff on the roster</div>
                    <div className="max-w-[240px] text-[12.5px] text-ink-4">
                      Add staff members with their names and salaries first.
                    </div>
                    <button type="button" onClick={() => setTab("roster")}
                      className="mt-1 flex items-center gap-2 rounded-[10px] bg-navy px-5 py-2.5 text-[12.5px] font-bold text-white">
                      <i className="bi bi-person-plus" /> Go to Staff Roster
                    </button>
                  </div>
                )}

                {draftEntries.length > 0 && (
                  <>
                    {/* Live totals */}
                    <div className="mb-4 overflow-hidden rounded-[14px] bg-white shadow-sm">
                      <div className="px-4 py-3">
                        <div className="text-[11px] font-bold text-ink-4">{monthLabel(month)}</div>
                        <div className="mono text-[26px] font-extrabold text-navy">{naira(draftTotals.net)}</div>
                        <div className="text-[11px] text-ink-4">{draftTotals.count} staff · total net payroll</div>
                      </div>
                      <div className={`grid gap-px bg-border border-t border-border ${draftTotals.bo > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
                        {[["Basic", naira(draftTotals.b), "text-ink"], ["Allow.", naira(draftTotals.a), "text-cyan-dark"], ...(draftTotals.bo > 0 ? [["Bonus", naira(draftTotals.bo), "text-green"]] : []), ["Deductions", naira(draftTotals.d), "text-red"]].map(([l, v, c]) => (
                          <div key={l} className="bg-white px-3 py-2.5">
                            <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-ink-4">{l}</div>
                            <div className={`mono text-[13px] font-bold ${c}`}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Staff rows */}
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1px] text-ink-4">Staff — tap to edit</div>
                    <div className="mb-5 overflow-hidden rounded-[16px] bg-white shadow-sm">
                      {draftEntries.map(([name, line], idx) => {
                        const net = (Number(line.basicSalary)||0)+(Number(line.allowances)||0)+(Number(line.bonus)||0)-(Number(line.deductions)||0)
                        return (
                          <EditableRow key={name} name={name} line={line} net={net}
                            isLast={idx === draftEntries.length - 1}
                            onChange={(f, v) => setDraft(prev => ({ ...prev, [name]: { ...prev[name], [f]: v } }))} />
                        )
                      })}
                    </div>

                    {/* General Remarks — the one place a whole month's story lives */}
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1px] text-ink-4">General Remarks</div>
                    <div className="mb-5 overflow-hidden rounded-[16px] bg-white p-4 shadow-sm">
                      <textarea
                        rows={3} value={remarks} onChange={e => setRemarks(e.target.value)}
                        placeholder="e.g. Two staff on annual leave got a holiday bonus this month. One deduction is a salary advance repayment."
                        className="w-full resize-none rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-3 text-[13px] text-ink outline-none focus:border-cyan focus:bg-white"
                      />
                      <div className="mt-2 text-[11px] text-ink-4">Anything the owner should know before approving — bonuses, unusual deductions, anything worth flagging.</div>
                    </div>

                    <button type="button" onClick={handleSubmit} disabled={saving}
                      className="flex w-full items-center justify-center gap-2.5 rounded-[14px] py-4 text-[14.5px] font-bold text-white shadow-lift disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg,#130656,#1a0875)" }}>
                      {saving
                        ? <><span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> Saving…</>
                        : isRejected
                          ? <><i className="bi bi-arrow-clockwise" /> Revise &amp; Resubmit</>
                          : <><i className="bi bi-send-fill text-[13px]" /> Submit for Owner Approval</>
                      }
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── STAFF ROSTER TAB ── */}
        {tab === "roster" && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[1px] text-ink-4">{staff.length} staff members</div>
              <button type="button" onClick={() => navigate("/add-staff-mso")}
                className="flex h-8 items-center gap-1.5 rounded-[8px] bg-navy px-3 text-[11.5px] font-bold text-white">
                <i className="bi bi-person-plus" /> Add Staff
              </button>
            </div>
            {staffStatus === "loading" && <div className="flex justify-center py-10"><span className="h-5 w-5 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" /></div>}
            {staffStatus === "ready" && staff.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-[16px] bg-white py-14 text-center shadow-sm">
                <i className="bi bi-person-plus text-4xl text-ink-4" />
                <div className="text-[14px] font-bold text-ink">No staff yet</div>
                <button type="button" onClick={() => navigate("/add-staff-mso")}
                  className="mt-2 rounded-[10px] bg-navy px-5 py-2.5 text-[12.5px] font-bold text-white">
                  Add First Staff Member
                </button>
              </div>
            )}
            {staffStatus === "ready" && staff.length > 0 && (
              <div className="overflow-hidden rounded-[16px] bg-white shadow-sm">
                {staff.map((s, idx) => (
                  <div key={s.username} className={`flex items-center gap-3 px-4 py-3.5 ${idx < staff.length - 1 ? "border-b border-surface" : ""}`}>
                    <Avatar name={s.name} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-bold text-ink">{s.name || <span className="italic text-ink-4">No name — tap to edit</span>}</div>
                      <div className="text-[10.5px] capitalize text-ink-4">{ROLE_LABELS[s.role] || s.role}{s.email ? ` · ${s.email}` : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="mono text-[13.5px] font-bold text-ink">{naira(s.basicSalary)}</div>
                      <div className="text-[9.5px] text-ink-4">basic/mo</div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t-2 border-navy/10 bg-navy/5 px-4 py-3">
                  <div className="text-[11px] font-bold text-ink">Total monthly basic</div>
                  <div className="mono text-[14.5px] font-extrabold text-navy">
                    {naira(staff.reduce((a, s) => a + (s.basicSalary || 0), 0))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmSubmitModal
        open={confirmOpen}
        title="Confirm Payroll Submission"
        subtitle={`${monthLabel(month)} — once submitted, this locks until the owner approves or rejects it`}
        rows={reviewRows}
        warnings={reviewWarnings}
        confirming={saving}
        onConfirm={doSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

/* Editable row as a separate component to avoid state issues */
function EditableRow({ name, line, net, isLast, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={!isLast ? "border-b border-surface" : ""}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-4 py-4 text-left">
        <Avatar name={name} size={42} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold text-ink">{name}</div>
          <div className="text-[10.5px] capitalize text-ink-4">{ROLE_LABELS[line.role] || line.role}</div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <div className={`mono text-[15px] font-extrabold ${net < 0 ? "text-red" : "text-navy"}`}>{naira(net)}</div>
            <div className="text-[9.5px] text-cyan-dark">{open ? "close" : "tap to edit"}</div>
          </div>
          <i className={`bi bi-chevron-down text-[12px] text-ink-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-surface bg-[#F8F9FC] px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-3">
            {[["basicSalary", "Basic (₦)", "focus:border-navy"], ["allowances", "Allow. (₦)", "focus:border-cyan"], ["bonus", "Bonus (₦)", "focus:border-green"], ["deductions", "Deduct. (₦)", "focus:border-red/60"]].map(([f, l, fc]) => (
              <label key={f}>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.4px] text-ink-4">{l}</span>
                <input type="number" inputMode="decimal" min="0" step="1"
                  value={line[f]}
                  onChange={e => onChange(f, e.target.value)}
                  className={`mono w-full rounded-[9px] border-2 border-border bg-white px-3 py-2.5 text-[14px] font-bold text-ink outline-none ${fc}`} />
              </label>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-[8px] bg-surface px-3 py-2 text-[11px]">
            <span className="font-bold text-ink">{naira(Number(line.basicSalary) || 0)}</span>
            <span className="text-ink-4">basic</span>
            <span className="font-bold text-cyan-dark">+ {naira(Number(line.allowances) || 0)}</span>
            {Number(line.bonus) > 0 && <span className="font-bold text-green">+ {naira(Number(line.bonus) || 0)} bonus</span>}
            <span className="font-bold text-red">− {naira(Number(line.deductions) || 0)}</span>
            <span className="ml-auto font-extrabold text-navy">= {naira(net)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   OWNER VIEW
───────────────────────────────────────────────────────────── */
function OwnerView({ auth, navigate }) {
  const [searchParams] = useSearchParams()
  const [month, setMonth] = useState(searchParams.get("month") || currentMonth())
  const { status: payStatus, lines, approvePayrollRun } = usePayroll(month, auth.username)
  const { pending } = usePendingPayroll(auth.username)
  const [feedback, setFeedback] = useState(null)
  const [processing, setProcessing] = useState(null) // "approve" | "reject" | null
  const autoPicked = useRef(false)
  usePageTitle("Payroll Approval — MSO Limpid")

  useEffect(() => {
    if (autoPicked.current || searchParams.get("month")) return
    if (pending && pending.length > 0) {
      const m = normaliseMonth(pending[0].month)
      if (m) { setMonth(m); autoPicked.current = true }
    }
  }, [pending, searchParams])

  const runStatus  = lines.length > 0 ? lines[0].status : null
  const isPending  = runStatus === "PENDING"
  const isApproved = runStatus === "APPROVED"
  const isRejected = runStatus === "REJECTED"

  const totals = useMemo(() => ({
    net:   lines.reduce((s, l) => s + (l.netPay || 0), 0),
    basic: lines.reduce((s, l) => s + (l.basicSalary || 0), 0),
    allow: lines.reduce((s, l) => s + (l.allowances || 0), 0),
    bonus: lines.reduce((s, l) => s + (l.bonus || 0), 0),
    deduct:lines.reduce((s, l) => s + (l.deductions || 0), 0),
    count: lines.length,
  }), [lines])

  const handleDecision = async decision => {
    setProcessing(decision)
    setFeedback(null)
    const res = await approvePayrollRun({ month, decision, username: auth.username })
    setFeedback({
      ok: res.ok,
      text: res.ok
        ? decision === "approve"
          ? `${monthLabel(month)} payroll approved. ✓`
          : "Payroll rejected — GM has been notified to revise."
        : res.error || "Couldn't process."
    })
    setProcessing(null)
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: "#F2F3F7" }}>
      <SafeAreaDebug />

      {/* Header */}
      <div className="sticky top-0 z-[200] print:hidden" style={{ background: "linear-gradient(135deg,#06091A,#0D1226)" }}>
        <div className="px-4 pb-4 pt-[max(var(--sat),52px)]">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/10 bg-white/5 text-white/60">
              <i className="bi bi-arrow-left" />
            </button>
            <div className="flex-1">
              <div className="text-[17px] font-extrabold tracking-[-0.02em] text-white">Payroll Approval</div>
              <div className="text-[10px] text-white/40">Review &amp; approve monthly payroll</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-5">
        <PrintWatermark />
        <PrintHeader title="Payroll Approval" subtitle={monthLabel(month)} />

        {/* Pending months — shown as prominent cards if any exist */}
        {pending && pending.length > 0 && (
          <div className="mb-5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[1px] text-ink-4">Awaiting Your Approval</div>
            <div className="flex flex-col gap-2">
              {pending.map(p => {
                const pm = normaliseMonth(p.month)
                const isActive = month === pm
                return (
                  <button key={pm} type="button"
                    onClick={() => { setMonth(pm); setFeedback(null) }}
                    className={`flex items-center gap-3 rounded-[14px] border px-4 py-3.5 text-left transition-all ${
                      isActive
                        ? "border-amber bg-amber text-white shadow-lift"
                        : "border-amber/25 bg-amber-light text-amber hover:border-amber/60"}`}>
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${isActive ? "bg-white/20" : "bg-amber/15"}`}>
                      <i className="bi bi-wallet2 text-[16px]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13.5px] font-extrabold">{monthLabel(pm)}</div>
                      <div className={`text-[11px] ${isActive ? "text-white/70" : "text-amber/70"}`}>
                        {p.staffCount} staff · ₦{Math.round(p.totalNet).toLocaleString("en-NG")} net total
                      </div>
                    </div>
                    <i className={`bi bi-chevron-right text-[12px] ${isActive ? "text-white/60" : "text-amber/60"}`} />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Month picker for browsing history */}
        <div className="mb-4 flex items-center justify-between rounded-[14px] bg-white px-4 py-3.5 shadow-sm">
          <div>
            <div className="mb-0.5 text-[9.5px] font-bold uppercase tracking-[0.8px] text-ink-4">Viewing Period</div>
            <input type="month" value={month} max={currentMonth()}
              onChange={e => { if (e.target.value) { setMonth(e.target.value); setFeedback(null) } }}
              className="bg-transparent text-[18px] font-extrabold text-ink outline-none [color-scheme:light]" />
          </div>
          {runStatus && <StatusChip status={runStatus} />}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`mb-4 flex items-start gap-2.5 rounded-[12px] border px-4 py-3.5 text-[13px] font-semibold ${
            feedback.ok ? "border-green/20 bg-green-light text-green" : "border-red/20 bg-red-light text-red"}`}>
            <i className={`bi mt-0.5 flex-shrink-0 text-[15px] ${feedback.ok ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />
            <div className="flex-1 leading-snug">{feedback.text}</div>
            <button type="button" onClick={() => setFeedback(null)}>
              <i className="bi bi-x-lg text-[12px] opacity-40" />
            </button>
          </div>
        )}

        {payStatus === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <span className="h-8 w-8 animate-spin-fast rounded-full border-[3px] border-cyan/20 border-t-cyan" />
            <div className="text-[12.5px] text-ink-4">Loading payroll data…</div>
          </div>
        )}

        {/* Nothing submitted */}
        {payStatus === "ready" && lines.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-[16px] bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
              <i className="bi bi-inbox text-[28px] text-ink-4" />
            </div>
            <div className="text-[14.5px] font-bold text-ink">Nothing submitted yet</div>
            <div className="max-w-[240px] text-[12.5px] text-ink-4">
              {pending && pending.length > 0
                ? "Tap one of the cards above to view a pending payroll."
                : `The GM hasn't submitted payroll for ${monthLabel(month)} yet.`}
            </div>
          </div>
        )}

        {/* Payroll record */}
        {payStatus === "ready" && lines.length > 0 && (
          <>
            {/* Summary */}
            <div className="mb-5 overflow-hidden rounded-[16px] bg-white shadow-sm">
              <div className="px-4 py-4">
                <div className="text-[11px] font-bold text-ink-4">{monthLabel(month)}</div>
                <div className="mono text-[28px] font-extrabold text-navy">{naira(totals.net)}</div>
                <div className="text-[11.5px] text-ink-4">{totals.count} staff · total net payroll</div>
              </div>
              <div className={`grid gap-px border-t border-border bg-border ${totals.bonus > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
                {[["Basic", naira(totals.basic), "text-ink"], ["Allow.", naira(totals.allow), "text-cyan-dark"], ...(totals.bonus > 0 ? [["Bonus", naira(totals.bonus), "text-green"]] : []), ["Deductions", naira(totals.deduct), "text-red"]].map(([l, v, c]) => (
                  <div key={l} className="bg-white px-4 py-3">
                    <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-ink-4">{l}</div>
                    <div className={`mono text-[13.5px] font-bold ${c}`}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {lines[0]?.remarks && (
              <div className="mb-5 rounded-[14px] border border-amber/20 bg-amber-light px-4 py-3.5">
                <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.7px] text-amber">General Remarks from {lines[0]?.preparedBy || "GM"}</div>
                <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">{lines[0].remarks}</div>
              </div>
            )}

            {/* Individual breakdown */}
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[1px] text-ink-4">
              Individual Breakdown · {lines[0]?.preparedBy || "GM"}
            </div>
            <div className="mb-5 overflow-hidden rounded-[16px] bg-white shadow-sm">
              {lines.map((l, idx) => (
                <PayslipRow key={l.staffName || idx} name={l.staffName}
                  line={{ role: l.role, basicSalary: l.basicSalary, allowances: l.allowances, bonus: l.bonus, deductions: l.deductions }}
                  isLast={idx === lines.length - 1} />
              ))}
              <div className="flex items-center justify-between border-t-2 border-navy/10 bg-navy/5 px-4 py-3">
                <div className="text-[11.5px] font-bold text-ink">Total net payroll</div>
                <div className="mono text-[15px] font-extrabold text-navy">{naira(totals.net)}</div>
              </div>
            </div>

            {/* PENDING: Approve / Reject */}
            {isPending && (
              <>
                <div className="mb-3 rounded-[12px] border border-amber/20 bg-amber-light px-4 py-3 text-center text-[12.5px] font-semibold text-amber print:hidden">
                  ⚠️ Once approved this payroll is final and cannot be changed.
                </div>
                <div className="flex gap-3 print:hidden">
                  <button type="button" onClick={() => handleDecision("reject")} disabled={!!processing}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[14px] border-2 border-red/20 bg-white py-4 text-[14px] font-bold text-red shadow-sm disabled:opacity-40">
                    {processing === "reject"
                      ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-red/30 border-t-red" />
                      : <><i className="bi bi-x-lg" /> Reject</>
                    }
                  </button>
                  <button type="button" onClick={() => handleDecision("approve")} disabled={!!processing}
                    className="flex flex-[2] items-center justify-center gap-2 rounded-[14px] bg-green py-4 text-[14px] font-bold text-white shadow-lift disabled:opacity-40">
                    {processing === "approve"
                      ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" />
                      : <><i className="bi bi-check2-all text-[15px]" /> Approve Payroll</>
                    }
                  </button>
                </div>
              </>
            )}

            {/* APPROVED */}
            {isApproved && (
              <div className="flex items-center gap-3 rounded-[14px] bg-green-light px-4 py-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green text-white">
                  <i className="bi bi-check2-all text-[20px]" />
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-extrabold text-green">Payroll Approved</div>
                  <div className="text-[11.5px] text-green/70">
                    By {lines[0]?.approvedBy || "you"} · {monthLabel(month)}
                  </div>
                </div>
                <button type="button" onClick={() => window.print()}
                  className="flex h-9 items-center gap-1.5 rounded-[9px] border border-green/30 bg-white px-3 text-[11.5px] font-bold text-green print:hidden">
                  <i className="bi bi-printer" /> Print
                </button>
              </div>
            )}

            {/* REJECTED */}
            {isRejected && (
              <div className="flex items-center gap-3 rounded-[14px] border border-red/20 bg-red-light px-4 py-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red text-white">
                  <i className="bi bi-x-lg text-[20px]" />
                </div>
                <div>
                  <div className="text-[15px] font-extrabold text-red">Payroll Rejected</div>
                  <div className="text-[11.5px] text-red/70">Waiting for GM to revise and resubmit.</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   MAIN — route by role
───────────────────────────────────────────────────────────── */
export default function PayrollPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle("Payroll — MSO Limpid")

  const isGM    = auth.isGM
  const isOwner = auth.isOwner || auth.role === "owner" || auth.username === "owner"

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />
  if (isGM)    return <GMView auth={auth} navigate={navigate} />
  if (isOwner) return <OwnerView auth={auth} navigate={navigate} />

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-pagebg px-6 text-center">
      <i className="bi bi-lock text-3xl text-ink-4" />
      <div className="text-[14px] font-bold text-ink">Payroll is restricted</div>
      <div className="text-[12.5px] text-ink-4">Only the GM and Owner can access payroll.</div>
      <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
        className="mt-2 rounded-[9px] border border-border bg-white px-4 py-2 text-[12.5px] font-bold text-ink-2">
        Back to Dashboard
      </button>
    </div>
  )
}
