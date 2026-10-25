import React from "react"
import { canLogBankDeposit } from "../hooks/useBankDeposits"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { useDashboardData } from "../hooks/useDashboardData"
import { usePageTitle } from "../hooks/usePageTitle"
import { initials, litresValue, litres } from "../utils/format"
import { getStation } from "../config/stations"
import { StaffNotifications } from "../components/pwa/PWABanners"
import OpsContextStrip from "../components/ui/system/OpsContextStrip"
import { motion, AnimatePresence, Stagger, StaggerItem, CountUp, StateSwap, EASE } from "../components/motion"

function fmt(n) {
  return Number(n || 0).toLocaleString("en-NG")
}

function MenuRow({ icon, iconBg, iconColor, title, sub, onClick, danger }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: 3, backgroundColor: "rgba(15,23,42,0.025)" }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.15 }}
      className="group flex w-full items-center gap-3 border-b px-4 py-3.5 text-left last:border-b-0"
      style={{ borderColor: "rgba(15,23,42,0.06)" }}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: iconBg }}>
        <i className={`bi ${icon}`} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold" style={{ color: danger ? "var(--ftk-red)" : "var(--ftk-ink)" }}>{title}</div>
        <div className="text-[11px]" style={{ color: "var(--ftk-ink-faint)" }}>{sub}</div>
      </div>
      <i className="bi bi-chevron-right text-[12px] transition-transform duration-200 group-hover:translate-x-0.5" style={{ color: "var(--ftk-ink-faint)" }} />
    </motion.button>
  )
}

/* Section heading + card group, entering together as one staggered unit. */
function Section({ label, right, children, className = "mb-5" }) {
  return (
    <StaggerItem className={className}>
      <StaggerItem className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>{label}</span>
        {right}
      </StaggerItem>
      {children}
    </StaggerItem>
  )
}

