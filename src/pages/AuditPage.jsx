import React, { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { activeStation } from "../utils/station"
import { getStation } from "../config/stations"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useAudit } from "../hooks/useAudit"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira } from "../utils/format"
import { motion, AnimatePresence, Stagger, StaggerItem, CountUp, Collapse } from "../components/motion"

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const today = () => iso(new Date())
const monthStart = (back = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back); return iso(d) }
const monthEnd = (back = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back + 1); d.setDate(0); return iso(d) }
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }

const SEV = {
  ISSUE:  { fg: "#B91C1C", bg: "#FEE2E2", label: "Issue" },
  REVIEW: { fg: "#B45309", bg: "#FEF3C7", label: "Review" },
  INFO:   { fg: "#475569", bg: "#F1F5F9", label: "Note" },
  OK:     { fg: "#15803D", bg: "#DCFCE7", label: "Clean" },
}

function Pill({ sev, children }) {
  const s = SEV[sev] || SEV.INFO
  return (
    <span className="rounded-full px-2 py-[2px] text-[10px] font-bold" style={{ color: s.fg, background: s.bg }}>
      {children || s.label}
    </span>
  )
}

function Stat({ label, value, sev, active, onClick }) {
  const s = SEV[sev]
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-card border bg-white p-3 text-left shadow-card transition-transform active:scale-[.98]"
      style={{ borderColor: active ? s.fg : "var(--border, #E5E7EB)", borderTop: `3px solid ${s.fg}` }}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide text-ink-4">{label}</div>
      <div className="mono text-[22px] font-extrabold" style={{ color: s.fg }}>
        <CountUp value={value} />
      </div>
    </button>
  )
}

