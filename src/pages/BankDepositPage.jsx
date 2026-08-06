import React, { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import Sidebar from "../components/layout/Sidebar"
import Topbar from "../components/layout/Topbar"
import BottomNav from "../components/layout/BottomNav"
import { useToast } from "../components/layout/ToastProvider"
import ProofPhotoViewer from "../components/cashup/ProofPhotoViewer"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { useBankDeposits, useBankDepositApprovals, canLogBankDeposit, canViewBankDeposits } from "../hooks/useBankDeposits"
import { getStation } from "../config/stations"
import { STATION_KEYS } from "../config/stations"
import { naira, initials, roleLabel } from "../utils/format"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function sanitiseNumeric(raw) {
  const cleaned = String(raw).replace(/[^\d.]/g, "")
  const parts = cleaned.split(".")
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join(".")}` : cleaned
}

const STATUS_STYLE = {
  PENDING:  { bg: "bg-amber-light", text: "text-amber", label: "Pending" },
  APPROVED: { bg: "bg-green-light", text: "text-green", label: "Approved" },
  REJECTED: { bg: "bg-red-light",   text: "text-red",   label: "Rejected" },
}

export default function BankDepositPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const toast = useToast()

  const [station, setStation] = useState(
    auth.station && auth.station !== "both" ? auth.station : "mso"
  )
  usePageTitle(`Bank Deposits — ${getStation(station).name}`)

  const {
    needsSetup, cashAtHand, totalContributed, totalDeposited, lastDepositDate, deposits, loading, submitting,
    submitDeposit, submitStartPoint,
    cashForDate, existingDepositForDate, loadingDateCash, loadCashForDate,
  } = useBankDeposits(station)

  const canReview = ["ceo", "owner", "gm"].includes(auth.role)
  const { pending, cashAtHandNow, loading: loadingPending, deciding, decide, remove } = useBankDepositApprovals(station, canReview ? auth.username : null)

  const [settingUp, setSettingUp] = useState(false)
  const [startDate, setStartDate] = useState(todayISO())
  const [startingBalance, setStartingBalance] = useState("")

  const [depositDate, setDepositDate] = useState(todayISO())
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [confirmDeleteRow, setConfirmDeleteRow] = useState(null)
  const inputRef = useRef(null)

  const canSubmit = canLogBankDeposit(auth.username, auth.role)
  const canView = canViewBankDeposits(auth.username, auth.role)

  useEffect(() => {
    if (canSubmit) loadCashForDate(depositDate)
  }, [depositDate, canSubmit, loadCashForDate])

  if (!auth.loading && !canView) {
    navigate(dashboardPathFor({ role: auth.role, station: auth.station }), { replace: true })
    return null
  }

  const handlePhoto = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) { toast.showToast("Enter an amount", "How much was deposited?", "err"); return }
    if (!photoFile) { toast.showToast("Add a photo", "A photo of the deposit slip is required.", "err"); return }
    const res = await submitDeposit({ date: depositDate, amount: amt, photoFile, notes })
    if (res.ok) {
      toast.showToast("Logged — awaiting approval", `${naira(amt)} for ${depositDate} sent to GM/CEO for review.`, "ok")
      setAmount(""); setNotes(""); setPhotoFile(null); setPhotoPreview(null)
    } else {
      toast.showToast("Couldn't log deposit", res.error || "Please try again", "err")
    }
  }

  const handleSetup = async () => {
    setSettingUp(true)
    const res = await submitStartPoint({ startDate, startingBalance: Number(startingBalance) || 0 })
    setSettingUp(false)
    if (res.ok) toast.showToast("Tracking started", `Cash At Hand now tracks from ${startDate}.`, "ok")
    else toast.showToast("Couldn't set start point", res.error || "Please try again", "err")
  }

  const handleDecide = async (rowIndex, approve) => {
    const res = await decide(rowIndex, approve)
    if (res.ok) {
      toast.showToast(approve ? "Approved" : "Rejected", approve ? "Cash At Hand updated." : "The submitter has been notified.", approve ? "ok" : "warn")
    } else {
      toast.showToast("Couldn't save", res.error || "Please try again", "err")
    }
  }

  const handleDeleteDeposit = async (rowIndex) => {
    const res = await remove(rowIndex)
    if (res.ok) {
      toast.showToast("Removed", "That deposit entry has been deleted.", "ok")
      setConfirmDeleteRow(null)
    } else {
      toast.showToast("Couldn't delete", res.error || "Please try again", "err")
    }
  }

  const homePath = dashboardPathFor({ role: auth.role, station: auth.station })

  if (!canView) return null

  return (
    <div className="flex min-h-screen bg-pagebg">
      <Sidebar
        isOwner={false} isGM={auth.role === "gm"}
        name={auth.name || auth.username} role={roleLabel(auth.role)}
        avatarInitials={initials(auth.name || auth.username)}
        mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
        onLogout={auth.logout} homePath={homePath}
      />
      <div className="flex min-w-0 flex-1 flex-col lg:ml-sidebar">
        <Topbar
          sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(o => !o)}
          loading={loading} onRefresh={() => {}} title="Bank Deposits"
        />

        <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-4">
          <div className="mb-3 flex gap-2 rounded-[12px] bg-white p-1.5 shadow-card">
            {STATION_KEYS.map(key => (
              <button
                key={key} type="button" onClick={() => setStation(key)}
                className="flex-1 rounded-[9px] py-2.5 text-[13px] font-bold transition-colors"
                style={station === key
                  ? { background: getStation(key).theme.primary, color: "#fff" }
                  : { background: "transparent", color: "var(--text-muted)" }}
              >
                {getStation(key).short || getStation(key).name}
              </button>
            ))}
          </div>

          {canReview && pending.length > 0 && (
            <div className="mb-4 rounded-card border-2 border-amber/30 bg-amber-light p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-extrabold text-amber">
                <i className="bi bi-hourglass-split" /> {pending.length} deposit{pending.length !== 1 ? "s" : ""} awaiting your review
              </div>
              {cashAtHandNow !== null && (
                <div className="mb-2.5 text-[11px] text-amber">
                  Current running Cash At Hand: <strong>{naira(cashAtHandNow)}</strong>
                </div>
              )}
              <div className="space-y-2">
                {pending.map(p => {
                  /* A mismatch here is exactly what the reviewer needs to
                     see before deciding, not discover after — the whole
                     point of showing this figure at all. A small gap is
                     normal (rounding, a minor variance); a large one is
                     worth asking about before approving. */
                  const hasComparison = p.cashForDate !== null && p.cashForDate !== undefined
                  const gap = hasComparison ? Math.abs(p.amount - p.cashForDate) : 0
                  const bigGap = hasComparison && p.cashForDate > 0 && (gap / p.cashForDate) > 0.05
                  return (
                    <div key={p.rowIndex} className="rounded-[10px] border border-amber/25 bg-white p-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <div>
                          <div className="mono text-[15px] font-extrabold text-ink">{naira(p.amount)}</div>
                          <div className="text-[11px] text-ink-4">For {p.date} · by {p.submittedBy}</div>
                        </div>
                        <ProofPhotoViewer label="View slip" fileId={p.proofFileId} />
                      </div>

                      {/* The actual comparison — what this day really
                          brought in, right beside what's being claimed
                          as deposited. */}
                      <div className={`mb-2 flex items-center justify-between rounded-[8px] px-2.5 py-2 text-[11px] ${bigGap ? "border border-red/25 bg-red-light" : "bg-surface"}`}>
                        <span className="text-ink-4">Cash for {p.date}</span>
                        <span className={`mono font-bold ${bigGap ? "text-red" : "text-ink-2"}`}>
                          {hasComparison ? naira(p.cashForDate) : "No record"}
                        </span>
                      </div>
                      {bigGap && (
                        <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-red">
                          <i className="bi bi-exclamation-triangle-fill" /> Claimed amount differs from that day's cash by {naira(gap)} — worth checking before approving
                        </div>
                      )}

                      {p.notes && <div className="mb-2 text-[11.5px] text-ink-3">{p.notes}</div>}

                      {confirmDeleteRow === p.rowIndex ? (
                        <div className="rounded-[8px] border border-red/30 bg-red-light p-2.5">
                          <div className="mb-2 text-[11px] font-semibold text-red">Delete this entry entirely? For a genuine mistake (wrong station, duplicate) — not for declining a real submission. This can't be undone.</div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setConfirmDeleteRow(null)} className="flex-1 rounded-[7px] border border-border bg-white py-1.5 text-[11px] font-semibold text-ink-3">
                              Cancel
                            </button>
                            <button type="button" disabled={deciding} onClick={() => handleDeleteDeposit(p.rowIndex)} className="flex-1 rounded-[7px] bg-red py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
                              {deciding ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button type="button" disabled={deciding} onClick={() => handleDecide(p.rowIndex, false)}
                            className="flex-1 rounded-[8px] border border-red/25 bg-red-light py-2 text-[12px] font-bold text-red disabled:opacity-50">
                            Reject
                          </button>
                          <button type="button" disabled={deciding} onClick={() => handleDecide(p.rowIndex, true)}
                            className="flex-1 rounded-[8px] bg-green py-2 text-[12px] font-bold text-white disabled:opacity-50">
                            Approve
                          </button>
                          <button
                            type="button" disabled={deciding} onClick={() => setConfirmDeleteRow(p.rowIndex)}
                            title="Delete entirely — for a genuine mistake, not a decline"
                            className="flex-shrink-0 rounded-[8px] border border-border px-2.5 text-ink-3 disabled:opacity-50"
                          >
                            <i className="bi bi-trash3 text-[12px]" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {needsSetup ? (
            canSubmit ? (
              <div className="rounded-card border-2 border-dashed p-4" style={{ borderColor: getStation(station).theme.accent, background: getStation(station).theme.accentLight }}>
                <div className="mb-1 flex items-center gap-2 text-[13px] font-extrabold text-ink">
                  <i className="bi bi-flag" style={{ color: getStation(station).theme.primary }} /> Set a starting point
                </div>
                <div className="mb-3 text-[11.5px] text-ink-3">
                  Money has been going to the bank before this feature existed — we don't have that history. Pick a date and enter what was actually on hand THAT day, and tracking begins cleanly from there.
                </div>

                <label className="mb-1 block text-[11px] font-bold text-ink-3">Starting from</label>
                <input
                  type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="mb-3 w-full rounded-[10px] border border-border bg-white px-3 py-2.5 text-[14px] font-semibold text-ink outline-none"
                />

                <label className="mb-1 block text-[11px] font-bold text-ink-3">Cash on hand as of that date</label>
                <input
                  type="text" inputMode="decimal" value={startingBalance}
                  onChange={e => setStartingBalance(sanitiseNumeric(e.target.value))}
                  placeholder="0 if the bank was fully caught up that day"
                  className="mb-4 w-full rounded-[10px] border border-border bg-white px-3 py-2.5 text-[15px] font-bold text-ink outline-none"
                />

                <button
                  type="button" onClick={handleSetup} disabled={settingUp}
                  className="flex w-full items-center justify-center gap-2 rounded-[11px] py-3 text-[14px] font-bold text-white disabled:opacity-60"
                  style={{ background: getStation(station).theme.gradientBtn }}
                >
                  {settingUp ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> : <i className="bi bi-check-lg" />}
                  {settingUp ? "Saving…" : "Start Tracking"}
                </button>
              </div>
            ) : (
              <div className="rounded-card border border-border bg-surface p-5 text-center text-[12.5px] text-ink-4">
                Cash At Hand hasn't been set up for {getStation(station).name} yet — a GM, Joseph, or Lanre needs to set a starting point first.
              </div>
            )
          ) : (
          <>
          <div className="overflow-hidden rounded-card text-white shadow-card" style={{ background: getStation(station).theme.gradient }}>
            <div className="p-5">
              <div className="text-[10px] font-bold uppercase tracking-[1px] text-white/60">Cash At Hand (Running Balance)</div>
              <div className="mono mt-1 text-[34px] font-black tracking-tight">
                {loading ? "…" : naira(cashAtHand || 0)}
              </div>
              <div className="mt-1.5 text-[11.5px] text-white/70">
                What should be physically at the station right now, across every day not yet deposited and approved.
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-white/15 border-t border-white/15 bg-black/10">
              <div className="p-3.5">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.6px] text-white/50">Total Collected</div>
                <div className="mono mt-0.5 text-[14px] font-bold">{naira(totalContributed)}</div>
              </div>
              <div className="p-3.5">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.6px] text-white/50">Total Deposited (Approved)</div>
                <div className="mono mt-0.5 text-[14px] font-bold">{naira(totalDeposited)}</div>
              </div>
            </div>
          </div>
          {lastDepositDate && (
            <div className="mt-2 text-center text-[11px] text-ink-4">Last approved deposit: {lastDepositDate}</div>
          )}
          </>
          )}

          {canSubmit ? (
          <div className="mt-5 rounded-card border border-border bg-white p-4 shadow-card">
            <div className="mb-3 text-[13px] font-extrabold text-ink">Log a bank deposit</div>

            <label className="mb-1 block text-[11px] font-bold text-ink-3">Which day's cash is this?</label>
            <input
              type="date" value={depositDate} max={todayISO()} onChange={e => setDepositDate(e.target.value)}
              className="mb-2 w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[14px] font-semibold text-ink outline-none focus:border-[var(--brand-accent)]"
            />

            <div className="mb-3 rounded-[10px] border border-border bg-surface px-3.5 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Cash for {depositDate}</div>
              <div className="mono mt-0.5 text-[19px] font-black text-ink">
                {loadingDateCash ? "…" : cashForDate !== null ? naira(cashForDate) : "No record for this date"}
              </div>
              {existingDepositForDate && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: existingDepositForDate.status === "APPROVED" ? "var(--green, #16A34A)" : existingDepositForDate.status === "REJECTED" ? "var(--red, #DC2626)" : "var(--amber, #B45309)" }}>
                  <i className="bi bi-info-circle-fill" />
                  A deposit of {naira(existingDepositForDate.amount)} already exists for this date ({existingDepositForDate.status.toLowerCase()})
                </div>
              )}
            </div>

            <label className="mb-1 block text-[11px] font-bold text-ink-3">Amount deposited</label>
            <input
              type="text" inputMode="decimal" value={amount}
              onChange={e => setAmount(sanitiseNumeric(e.target.value))}
              placeholder="Enter amount"
              className="mb-3 w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[15px] font-bold text-ink outline-none focus:border-[var(--brand-accent)]"
            />

            <label className="mb-1 block text-[11px] font-bold text-ink-3">Deposit slip / bank alert photo</label>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            {photoPreview ? (
              <button type="button" onClick={() => inputRef.current?.click()} className="mb-3 block w-full overflow-hidden rounded-[10px] border border-border">
                <img src={photoPreview} alt="Deposit slip" className="max-h-48 w-full object-contain bg-surface" />
              </button>
            ) : (
              <button type="button" onClick={() => inputRef.current?.click()}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-border bg-surface py-6 text-[13px] font-semibold text-ink-3">
                <i className="bi bi-camera text-[16px]" /> Add photo
              </button>
            )}

            <label className="mb-1 block text-[11px] font-bold text-ink-3">Notes (optional)</label>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. which days this covers"
              className="mb-4 w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-[var(--brand-accent)]"
            />

            <button
              type="button" onClick={handleSubmit} disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-[11px] py-3 text-[14px] font-bold text-white disabled:opacity-60"
              style={{ background: getStation(station).theme.gradientBtn }}
            >
              {submitting ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> : <i className="bi bi-check-lg" />}
              {submitting ? "Saving…" : "Log Deposit — Send for Approval"}
            </button>
          </div>
          ) : (
            <div className="mt-5 flex items-center gap-2.5 rounded-card border border-border bg-surface p-4">
              <i className="bi bi-eye text-[15px] text-ink-4" />
              <div className="text-[12px] text-ink-3">You can view every deposit and its proof below — only Joseph, Lanre, or a GM can log a new one.</div>
            </div>
          )}

          <div className="mt-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.7px] text-ink-4">Deposit History</div>
            {deposits.length === 0 && !loading && (
              <div className="rounded-card border border-border bg-white p-6 text-center text-[13px] text-ink-4">No deposits logged yet.</div>
            )}
            <div className="space-y-2">
              {deposits.map((d, i) => {
                const s = STATUS_STYLE[d.status] || STATUS_STYLE.APPROVED
                return (
                  <div key={i} className="rounded-card border border-border bg-white p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="mono text-[15px] font-extrabold text-ink">{naira(d.amount)}</span>
                          <span className={`rounded-full px-2 py-[1px] text-[9.5px] font-bold ${s.bg} ${s.text}`}>{s.label}</span>
                        </div>
                        <div className="text-[11px] text-ink-4">{d.date} · {d.submittedBy}</div>
                        {d.notes && <div className="mt-0.5 text-[11px] text-ink-3">{d.notes}</div>}
                      </div>
                      <ProofPhotoViewer label="View slip" fileId={d.proofFileId} />
                    </div>
                    {d.status !== "PENDING" && d.reviewedBy && (
                      <div className="mt-2 border-t border-surface pt-2 text-[10.5px] text-ink-4">
                        {d.status === "APPROVED" ? "Approved" : "Rejected"} by {d.reviewedBy}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <BottomNav homePath={homePath} />
      </div>
    </div>
  )
}