/* Progress ring for the day's four steps — animates when steps complete. */
function StepRing({ done, total }) {
  const R = 40, C = 2 * Math.PI * R
  const pct = total ? done / total : 0
  return (
    <div className="relative h-[96px] w-[96px] flex-shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="9" />
        <motion.circle cx="50" cy="50" r={R} fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.25 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <div className="ftk-mono text-[20px] font-bold leading-none">{done}/{total}</div>
        <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.6px] opacity-70">Done</div>
      </div>
    </div>
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
  /* Station colours now come from the live brand tokens (Mobil: blue on deep
     blue, M&M: gold on wine) instead of a one-off override. */
  const themeVars = { "--ftk-cyan": "var(--brand-accent-dark)", "--ftk-violet": "var(--brand-primary)" }
  const current = steps.find(st => !st.done)
  const doneCount = steps.filter(st => st.done).length
  const stationLoading = status === "loading" || status === "idle"
  const todayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" })

  return (
    <div className="mso-ops-page fintech-dark relative overflow-hidden pb-[100px]" style={{ background: "var(--ftk-bg-hero)", ...themeVars }}>
      <div className="pointer-events-none absolute -right-16 -top-20 h-[260px] w-[260px] rounded-full opacity-[0.12]" style={{ background: "var(--brand-primary)", filter: "blur(60px)" }} />
      <div className="pointer-events-none absolute -left-20 top-32 h-[200px] w-[200px] rounded-full opacity-[0.10]" style={{ background: "var(--brand-accent)", filter: "blur(60px)" }} />

      <Stagger gap={0.06} className="relative z-10 mx-auto max-w-[640px] px-5 lg:max-w-[880px]" style={{ paddingTop: "max(var(--sat), 26px)" }}>
        <StaggerItem><OpsContextStrip area="Station Operations" step="Supervisor" /></StaggerItem>

        {/* Hero — who, where, and how far through the day. Station brand colours. */}
        <StaggerItem className="relative mb-4 overflow-hidden rounded-[24px] p-5 text-white shadow-lift" style={{ background: "var(--brand-gradient)" }}>
          <motion.div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-[190px] w-[190px] rounded-full opacity-30"
            style={{ background: "var(--brand-accent)", filter: "blur(46px)" }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.38, 0.25] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] text-[13px] font-extrabold" style={{ background: "var(--brand-accent)", color: "var(--brand-primary-dark)" }}>
                {initials(auth.name || auth.username)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[16px] font-extrabold">{auth.name || auth.username}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-white/70">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" /> Supervisor · {getStation(auth.station).name}
                </div>
              </div>
            </div>
            <motion.button type="button" onClick={refresh} whileTap={{ rotate: 180, scale: 0.9 }} aria-label="Refresh"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] bg-white/15 text-white backdrop-blur">
              <i className={`bi bi-arrow-clockwise ${status === "loading" ? "animate-spin-fast" : ""}`} />
            </motion.button>
          </div>

          <div className="relative mt-4 flex items-center gap-4">
            <StepRing done={doneCount} total={steps.length} />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.8px] text-white/60">{todayLabel}</div>
              <div className="mb-2.5 mt-1 text-[15.5px] font-extrabold leading-tight">
                {current ? `${current.label} is next` : "All caught up today"}
              </div>
              {current && (
                <motion.button type="button" onClick={() => navigate(current.to)} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center gap-1.5 rounded-[11px] px-3.5 py-2 text-[12px] font-extrabold"
                  style={{ background: "var(--brand-accent)", color: "var(--brand-primary-dark)" }}>
                  Continue <i className="bi bi-arrow-right" />
                </motion.button>
              )}
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-4 gap-2">
            {steps.map((st, i) => (
              <motion.button key={st.key} type="button" onClick={() => navigate(st.to)} whileTap={{ scale: 0.94 }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.07, duration: 0.3 }}
                className="flex flex-col items-center gap-1 rounded-[12px] px-1 py-2 text-center"
                style={{ background: st.done ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)" }}>
                <i className={`bi ${st.done ? "bi-check-circle-fill" : st.icon} text-[15px]`} style={{ color: st.done ? "#4ADE80" : "rgba(255,255,255,0.75)" }} />
                <span className="text-[9px] font-bold leading-tight text-white/85">{st.label}</span>
              </motion.button>
            ))}
          </div>
        </StaggerItem>

        <StaggerItem><StaffNotifications username={auth.username} role={auth.role} station="mso" /></StaggerItem>

        <AnimatePresence initial={false}>
          {alerts.length > 0 && (
            <motion.div key="alerts" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mb-4 flex flex-col gap-2">
                {alerts.map(a => (
                  <div key={a.id} className="flex items-center gap-2.5 rounded-[14px] px-3.5 py-3" style={{ background: "rgba(242,107,107,0.1)", border: "1px solid rgba(242,107,107,0.25)" }}>
                    <i className="bi bi-exclamation-triangle-fill animate-pulse" style={{ color: "var(--ftk-red)" }} />
                    <div>
                      <div className="text-[12.5px] font-bold" style={{ color: "var(--ftk-red)" }}>{a.id} critically low</div>
                      <div className="text-[11px]" style={{ color: "rgba(220,38,38,0.8)" }}>Only {litres(a.vol)} left ({Math.round((a.vol / a.cap) * 100)}%) — inform GM.</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <StaggerItem className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Actions</StaggerItem>
        <StaggerItem className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { icon: "bi-water", tint: "var(--ftk-cyan)", label: "Dip Entry", to: `/dip/${auth.station}` },
            { icon: "bi-speedometer2", tint: "var(--ftk-violet)", label: "Pump", to: `/sales/${auth.station}` },
            { icon: "bi-chat-dots", tint: "var(--ftk-green)", label: "Staff Chat", to: `/chat/${auth.station}` },
            { icon: "bi-truck", tint: "var(--ftk-amber)", label: "Discharge", to: `/discharge/${auth.station}` },
          ].map(qa => (
            <motion.button
              key={qa.label} type="button" onClick={() => navigate(qa.to)}
              whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}
              className="ftk-glass flex flex-col items-center gap-2 rounded-[16px] p-3.5 text-center transition-shadow hover:shadow-lift"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: `color-mix(in srgb, ${qa.tint} 16%, transparent)` }}>
                <i className={`bi ${qa.icon} text-[17px]`} style={{ color: qa.tint }} />
              </div>
              <span className="text-[11.5px] font-bold" style={{ color: "var(--ftk-ink)" }}>{qa.label}</span>
            </motion.button>
          ))}
        </StaggerItem>

        <StaggerItem className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Tank Levels</StaggerItem>
        <StaggerItem className="ftk-glass mb-5 rounded-[18px] p-4">
          {levels.length === 0 ? (
            stationLoading ? (
              <div className="space-y-4 py-1">{[0, 1, 2, 3].map(k => <span key={k} className="skel block h-8 w-full" />)}</div>
            ) : (
              <div className="py-3 text-center text-[13px]" style={{ color: "var(--ftk-ink-faint)" }}>No tank readings yet today.</div>
            )
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
                          {overCapacity ? "Check reading ⚠" : <><CountUp value={`${pct}%`} />{pct <= 20 ? " ⚠" : ""}</>}
                        </div>
                        <div className="ftk-mono text-[10.5px]" style={{ color: "var(--ftk-ink-faint)" }}>{litres(t.vol)}</div>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: "rgba(15,23,42,0.07)" }}>
                      <motion.div className="h-full rounded-full" style={{ background: col }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.1 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </StaggerItem>

        <StaggerItem className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Pump Readings</span>
          <span
            className="rounded-full px-2 py-[2px] text-[10px] font-bold"
            style={pumpRows.length ? { background: "rgba(22,163,74,0.12)", color: "var(--ftk-green)" } : { background: "rgba(15,23,42,0.06)", color: "var(--ftk-ink-faint)" }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={pumpRows.length ? "s" : "p"} className="inline-block" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                {pumpRows.length ? "Submitted" : "Pending"}
              </motion.span>
            </AnimatePresence>
          </span>
        </StaggerItem>
        <StaggerItem className="ftk-glass mb-5 overflow-hidden rounded-[18px]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.025)" }}>
                  {["Pump", "Tank", "Opening", "Closing", "Diff"].map(h => (
                    <th key={h} className="px-3.5 py-2 text-left text-[9.5px] font-bold uppercase tracking-[0.6px]" style={{ color: "var(--ftk-ink-faint)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pumpRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3.5 py-5 text-center text-[12.5px]" style={{ color: "var(--ftk-ink-faint)" }}>{stationLoading ? <span className="skel mx-auto block h-4 w-40" /> : "No pump data yet"}</td>
                  </tr>
                ) : (
                  pumpRows.map((p, pi) => (
                    <motion.tr key={p.pump} style={{ borderBottom: "1px solid rgba(15,23,42,0.05)" }}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: Math.min(pi, 10) * 0.04 }}>
                      <td className="px-3.5 py-2.5">
                        <span className="rounded-full px-2 py-[2px] text-[11px] font-bold" style={{ background: "color-mix(in srgb, var(--ftk-cyan) 14%, transparent)", color: "var(--ftk-cyan)", border: "1px solid color-mix(in srgb, var(--ftk-cyan) 30%, transparent)" }}>{p.pump}</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-[11.5px]" style={{ color: "var(--ftk-ink-faint)" }}>{p.tank}</td>
                      <td className="ftk-mono px-3.5 py-2.5 text-right text-[11.5px]" style={{ color: "var(--ftk-ink-dim)" }}>{p.open ? litresValue(p.open) : "—"}</td>
                      <td className="ftk-mono px-3.5 py-2.5 text-right text-[11.5px]" style={{ color: "var(--ftk-ink-dim)" }}>{p.close ? litresValue(p.close) : "—"}</td>
                      <td className="ftk-mono px-3.5 py-2.5 text-right text-[12.5px] font-extrabold" style={{ color: "var(--ftk-cyan)" }}>{p.diff > 0 ? <CountUp value={litres(p.diff)} /> : "—"}</td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </StaggerItem>

        <StaggerItem className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Financial Snapshot</span>
          <span className="text-[10.5px]" style={{ color: "var(--ftk-ink-faint)" }}>Est. only</span>
        </StaggerItem>
        <StaggerItem className="ftk-glass mb-5 rounded-[18px] p-4">
          <div className="mb-2.5 text-[11px]" style={{ color: "var(--ftk-ink-faint)" }}>Based on today's dip readings</div>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.6px]" style={{ color: "var(--ftk-ink-faint)" }}>PMS Rev</div>
              <div className="ftk-mono text-[14px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>{pmsRev > 0 ? <CountUp value={`₦${fmt(pmsRev)}`} /> : "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.6px]" style={{ color: "var(--ftk-ink-faint)" }}>AGO Rev</div>
              <div className="ftk-mono text-[14px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>{agoRev > 0 ? <CountUp value={`₦${fmt(agoRev)}`} /> : "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.6px]" style={{ color: "var(--ftk-ink-faint)" }}>Total Est.</div>
              <div className="ftk-mono text-[14px] font-extrabold" style={{ color: "var(--ftk-green)" }}>{pmsRev + agoRev > 0 ? <CountUp value={`₦${fmt(pmsRev + agoRev)}`} /> : "—"}</div>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Daily Tasks</StaggerItem>
        <StaggerItem className="ftk-glass mb-5 overflow-hidden rounded-[18px]">
          <MenuRow icon="bi-water" iconBg="color-mix(in srgb, var(--ftk-cyan) 15%, transparent)" iconColor="var(--ftk-cyan)" title="Dip Entry" sub="Enter opening & closing readings" onClick={() => navigate(`/dip/${auth.station}`)} />
          <MenuRow icon="bi-speedometer2" iconBg="color-mix(in srgb, var(--ftk-violet) 15%, transparent)" iconColor="var(--ftk-violet)" title="Pump Metres" sub="Today's pump sales data" onClick={() => navigate(`/sales/${auth.station}`)} />
          <MenuRow icon="bi-cash-stack" iconBg="rgba(52,211,153,0.15)" iconColor="var(--ftk-green)" title="Cash Reconciliation" sub="Close out the day's takings" onClick={() => navigate(`/cashup/${auth.station}`)} />
          {canLogBankDeposit(auth.username, auth.role) && (
            <MenuRow icon="bi-bank" iconBg="rgba(251,191,103,0.15)" iconColor="var(--ftk-amber)" title="Bank Deposits" sub="Log a deposit · view Cash At Hand" onClick={() => navigate(`/bank-deposits/${auth.station}`)} />
          )}
          <MenuRow icon="bi-truck" iconBg="rgba(251,191,103,0.15)" iconColor="var(--ftk-amber)" title="Discharge" sub="Log tank discharge / delivery" onClick={() => navigate(`/discharge/${auth.station}`)} />
          <MenuRow icon="bi-receipt-cutoff" iconBg="rgba(242,107,107,0.15)" iconColor="var(--ftk-red)" title="Expenses" sub="Log daily station expenses" onClick={() => navigate(`/expenses/${auth.station}`)} />
          <MenuRow icon="bi-exclamation-triangle" iconBg="rgba(242,107,107,0.15)" iconColor="var(--ftk-red)" title="Shortage" sub="Report a shortage or cash gap" onClick={() => navigate(`/shortage/${auth.station}`)} />
        </StaggerItem>

        <StaggerItem className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Reports</StaggerItem>
        <StaggerItem className="ftk-glass mb-5 overflow-hidden rounded-[18px]">
          <MenuRow icon="bi-file-earmark-bar-graph" iconBg="rgba(52,211,153,0.15)" iconColor="var(--ftk-green)" title="Daily Summary" sub="Generate & share report" onClick={() => navigate(`/summary/${auth.station}`)} />
          <MenuRow icon="bi-file-earmark-text" iconBg="rgba(251,191,103,0.15)" iconColor="var(--ftk-amber)" title="Daily Records" sub="View & manage historical data" onClick={() => navigate(`/records/${auth.station}`)} />
          <MenuRow icon="bi-images" iconBg="color-mix(in srgb, var(--ftk-violet) 15%, transparent)" iconColor="var(--ftk-violet)" title="Download Photos" sub="Tank dip & pump reading images" onClick={() => navigate(`/photos/${auth.station}`)} />
        </StaggerItem>

        <StaggerItem className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Station</StaggerItem>
        <StaggerItem className="ftk-glass mb-5 overflow-hidden rounded-[18px]">
          <MenuRow icon="bi-tag" iconBg="color-mix(in srgb, var(--ftk-cyan) 15%, transparent)" iconColor="var(--ftk-cyan)" title="Fuel Prices" sub="Current PMS & AGO rates" onClick={() => navigate(`/price/${auth.station}`)} />
          <MenuRow icon="bi-droplet-fill" iconBg="rgba(251,191,103,0.15)" iconColor="var(--ftk-amber)" title="Oil" sub="Prices, stock & deliveries" onClick={() => navigate(`/lubricant/${auth.station}`)} />
        </StaggerItem>

        <StaggerItem className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Attendants</StaggerItem>
        <StaggerItem className="ftk-glass mb-5 overflow-hidden rounded-[18px]">
          <MenuRow icon="bi-people" iconBg="color-mix(in srgb, var(--ftk-violet) 15%, transparent)" iconColor="var(--ftk-violet)" title="Attendants" sub="Manage the attendant list" onClick={() => navigate(`/attendants/${auth.station}`)} />
          <MenuRow icon="bi-calendar-check" iconBg="rgba(52,211,153,0.15)" iconColor="var(--ftk-green)" title="Mark Attendance" sub="Today's present / absent" onClick={() => navigate(`/attendance/${auth.station}`)} />
          <MenuRow icon="bi-receipt" iconBg="rgba(251,191,103,0.15)" iconColor="var(--ftk-amber)" title="Clear Shortage" sub="Record a repayment, with receipt" onClick={() => navigate(`/clear-shortage/${auth.station}`)} />
        </StaggerItem>

        <StaggerItem className="mb-2 text-[10px] font-extrabold uppercase tracking-[1.1px]" style={{ color: "var(--ftk-ink-faint)" }}>Account</StaggerItem>
        <StaggerItem className="ftk-glass overflow-hidden rounded-[18px]">
          <MenuRow icon="bi-person-circle" iconBg="color-mix(in srgb, var(--ftk-violet) 15%, transparent)" iconColor="var(--ftk-violet)" title="My Profile" sub="Update your details & password" onClick={() => navigate(`/profile`)} />
          <MenuRow icon="bi-box-arrow-right" iconBg="rgba(242,107,107,0.15)" iconColor="var(--ftk-red)" title="Sign Out" sub="End your session" onClick={auth.logout} danger />
        </StaggerItem>
      </Stagger>

      <motion.nav
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.45, ease: EASE, delay: 0.3 }}
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
          <motion.button
            key={n.label} type="button" onClick={() => navigate(n.to)} whileTap={{ scale: 0.92 }}
            className="flex flex-1 flex-col items-center gap-[3px] rounded-[15px] px-2.5 py-2 text-[9.5px] font-bold"
            style={n.active
              ? { background: "var(--brand-gradient-btn)", color: "#fff" }
              : { color: "var(--ftk-ink-dim)" }}
          >
            <i className={`bi ${n.icon} text-xl`} /> {n.label}
          </motion.button>
        ))}
      </motion.nav>
    </div>
  )
}