export default function AuditPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const station = getStation(activeStation())
  usePageTitle(`Audit — ${station.name}`)

  const [range, setRange] = useState("month")
  const [custom, setCustom] = useState({ from: monthStart(), to: today() })
  const [filter, setFilter] = useState("ATTENTION") // ATTENTION | ISSUE | REVIEW | INFO | ALL
  const [open, setOpen] = useState({})

  const { from, to } = useMemo(() => {
    if (range === "7") return { from: daysAgo(6), to: today() }
    if (range === "last") return { from: monthStart(1), to: monthEnd(1) }
    if (range === "custom") return custom
    return { from: monthStart(), to: today() }
  }, [range, custom])

  const { status, error, data, refresh } = useAudit(from, to, auth.username)
  const allowed = ["ceo", "owner", "gm"].includes(auth.role)

  const byDay = useMemo(() => {
    const map = {}
    ;(data?.issues || []).forEach(i => { (map[i.date] = map[i.date] || []).push(i) })
    return map
  }, [data])

  const days = useMemo(() => {
    const list = [...(data?.days || [])].reverse()
    return list.filter(d => {
      const iss = byDay[d.date] || []
      if (filter === "ALL") return true
      if (filter === "ATTENTION") return d.status !== "OK"
      return iss.some(i => i.severity === filter)
    })
  }, [data, byDay, filter])

  const toggle = date => setOpen(o => ({ ...o, [date]: !o[date] }))
  const sm = data?.summary

  return (
    <div className="mso-ops-page min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />
      <div
        className="sticky top-0 z-[200] flex items-center gap-3 border-b border-border bg-white px-4 pb-2.5 shadow-[0_1px_4px_rgba(0,0,0,.04)]"
        style={{ paddingTop: "max(var(--sat), 52px)", borderBottom: "2px solid var(--brand-accent)" }}
      >
        <button
          type="button"
          onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2"
        >
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-extrabold text-ink">Data Audit</div>
          <div className="text-[10px] text-ink-4">{station.name} · automatic checks on every day</div>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-[12px] font-bold text-white"
          style={{ background: "var(--brand-gradient-btn, var(--brand-primary))" }}
        >
          <i className={`bi bi-arrow-repeat ${status === "loading" ? "animate-spin" : ""}`} /> Rescan
        </button>
      </div>

      <div className="mx-auto max-w-[620px] px-4 py-5">
        {!allowed && auth.role && (
          <div className="rounded-card border border-border bg-white p-6 text-center text-[13px] text-ink-3 shadow-card">
            The audit is only available to the GM and CEO.
          </div>
        )}

        {allowed && (
          <>
            {/* range */}
            <div className="mb-3 flex flex-wrap gap-2">
              {[["month", "This month"], ["last", "Last month"], ["7", "Last 7 days"], ["custom", "Custom"]].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRange(k)}
                  className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
                  style={range === k
                    ? { background: "var(--brand-primary)", color: "#fff", borderColor: "var(--brand-primary)" }
                    : { background: "#fff", color: "var(--ink-2, #334155)", borderColor: "var(--border, #E5E7EB)" }}
                >
                  {l}
                </button>
              ))}
            </div>
            <Collapse open={range === "custom"}>
              <div className="mb-3 flex items-center gap-2">
                <input type="date" value={custom.from} max={custom.to} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))}
                  className="h-10 flex-1 rounded-[9px] border border-border bg-white px-2 text-[13px]" />
                <span className="text-ink-4">→</span>
                <input type="date" value={custom.to} min={custom.from} max={today()} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))}
                  className="h-10 flex-1 rounded-[9px] border border-border bg-white px-2 text-[13px]" />
              </div>
            </Collapse>

            {status === "loading" && !data && (
              <div className="rounded-card border border-border bg-white p-8 text-center text-[13px] text-ink-4 shadow-card">
                <i className="bi bi-arrow-repeat mr-2 inline-block animate-spin" /> Scanning every day…
              </div>
            )}
            {status === "error" && (
              <div className="rounded-card border p-4 text-[13px]" style={{ borderColor: "#FCA5A5", background: "#FEF2F2", color: "#B91C1C" }}>
                {error}
              </div>
            )}

            {data && (
              <>
                <div className="mb-1 text-[11px] text-ink-4">
                  {data.from} → {data.to} · {sm.days} days scanned · {sm.cleanDays} fully clean
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <Stat label="Issues" value={sm.issues} sev="ISSUE" active={filter === "ISSUE"} onClick={() => setFilter(f => f === "ISSUE" ? "ATTENTION" : "ISSUE")} />
                  <Stat label="To review" value={sm.review} sev="REVIEW" active={filter === "REVIEW"} onClick={() => setFilter(f => f === "REVIEW" ? "ATTENTION" : "REVIEW")} />
                  <Stat label="Notes" value={sm.info} sev="INFO" active={filter === "INFO"} onClick={() => setFilter(f => f === "INFO" ? "ATTENTION" : "INFO")} />
                </div>

                <div className="mb-3 flex gap-2 text-[11.5px]">
                  {[["ATTENTION", "Needs attention"], ["ALL", "All days"]].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setFilter(k)}
                      className="rounded-full border px-3 py-1 font-bold"
                      style={filter === k
                        ? { background: "var(--brand-accent)", color: "#fff", borderColor: "var(--brand-accent)" }
                        : { background: "#fff", color: "var(--ink-3, #475569)", borderColor: "var(--border, #E5E7EB)" }}>
                      {l}
                    </button>
                  ))}
                  <span className="ml-auto self-center text-ink-4">{days.length} day{days.length === 1 ? "" : "s"}</span>
                </div>

                {days.length === 0 ? (
                  <div className="rounded-card border border-border bg-white p-8 text-center shadow-card">
                    <div className="text-[28px]">✅</div>
                    <div className="mt-1 text-[14px] font-bold text-ink">Nothing to flag</div>
                    <div className="text-[12px] text-ink-4">Every day in this range checks out.</div>
                  </div>
                ) : (
                  <Stagger className="flex flex-col gap-2">
                    {days.map(d => {
                      const iss = byDay[d.date] || []
                      const isOpen = !!open[d.date]
                      const s = SEV[d.status] || SEV.OK
                      return (
                        <StaggerItem key={d.date}>
                          <div className="overflow-hidden rounded-card border border-border bg-white shadow-card" style={{ borderLeft: `4px solid ${s.fg}` }}>
                            <button type="button" onClick={() => toggle(d.date)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                              <div className="w-[44px] flex-shrink-0">
                                <div className="mono text-[15px] font-extrabold leading-none text-ink">{d.date.slice(8)}</div>
                                <div className="text-[10px] font-bold uppercase text-ink-4">{d.dow} {d.date.slice(5, 7)}</div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-semibold text-ink-2">
                                  {d.areas || (iss.length ? "Notes only" : "All checks passed")}
                                </div>
                                <div className="text-[10.5px] text-ink-4">
                                  {d.fuel ? `Fuel ${naira(d.fuel)}` : "No fuel recorded"}
                                  {d.gap !== "" && d.gap !== undefined ? ` · gap ${naira(d.gap)}` : ""}
                                </div>
                              </div>
                              <Pill sev={d.status}>{d.status === "OK" ? "Clean" : `${d.flags} flag${d.flags === 1 ? "" : "s"}`}</Pill>
                              <i className={`bi bi-chevron-down text-ink-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </button>
                            <Collapse open={isOpen}>
                              <div className="border-t border-surface px-3.5 py-2.5">
                                {iss.length === 0 && <div className="py-1 text-[12px] text-ink-4">No problems on this day.</div>}
                                {iss.map((i, k) => (
                                  <div key={k} className="flex gap-2 py-1.5">
                                    <div className="flex-shrink-0 pt-[1px]"><Pill sev={i.severity}>{i.area}</Pill></div>
                                    <div className="text-[12px] leading-snug text-ink-2">{i.detail}</div>
                                  </div>
                                ))}
                                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-surface pt-2 text-[11px] text-ink-4">
                                  <span>Collected: <b className="text-ink-2">{naira(d.collected)}</b></span>
                                  <span>Expenses: <b className="text-ink-2">{naira(d.expenses)}</b></span>
                                  <span>To bank: <b className="text-ink-2">{naira(d.toBank)}</b></span>
                                  <span>Cash-up: <b className="text-ink-2">{d.cashup || "—"}</b></span>
                                </div>
                              </div>
                            </Collapse>
                          </div>
                        </StaggerItem>
                      )
                    })}
                  </Stagger>
                )}
                <div className="mt-4 text-center text-[10.5px] text-ink-4">
                  Read-only scan · Issues = money or meter problems · Review = worth a look · Notes = missing photos, dip-vs-meter differences
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
