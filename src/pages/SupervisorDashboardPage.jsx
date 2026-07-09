import React from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { useDashboardData } from "../hooks/useDashboardData"
import { usePageTitle } from "../hooks/usePageTitle"
import { initials } from "../utils/format"

function fmt(n) {
  return Number(n || 0).toLocaleString("en-NG")
}

function StatusPill({ label, value, state }) {
  const stateCls =
    state === "done" ? "border-green/25 bg-green-light text-green" : state === "warn" ? "border-amber/30 bg-amber-light text-amber" : "border-border bg-surface text-ink-4"
  return (
    <div className={`flex flex-1 flex-col items-center gap-0.5 rounded-[10px] border px-2 py-2 text-center ${stateCls}`}>
      <span className="text-[9px] font-bold uppercase tracking-[0.6px] opacity-70">{label}</span>
      <span className="text-[11.5px] font-extrabold">{value}</span>
    </div>
  )
}

function MenuRow({ icon, iconBg, iconColor, title, sub, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-surface px-4 py-3.5 text-left last:border-b-0 hover:bg-surface"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: iconBg }}>
        <i className={`bi ${icon}`} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-[13.5px] font-bold ${danger ? "text-red" : "text-ink"}`}>{title}</div>
        <div className="text-[11px] text-ink-4">{sub}</div>
      </div>
      <i className="bi bi-chevron-right text-[12px] text-ink-4" />
    </button>
  )
}

export default function SupervisorDashboardPage() {
  const auth = useAuth({ requireAuth: true, stationFilter: "mso" })
  const { status, data, refresh } = useDashboardData(auth.username)
  const navigate = useNavigate()
  usePageTitle("Dashboard — Supervisor")

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }

  const pms = (data && data.tanks && data.tanks.pms) || []
  const ago = (data && data.tanks && data.tanks.ago) || {}
  const hasOpen = pms[0] && Number(pms[0].opening) > 0
  const hasClose = pms[0] && Number(pms[0].closing) > 0
  const hasCash = Number((data && data.cashToBank) || 0) > 0

  const levels =
    (data && data.tankLevels) ||
    (hasOpen
      ? [
          { id: "TK1", product: "PMS", pumps: "P5, P6", vol: hasClose ? pms[0].closing : pms[0].opening, cap: 19600 },
          { id: "TK2", product: "PMS", pumps: "P1, P2", vol: hasClose ? (pms[1] ? pms[1].closing : 0) : pms[1] ? pms[1].opening : 0, cap: 19600 },
          { id: "TK3", product: "PMS", pumps: "P3, P4", vol: hasClose ? (pms[2] ? pms[2].closing : 0) : pms[2] ? pms[2].opening : 0, cap: 19600 },
          { id: "TK4", product: "AGO", pumps: "P1 AGO", vol: hasClose ? ago.closing || 0 : ago.opening || 0, cap: 3200 },
        ]
      : [])

  // Pump Readings — sourced from the actual PumpMetres data (what's really
  // been entered so far), not from completed sales transactions. A
  // completed sale only exists once Closing is in, so relying on
  // recentTransactions alone showed "No pump data yet" even right after
  // a supervisor correctly saved their Opening readings.
  const pumpMetresMap = (data && data.pumpMetres) || {}
  const pumpRows = Object.keys(pumpMetresMap)
    .map(key => {
      const m = pumpMetresMap[key]
      return { pump: key, tank: m.tank, open: m.open, close: m.close, diff: m.diff }
    })
    .sort((a, b) => a.pump.localeCompare(b.pump))

  const alerts = levels.filter(t => t.cap > 0 && t.vol > 0 && Math.round((t.vol / t.cap) * 100) <= 20)

  const pmsRev = Math.round(Number((data && data.pmsLitres) || 0) * Number((data && data.pmsPrice) || 1272))
  const agoRev = Math.round(Number((data && data.agoLitres) || 0) * Number((data && data.agoPrice) || 1819))

  let ctaLabel = "Enter Opening Dip Readings"
  let ctaBg = "linear-gradient(135deg, #130656, #1a0875)"
  if (hasClose) {
    ctaLabel = "Both readings submitted today ✓"
    ctaBg = "#3F3F46"
  } else if (hasOpen) {
    ctaLabel = "Enter Closing Dip Readings"
    ctaBg = "linear-gradient(135deg, #1a0875, #179DD0)"
  }

  return (
    <div className="min-h-screen bg-pagebg pb-[90px]">
      <div
        className="px-4 pb-3 text-white"
        style={{ paddingTop: "max(var(--sat), 52px)", background: "linear-gradient(135deg, #130656 0%, #1a0875 100%)" }}
      >
        <div className="mx-auto flex max-w-[640px] items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-[12px] font-extrabold text-white">
              {initials(auth.name || auth.username)}
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.6px] text-white/50">Supervisor · MSO Station</div>
              <div className="text-[15px] font-extrabold text-white">{auth.name || auth.username}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-white"
          >
            <i className={`bi bi-arrow-clockwise ${status === "loading" ? "animate-spin-fast" : ""}`} />
          </button>
        </div>

        <div className="mx-auto mt-3 flex max-w-[640px] gap-2">
          <StatusPill label="Opening" value={hasOpen ? "Done ✓" : "Pending"} state={hasOpen ? "done" : "muted"} />
          <StatusPill label="Closing" value={hasClose ? "Done ✓" : hasOpen ? "Pending" : "Later"} state={hasClose ? "done" : hasOpen ? "warn" : "muted"} />
          <StatusPill label="Cashier" value={hasCash ? "Done ✓" : "Pending"} state={hasCash ? "done" : "muted"} />
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        <button
          type="button"
          onClick={() => (hasClose ? null : navigate("/dip-mso"))}
          className="mb-5 flex h-[50px] w-full items-center gap-2.5 rounded-[12px] px-4 text-[14px] font-bold text-white shadow-lift"
          style={{ background: ctaBg }}
        >
          <i className="bi bi-clock-history" />
          <span className="flex-1 text-left">{ctaLabel}</span>
          {!hasClose && <i className="bi bi-arrow-right" />}
        </button>

        {alerts.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center gap-2.5 rounded-[12px] border border-red/20 bg-red-light px-3.5 py-3">
                <i className="bi bi-exclamation-triangle-fill text-red" />
                <div>
                  <div className="text-[12.5px] font-bold text-red">{a.id} critically low</div>
                  <div className="text-[11px] text-red/80">Only {fmt(a.vol)}L left ({Math.round((a.vol / a.cap) * 100)}%) — inform GM.</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Actions</div>
        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { icon: "bi-water", bg: "#EEF0FF", color: "#130656", label: "Dip Entry", to: "/dip-mso" },
            { icon: "bi-speedometer2", bg: "#F5F3FF", color: "#7C3AED", label: "Pump", to: "/sales-mso" },
            { icon: "bi-chat-dots", bg: "#EAF6FC", color: "#179DD0", label: "Staff Chat", to: "/chat-mso" },
            { icon: "bi-truck", bg: "#FFF1F2", color: "#DC2626", label: "Discharge", to: "/discharge-mso" },
          ].map(qa => (
            <button
              key={qa.label}
              type="button"
              onClick={() => navigate(qa.to)}
              className="flex flex-col items-center gap-2 rounded-card border border-border bg-white p-3.5 text-center shadow-card"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: qa.bg }}>
                <i className={`bi ${qa.icon}`} style={{ color: qa.color }} />
              </div>
              <span className="text-[11.5px] font-bold text-ink">{qa.label}</span>
            </button>
          ))}
        </div>

        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Tank Levels</div>
        <div className="mb-5 rounded-card border border-border bg-white p-4 shadow-card">
          {levels.length === 0 ? (
            <div className="py-3 text-center text-[13px] text-ink-4">Loading…</div>
          ) : (
            <div className="flex flex-col divide-y divide-surface">
              {levels.map(t => {
                const rawPct = t.cap > 0 ? (t.vol / t.cap) * 100 : 0
                const overCapacity = rawPct > 105 // small tolerance for rounding, not a real overflow
                const pct = t.cap > 0 ? Math.min(100, Math.round(rawPct)) : 0
                const col = overCapacity ? "#DC2626" : pct > 40 ? "#16A34A" : pct > 20 ? "#CA8A04" : "#DC2626"
                return (
                  <div key={t.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: col }} />
                        <div>
                          <div className="text-[12.5px] font-bold text-ink">{t.id} — {t.product}</div>
                          <div className="text-[10px] text-ink-4">Feeds {t.pumps}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[12px] font-extrabold" style={{ color: col }}>
                          {overCapacity ? "Check reading ⚠" : `${pct}%${pct <= 20 ? " ⚠" : ""}`}
                        </div>
                        <div className="font-mono text-[10.5px] text-ink-4">{fmt(t.vol)}L</div>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Pump Readings</span>
          <span
            className={`rounded-full px-2 py-[2px] text-[10px] font-bold ${
              pumpRows.length ? "bg-green-light text-green" : "bg-surface text-ink-4"
            }`}
          >
            {pumpRows.length ? "Submitted" : "Pending"}
          </span>
        </div>
        <div className="mb-5 overflow-hidden rounded-card border border-border bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface">
                  {["Pump", "Tank", "Opening", "Closing", "Diff"].map(h => (
                    <th key={h} className="px-3.5 py-2 text-left text-[9.5px] font-bold uppercase tracking-[0.6px] text-ink-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pumpRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3.5 py-5 text-center text-[12.5px] text-ink-4">No pump data yet</td>
                  </tr>
                ) : (
                  pumpRows.map(p => (
                    <tr key={p.pump} className="border-b border-surface last:border-b-0">
                      <td className="px-3.5 py-2.5">
                        <span className="rounded-full border border-cyan/20 bg-cyan-light px-2 py-[2px] text-[11px] font-bold text-cyan-dark">{p.pump}</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-[11.5px] text-ink-4">{p.tank}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[11.5px] text-ink-3">{p.open ? p.open.toLocaleString("en-NG") : "—"}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[11.5px] text-ink-3">{p.close ? p.close.toLocaleString("en-NG") : "—"}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[12.5px] font-extrabold text-cyan-dark">{p.diff > 0 ? `${p.diff.toLocaleString("en-NG", { maximumFractionDigits: 2 })}L` : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Financial Snapshot</span>
          <span className="text-[10.5px] text-ink-4">Est. only</span>
        </div>
        <div className="mb-5 rounded-card border border-border bg-white p-4 shadow-card">
          <div className="mb-2.5 text-[11px] text-ink-4">Based on today's dip readings</div>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-ink-4">PMS Rev</div>
              <div className="font-mono text-[14px] font-extrabold text-ink">{pmsRev > 0 ? `₦${fmt(pmsRev)}` : "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-ink-4">AGO Rev</div>
              <div className="font-mono text-[14px] font-extrabold text-ink">{agoRev > 0 ? `₦${fmt(agoRev)}` : "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-ink-4">Total Est.</div>
              <div className="font-mono text-[14px] font-extrabold text-ink">{pmsRev + agoRev > 0 ? `₦${fmt(pmsRev + agoRev)}` : "—"}</div>
            </div>
          </div>
        </div>

        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Menu</div>
        <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
          <MenuRow icon="bi-water" iconBg="#EEF0FF" iconColor="#130656" title="Dip Entry" sub="Enter opening & closing readings" onClick={() => navigate("/dip-mso")} />
          <MenuRow icon="bi-speedometer2" iconBg="#F5F3FF" iconColor="#7C3AED" title="Pump Metres" sub="Today's pump sales data" onClick={() => navigate("/sales-mso")} />
          <MenuRow icon="bi-file-earmark-text" iconBg="#FFF7ED" iconColor="#D97706" title="Daily Records" sub="View & manage historical data" onClick={() => navigate("/records-mso")} />
          <MenuRow icon="bi-truck" iconBg="#FFF7ED" iconColor="#D97706" title="Discharge" sub="Log tank discharge / delivery" onClick={() => navigate("/discharge-mso")} />
          <MenuRow icon="bi-receipt-cutoff" iconBg="#FFF1F2" iconColor="#DC2626" title="Expenses" sub="Log daily station expenses" onClick={() => navigate("/expenses-mso")} />
          <MenuRow icon="bi-tag" iconBg="#EEF0FF" iconColor="#130656" title="Fuel Prices" sub="Current PMS & AGO rates" onClick={() => navigate("/price-mso")} />
          <MenuRow icon="bi-file-earmark-bar-graph" iconBg="#F0FDF4" iconColor="#16A34A" title="Daily Summary" sub="Generate & share report" onClick={() => navigate("/summary-mso")} />
          <MenuRow icon="bi-exclamation-triangle" iconBg="#FFF1F2" iconColor="#DC2626" title="Shortage" sub="Report a shortage or cash gap" onClick={() => navigate("/shortage-mso")} />
          <MenuRow icon="bi-box-arrow-right" iconBg="#FFF1F2" iconColor="#DC2626" title="Sign Out" sub="End your session" onClick={auth.logout} danger />
        </div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-[500] flex justify-around px-1 py-1.5 shadow-[0_-4px_20px_rgba(19,6,86,.1)]"
        style={{ paddingBottom: "calc(6px + var(--sab))", background: "linear-gradient(180deg, #130656 0%, #0D1226 100%)" }}
      >
        <button type="button" onClick={() => navigate("/dashboard-supervisor-mso")} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] border border-cyan/25 bg-white/10 px-2.5 py-[5px] text-[9.5px] font-semibold text-cyan">
          <i className="bi bi-grid-1x2-fill text-xl" /> Home
        </button>
        <button type="button" onClick={() => navigate("/dip-mso")} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] px-2.5 py-[5px] text-[9.5px] font-semibold text-white/40">
          <i className="bi bi-water text-xl" /> Dip
        </button>
        <button type="button" onClick={() => navigate("/sales-mso")} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] px-2.5 py-[5px] text-[9.5px] font-semibold text-white/40">
          <i className="bi bi-speedometer2 text-xl" /> Pump
        </button>
        <button type="button" onClick={() => navigate("/chat-mso")} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] px-2.5 py-[5px] text-[9.5px] font-semibold text-white/40">
          <i className="bi bi-chat-dots text-xl" /> Chat
        </button>
      </nav>
    </div>
  )
}
