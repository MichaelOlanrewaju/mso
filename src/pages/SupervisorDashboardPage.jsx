import React from "react"
import TodayRing from "../components/dashboard/TodayRing"
import { canLogBankDeposit } from "../hooks/useBankDeposits"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { useDashboardData } from "../hooks/useDashboardData"
import { usePageTitle } from "../hooks/usePageTitle"
import { initials, litresValue, litres } from "../utils/format"
import { getStation } from "../config/stations"
import { StaffNotifications } from "../components/pwa/PWABanners"

function fmt(n) {
  return Number(n || 0).toLocaleString("en-NG")
}

function MenuRow({ icon, iconBg, iconColor, title, sub, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b px-4 py-3.5 text-left last:border-b-0"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: iconBg }}>
        <i className={`bi ${icon}`} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold" style={{ color: danger ? "var(--ftk-red)" : "var(--ftk-ink)" }}>{title}</div>
        <div className="text-[11px]" style={{ color: "var(--ftk-ink-faint)" }}>{sub}</div>
      </div>
      <i className="bi bi-chevron-right text-[12px]" style={{ color: "var(--ftk-ink-faint)" }} />
    </button>
  )
}

export default function SupervisorDashboardPage() {
  /* No stationFilter here — this page serves BOTH stations via
     /dashboard-supervisor/:station. Filtering to "mso" would bounce an M&M
     supervisor straight back to their own dashboard route, which IS this
     page — an infinite redirect loop. Left over from before M&M existed. */
  const auth = useAuth({ requireAuth: true })
  const { status, data, refresh } = useDashboardData(auth.username)
  const navigate = useNavigate()
  usePageTitle("Dashboard — Supervisor")

  if (auth.loading || !auth.user) {
    return <div className="fintech-dark min-h-screen" />
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

  const pumpMetresMap = (data && data.pumpMetres) || {}
  const pumpRows = Object.keys(pumpMetresMap)
    .map(key => {
      const m = pumpMetresMap[key]
      return { pump: key, tank: m.tank, open: m.open, close: m.close, diff: m.diff }
    })
    .sort((a, b) => a.pump.localeCompare(b.pump))

  const steps = [
    { key: "open",  icon: "bi-moisture",     label: "Opening Dip",  to: `/dip/${auth.station}`,    done: hasOpen },
    { key: "pump",  icon: "bi-speedometer2", label: "Pump Readings", to: `/sales/${auth.station}`,  done: pumpRows.length > 0 },
    { key: "close", icon: "bi-water",        label: "Closing Dip",  to: `/dip/${auth.station}`,    done: hasClose },
    { key: "cash",  icon: "bi-cash-stack",   label: "Cash Recon.",  to: `/cashup/${auth.station}`, done: hasCash },
  ]

  const alerts = levels.filter(t => t.cap > 0 && t.vol > 0 && Math.round((t.vol / t.cap) * 100) <= 20)

  const pmsRev = Math.round(Number((data && data.pmsLitres) || 0) * Number((data && data.pmsPrice) || 0))
  const agoRev = Math.round(Number((data && data.agoLitres) || 0) * Number((data && data.agoPrice) || 1819))

  /* The fintech accent colors swap per station — MSO keeps cyan/violet, M&M
     gets gold/wine, matching each station's real brand rather than a single
     fixed palette for both. Same dark glass system, different accent hues. */
  const isMM = auth.station === "mrs"
  /* These need to be deep enough to read as TEXT on a white background —
     the dark-theme version used light, glowing gold/pink because it needed
     to pop on black. Light theme needs the opposite: darker, saturated
     colors that stay legible as small labels, not bright neon. */
  const themeVars = isMM
    ? { "--ftk-cyan": "#B8860B", "--ftk-violet": "#8F3A5C" }
    : {}

  return (
    <div className="fintech-dark relative overflow-hidden pb-[100px]" style={{ background: "var(--ftk-bg-hero)", ...themeVars }}>
      <div className="pointer-events-none absolute -right-16 -top-20 h-[260px] w-[260px] rounded-full opacity-[0.12]" style={{ background: "var(--ftk-violet)", filter: "blur(60px)" }} />
      <div className="pointer-events-none absolute -left-20 top-32 h-[200px] w-[200px] rounded-full opacity-[0.10]" style={{ background: "var(--ftk-cyan)", filter: "blur(60px)" }} />

      <div className="relative z-10 mx-auto max-w-[640px] px-5" style={{ paddingTop: "max(var(--sat), 26px)" }}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(135deg, var(--ftk-cyan), var(--ftk-violet))" }}>
              {initials(auth.name || auth.username)}
            </div>
            <div>
              <div className="text-[15px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>{auth.name || auth.username}</div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.6px]" style={{ color: "var(--ftk-ink-faint)" }}>Supervisor · {getStation(auth.station).name}</div>
            </div>
          </div>
          <button
            type="button" onClick={refresh}
            className="ftk-glass flex h-9 w-9 items-center justify-center rounded-[11px]"
            style={{ color: "var(--ftk-ink-dim)" }}
          >
            <i className={`bi bi-arrow-clockwise ${status === "loading" ? "animate-spin-fast" : ""}`} />
          </button>
        </div>

        <StaffNotifications username={auth.username} role={auth.role} station="mso" />

        <TodayRing steps={steps} onNext={step => navigate(step.to)} />

        {alerts.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center gap-2.5 rounded-[14px] px-3.5 py-3" style={{ background: "rgba(242,107,107,0.1)", border: "1px solid rgba(242,107,107,0.25)" }}>
                <i className="bi bi-exclamation-triangle-fill" style={{ color: "var(--ftk-red)" }} />
                <div>
                  <div className="text-[12.5px] font-bold" style={{ color: "var(--ftk-red)" }}>{a.id} critically low</div>
                  <div className="text-[11px]" style={{ color: "rgba(242,107,107,0.8)" }}>Only {litres(a.vol)} left ({Math.round((a.vol / a.cap) * 100)}%) — inform GM.</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Actions</div>
        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { icon: "bi-water", tint: "var(--ftk-cyan)", label: "Dip Entry", to: `/dip/${auth.station}` },
            { icon: "bi-speedometer2", tint: "var(--ftk-violet)", label: "Pump", to: `/sales/${auth.station}` },
            { icon: "bi-chat-dots", tint: "var(--ftk-green)", label: "Staff Chat", to: `/chat/${auth.station}` },
            { icon: "bi-truck", tint: "var(--ftk-amber)", label: "Discharge", to: `/discharge/${auth.station}` },
          ].map(qa => (
            <button
              key={qa.label} type="button" onClick={() => navigate(qa.to)}
              className="ftk-glass flex flex-col items-center gap-2 rounded-[16px] p-3.5 text-center"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: `${qa.tint}26` }}>
                <i className={`bi ${qa.icon}`} style={{ color: qa.tint }} />
              </div>
              <span className="text-[11.5px] font-bold" style={{ color: "var(--ftk-ink)" }}>{qa.label}</span>
            </button>
          ))}
        </div>

        <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Tank Levels</div>
        <div className="ftk-glass mb-5 rounded-[18px] p-4">
          {levels.length === 0 ? (
            <div className="py-3 text-center text-[13px]" style={{ color: "var(--ftk-ink-faint)" }}>Loading…</div>
          ) : (
            <div className="flex flex-col">
              {levels.map((t, i) => {
                const rawPct = t.cap > 0 ? (t.vol / t.cap) * 100 : 0
                const overCapacity = rawPct > 105
                const pct = t.cap > 0 ? Math.min(100, Math.round(rawPct)) : 0
                const col = overCapacity ? "var(--ftk-red)" : pct > 40 ? "var(--ftk-green)" : pct > 20 ? "var(--ftk-amber)" : "var(--ftk-red)"
                return (
                  <div key={t.id} className="py-3 first:pt-0 last:pb-0" style={i > 0 ? { borderTop: "1px solid rgba(255,255,255,0.06)" } : {}}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: col }} />
                        <div>
                          <div className="text-[12.5px] font-bold" style={{ color: "var(--ftk-ink)" }}>{t.id} — {t.product}</div>
                          <div className="text-[10px]" style={{ color: "var(--ftk-ink-faint)" }}>Feeds {t.pumps}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[12px] font-extrabold" style={{ color: col }}>
                          {overCapacity ? "Check reading ⚠" : `${pct}%${pct <= 20 ? " ⚠" : ""}`}
                        </div>
                        <div className="ftk-mono text-[10.5px]" style={{ color: "var(--ftk-ink-faint)" }}>{litres(t.vol)}</div>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Pump Readings</span>
          <span
            className="rounded-full px-2 py-[2px] text-[10px] font-bold"
            style={pumpRows.length ? { background: "rgba(52,211,153,0.15)", color: "var(--ftk-green)" } : { background: "rgba(255,255,255,0.06)", color: "var(--ftk-ink-faint)" }}
          >
            {pumpRows.length ? "Submitted" : "Pending"}
          </span>
        </div>
        <div className="ftk-glass mb-5 overflow-hidden rounded-[18px]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                  {["Pump", "Tank", "Opening", "Closing", "Diff"].map(h => (
                    <th key={h} className="px-3.5 py-2 text-left text-[9.5px] font-bold uppercase tracking-[0.6px]" style={{ color: "var(--ftk-ink-faint)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pumpRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3.5 py-5 text-center text-[12.5px]" style={{ color: "var(--ftk-ink-faint)" }}>No pump data yet</td>
                  </tr>
                ) : (
                  pumpRows.map(p => (
                    <tr key={p.pump} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td className="px-3.5 py-2.5">
                        <span className="rounded-full px-2 py-[2px] text-[11px] font-bold" style={{ background: "rgba(34,197,240,0.15)", color: "var(--ftk-cyan)", border: "1px solid rgba(34,197,240,0.3)" }}>{p.pump}</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-[11.5px]" style={{ color: "var(--ftk-ink-faint)" }}>{p.tank}</td>
                      <td className="ftk-mono px-3.5 py-2.5 text-right text-[11.5px]" style={{ color: "var(--ftk-ink-dim)" }}>{p.open ? litresValue(p.open) : "—"}</td>
                      <td className="ftk-mono px-3.5 py-2.5 text-right text-[11.5px]" style={{ color: "var(--ftk-ink-dim)" }}>{p.close ? litresValue(p.close) : "—"}</td>
                      <td className="ftk-mono px-3.5 py-2.5 text-right text-[12.5px] font-extrabold" style={{ color: "var(--ftk-cyan)" }}>{p.diff > 0 ? litres(p.diff) : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Financial Snapshot</span>
          <span className="text-[10.5px]" style={{ color: "var(--ftk-ink-faint)" }}>Est. only</span>
        </div>
        <div className="ftk-glass mb-5 rounded-[18px] p-4">
          <div className="mb-2.5 text-[11px]" style={{ color: "var(--ftk-ink-faint)" }}>Based on today's dip readings</div>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.6px]" style={{ color: "var(--ftk-ink-faint)" }}>PMS Rev</div>
              <div className="ftk-mono text-[14px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>{pmsRev > 0 ? `₦${fmt(pmsRev)}` : "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.6px]" style={{ color: "var(--ftk-ink-faint)" }}>AGO Rev</div>
              <div className="ftk-mono text-[14px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>{agoRev > 0 ? `₦${fmt(agoRev)}` : "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.6px]" style={{ color: "var(--ftk-ink-faint)" }}>Total Est.</div>
              <div className="ftk-mono text-[14px] font-extrabold" style={{ color: "var(--ftk-green)" }}>{pmsRev + agoRev > 0 ? `₦${fmt(pmsRev + agoRev)}` : "—"}</div>
            </div>
          </div>
        </div>

        <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Daily Tasks</div>
        <div className="ftk-glass mb-5 overflow-hidden rounded-[18px]">
          <MenuRow icon="bi-water" iconBg="rgba(34,197,240,0.15)" iconColor="var(--ftk-cyan)" title="Dip Entry" sub="Enter opening & closing readings" onClick={() => navigate(`/dip/${auth.station}`)} />
          <MenuRow icon="bi-speedometer2" iconBg="rgba(124,92,255,0.15)" iconColor="var(--ftk-violet)" title="Pump Metres" sub="Today's pump sales data" onClick={() => navigate(`/sales/${auth.station}`)} />
          <MenuRow icon="bi-cash-stack" iconBg="rgba(52,211,153,0.15)" iconColor="var(--ftk-green)" title="Cash Reconciliation" sub="Close out the day's takings" onClick={() => navigate(`/cashup/${auth.station}`)} />
          {canLogBankDeposit(auth.username, auth.role) && (
            <MenuRow icon="bi-bank" iconBg="rgba(251,191,103,0.15)" iconColor="var(--ftk-amber)" title="Bank Deposits" sub="Log a deposit · view Cash At Hand" onClick={() => navigate(`/bank-deposits/${auth.station}`)} />
          )}
          <MenuRow icon="bi-truck" iconBg="rgba(251,191,103,0.15)" iconColor="var(--ftk-amber)" title="Discharge" sub="Log tank discharge / delivery" onClick={() => navigate(`/discharge/${auth.station}`)} />
          <MenuRow icon="bi-receipt-cutoff" iconBg="rgba(242,107,107,0.15)" iconColor="var(--ftk-red)" title="Expenses" sub="Log daily station expenses" onClick={() => navigate(`/expenses/${auth.station}`)} />
          <MenuRow icon="bi-exclamation-triangle" iconBg="rgba(242,107,107,0.15)" iconColor="var(--ftk-red)" title="Shortage" sub="Report a shortage or cash gap" onClick={() => navigate(`/shortage/${auth.station}`)} />
        </div>

        <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Reports</div>
        <div className="ftk-glass mb-5 overflow-hidden rounded-[18px]">
          <MenuRow icon="bi-file-earmark-bar-graph" iconBg="rgba(52,211,153,0.15)" iconColor="var(--ftk-green)" title="Daily Summary" sub="Generate & share report" onClick={() => navigate(`/summary/${auth.station}`)} />
          <MenuRow icon="bi-file-earmark-text" iconBg="rgba(251,191,103,0.15)" iconColor="var(--ftk-amber)" title="Daily Records" sub="View & manage historical data" onClick={() => navigate(`/records/${auth.station}`)} />
          <MenuRow icon="bi-images" iconBg="rgba(124,92,255,0.15)" iconColor="var(--ftk-violet)" title="Download Photos" sub="Tank dip & pump reading images" onClick={() => navigate(`/photos/${auth.station}`)} />
        </div>

        <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Station</div>
        <div className="ftk-glass mb-5 overflow-hidden rounded-[18px]">
          <MenuRow icon="bi-tag" iconBg="rgba(34,197,240,0.15)" iconColor="var(--ftk-cyan)" title="Fuel Prices" sub="Current PMS & AGO rates" onClick={() => navigate(`/price/${auth.station}`)} />
          <MenuRow icon="bi-droplet-fill" iconBg="rgba(251,191,103,0.15)" iconColor="var(--ftk-amber)" title="Oil" sub="Prices, stock & deliveries" onClick={() => navigate(`/lubricant/${auth.station}`)} />
        </div>

        <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Attendants</div>
        <div className="ftk-glass mb-5 overflow-hidden rounded-[18px]">
          <MenuRow icon="bi-people" iconBg="rgba(124,92,255,0.15)" iconColor="var(--ftk-violet)" title="Attendants" sub="Manage the attendant list" onClick={() => navigate(`/attendants/${auth.station}`)} />
          <MenuRow icon="bi-calendar-check" iconBg="rgba(52,211,153,0.15)" iconColor="var(--ftk-green)" title="Mark Attendance" sub="Today's present / absent" onClick={() => navigate(`/attendance/${auth.station}`)} />
          <MenuRow icon="bi-receipt" iconBg="rgba(251,191,103,0.15)" iconColor="var(--ftk-amber)" title="Clear Shortage" sub="Record a repayment, with receipt" onClick={() => navigate(`/clear-shortage/${auth.station}`)} />
        </div>

        <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Account</div>
        <div className="ftk-glass overflow-hidden rounded-[18px]">
          <MenuRow icon="bi-person-circle" iconBg="rgba(124,92,255,0.15)" iconColor="var(--ftk-violet)" title="My Profile" sub="Update your details & password" onClick={() => navigate(`/profile`)} />
          <MenuRow icon="bi-box-arrow-right" iconBg="rgba(242,107,107,0.15)" iconColor="var(--ftk-red)" title="Sign Out" sub="End your session" onClick={auth.logout} danger />
        </div>
      </div>

      <nav
        className="fixed bottom-[18px] left-4 right-4 z-[500] mx-auto flex max-w-[600px] gap-1 rounded-[22px] p-2"
        style={{
          paddingBottom: "calc(8px + var(--sab))",
          background: "var(--ftk-nav-bg)",
          backdropFilter: "blur(24px)",
          border: "1px solid var(--ftk-nav-border)",
          boxShadow: "0 20px 40px -10px rgba(19,6,86,0.15)",
        }}
      >
        {[
          { icon: "bi-grid-1x2-fill", label: "Home", to: `/dashboard-supervisor/${auth.station}`, active: true },
          { icon: "bi-water", label: "Dip", to: `/dip/${auth.station}` },
          { icon: "bi-speedometer2", label: "Pump", to: `/sales/${auth.station}` },
          { icon: "bi-chat-dots", label: "Chat", to: `/chat/${auth.station}` },
        ].map(n => (
          <button
            key={n.label} type="button" onClick={() => navigate(n.to)}
            className="flex flex-1 flex-col items-center gap-[3px] rounded-[15px] px-2.5 py-2 text-[9.5px] font-bold"
            style={n.active
              ? { background: "linear-gradient(135deg, var(--ftk-cyan), var(--ftk-violet))", color: "#fff" }
              : { color: "var(--ftk-ink-dim)" }}
          >
            <i className={`bi ${n.icon} text-xl`} /> {n.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
