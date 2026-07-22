import React from "react"
import TodayStepper from "../components/dashboard/TodayStepper"
import { canLogBankDeposit } from "../hooks/useBankDeposits"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { useDashboardData } from "../hooks/useDashboardData"
import { usePageTitle } from "../hooks/usePageTitle"
import { initials, litresValue, litres } from "../utils/format"
import { StaffNotifications } from "../components/pwa/PWABanners"

/* Money only — keeps thousands separators. Volumes go through litres()/
   litresValue(), which deliberately omit them (readings are transcribed off a
   physical counter, where commas are noise). */
function fmt(n) {
  return Number(n || 0).toLocaleString("en-NG")
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

  // The day's real workflow, in order. "Pump Readings" counts as done once
  // ANY reading has been saved — same heuristic the old badge used, kept
  // consistent rather than inventing a stricter rule the rest of the page
  // doesn't share.
  const steps = [
    { key: "open",  icon: "bi-moisture",     label: "Opening Dip",  cta: "Enter Opening Dip Readings",  to: `/dip/${auth.station}`,    done: hasOpen },
    { key: "pump",  icon: "bi-speedometer2", label: "Pump Readings", cta: "Enter Pump Readings",         to: `/sales/${auth.station}`,  done: pumpRows.length > 0 },
    { key: "close", icon: "bi-water",        label: "Closing Dip",  cta: "Enter Closing Dip Readings",  to: `/dip/${auth.station}`,    done: hasClose },
    { key: "cash",  icon: "bi-cash-stack",   label: "Cash Recon.",  cta: "Do Cash Reconciliation",      to: `/cashup/${auth.station}`, done: hasCash },
  ]

  const alerts = levels.filter(t => t.cap > 0 && t.vol > 0 && Math.round((t.vol / t.cap) * 100) <= 20)

  const pmsRev = Math.round(Number((data && data.pmsLitres) || 0) * Number((data && data.pmsPrice) || 0))
  const agoRev = Math.round(Number((data && data.agoLitres) || 0) * Number((data && data.agoPrice) || 1819))


  return (
    <div className="min-h-screen bg-pagebg pb-[90px]">
      <div
        className="px-4 pb-3 text-white"
        style={{ paddingTop: "max(var(--sat), 52px)", background: "var(--brand-gradient-btn)" }}
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

      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        <StaffNotifications username={auth.username} role={auth.role} station="mso" />
        <TodayStepper steps={steps} onStepClick={step => navigate(step.to)} />

        {alerts.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center gap-2.5 rounded-[12px] border border-red/20 bg-red-light px-3.5 py-3">
                <i className="bi bi-exclamation-triangle-fill text-red" />
                <div>
                  <div className="text-[12.5px] font-bold text-red">{a.id} critically low</div>
                  <div className="text-[11px] text-red/80">Only {litres(a.vol)} left ({Math.round((a.vol / a.cap) * 100)}%) — inform GM.</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Actions</div>
        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            /* These must follow the signed-in user's station. Hardcoded /mso
               sent an M&M supervisor to MSO's pages — and worse, any reading
               they entered there would have been written to MSO's spreadsheet. */
            { icon: "bi-water", bg: "#EEF0FF", color: "var(--brand-primary)", label: "Dip Entry", to: `/dip/${auth.station}` },
            { icon: "bi-speedometer2", bg: "#F5F3FF", color: "#7C3AED", label: "Pump", to: `/sales/${auth.station}` },
            { icon: "bi-chat-dots", bg: "var(--brand-accent-light)", color: "var(--brand-accent)", label: "Staff Chat", to: `/chat/${auth.station}` },
            { icon: "bi-truck", bg: "#FFF1F2", color: "#DC2626", label: "Discharge", to: `/discharge/${auth.station}` },
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
                        <div className="font-mono text-[10.5px] text-ink-4">{litres(t.vol)}</div>
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
                      <td className="px-3.5 py-2.5 text-right font-mono text-[11.5px] text-ink-3">{p.open ? litresValue(p.open) : "—"}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[11.5px] text-ink-3">{p.close ? litresValue(p.close) : "—"}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[12.5px] font-extrabold text-cyan-dark">{p.diff > 0 ? litres(p.diff) : "—"}</td>
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

        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Daily Tasks</div>
        <div className="mb-5 overflow-hidden rounded-card border border-border bg-white shadow-card">
          <MenuRow icon="bi-water" iconBg="#EEF0FF" iconColor="var(--brand-primary)" title="Dip Entry" sub="Enter opening & closing readings" onClick={() => navigate(`/dip/${auth.station}`)} />
          <MenuRow icon="bi-speedometer2" iconBg="#F5F3FF" iconColor="#7C3AED" title="Pump Metres" sub="Today's pump sales data" onClick={() => navigate(`/sales/${auth.station}`)} />
          {/* Supervisors can run cash reconciliation too — on weekends the cashier
              sometimes isn't in, and someone still has to close the day out. The
              backend already allows it (saveDailyReport has no role gate); this
              is just the way in. */}
          <MenuRow icon="bi-cash-stack" iconBg="#F0FDF4" iconColor="#16A34A" title="Cash Reconciliation" sub="Close out the day's takings" onClick={() => navigate(`/cashup/${auth.station}`)} />
          {canLogBankDeposit(auth.username, auth.role) && (
            <MenuRow icon="bi-bank" iconBg="var(--brand-accent-light)" iconColor="var(--brand-accent)" title="Bank Deposits" sub="Log a deposit · view Cash At Hand" onClick={() => navigate(`/bank-deposits/${auth.station}`)} />
          )}
          <MenuRow icon="bi-truck" iconBg="#FFF7ED" iconColor="var(--brand-accent)" title="Discharge" sub="Log tank discharge / delivery" onClick={() => navigate(`/discharge/${auth.station}`)} />
          <MenuRow icon="bi-receipt-cutoff" iconBg="#FFF1F2" iconColor="#DC2626" title="Expenses" sub="Log daily station expenses" onClick={() => navigate(`/expenses/${auth.station}`)} />
          <MenuRow icon="bi-exclamation-triangle" iconBg="#FFF1F2" iconColor="#DC2626" title="Shortage" sub="Report a shortage or cash gap" onClick={() => navigate(`/shortage/${auth.station}`)} />
        </div>

        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Reports</div>
        <div className="mb-5 overflow-hidden rounded-card border border-border bg-white shadow-card">
          <MenuRow icon="bi-file-earmark-bar-graph" iconBg="#F0FDF4" iconColor="#16A34A" title="Daily Summary" sub="Generate & share report" onClick={() => navigate(`/summary/${auth.station}`)} />
          <MenuRow icon="bi-file-earmark-text" iconBg="#FFF7ED" iconColor="var(--brand-accent)" title="Daily Records" sub="View & manage historical data" onClick={() => navigate(`/records/${auth.station}`)} />
        </div>

        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Station</div>
        <div className="mb-5 overflow-hidden rounded-card border border-border bg-white shadow-card">
          <MenuRow icon="bi-tag" iconBg="#EEF0FF" iconColor="var(--brand-primary)" title="Fuel Prices" sub="Current PMS & AGO rates" onClick={() => navigate(`/price/${auth.station}`)} />
          {/* The supervisor is the one who sets oil selling prices and records
              deliveries — the backend has always allowed it, but until now the
              page lived only in the owner/GM sidebar, which supervisors never
              see. This is their way in. */}
          <MenuRow icon="bi-droplet-fill" iconBg="#FEF3C7" iconColor="#D97706" title="Oil" sub="Prices, stock & deliveries" onClick={() => navigate(`/lubricant/${auth.station}`)} />
        </div>

        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Account</div>
        <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
          <MenuRow icon="bi-person-circle" iconBg="#EEF0FF" iconColor="var(--brand-primary)" title="My Profile" sub="Update your details & password" onClick={() => navigate(`/profile`)} />
          <MenuRow icon="bi-box-arrow-right" iconBg="#FFF1F2" iconColor="#DC2626" title="Sign Out" sub="End your session" onClick={auth.logout} danger />
        </div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-[500] flex justify-around px-1 py-1.5 shadow-[0_-4px_20px_rgba(19,6,86,.1)]"
        style={{ paddingBottom: "calc(6px + var(--sab))", background: "var(--brand-gradient)" }}
      >
        <button type="button" onClick={() => navigate(`/dashboard-supervisor/${auth.station}`)} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] border border-cyan/25 bg-white/10 px-2.5 py-[5px] text-[9.5px] font-semibold text-cyan">
          <i className="bi bi-grid-1x2-fill text-xl" /> Home
        </button>
        <button type="button" onClick={() => navigate(`/dip/${auth.station}`)} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] px-2.5 py-[5px] text-[9.5px] font-semibold text-white/40">
          <i className="bi bi-water text-xl" /> Dip
        </button>
        <button type="button" onClick={() => navigate(`/sales/${auth.station}`)} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] px-2.5 py-[5px] text-[9.5px] font-semibold text-white/40">
          <i className="bi bi-speedometer2 text-xl" /> Pump
        </button>
        <button type="button" onClick={() => navigate(`/chat/${auth.station}`)} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] px-2.5 py-[5px] text-[9.5px] font-semibold text-white/40">
          <i className="bi bi-chat-dots text-xl" /> Chat
        </button>
      </nav>
    </div>
  )
}
