import React from "react"
import { numberNG, litres } from "../../utils/format"

function pctClass(pct) {
  if (pct > 40) return "bg-green-light text-green"
  if (pct > 15) return "bg-amber-light text-amber"
  return "bg-red-light text-red"
}
function idColor(pct) {
  if (pct > 40) return "var(--brand-accent-dark)"
  if (pct > 15) return "var(--brand-accent)"
  return "#DC2626"
}

function TankRow({ tank }) {
  const rawPct = tank.cap > 0 ? (tank.vol / tank.cap) * 100 : 0
  const overCapacity = rawPct > 105 // small tolerance for rounding, not a real overflow
  const pct = tank.cap > 0 ? Math.round(rawPct) : 0
  const barPct = Math.min(100, pct)
  const isAgo = tank.product === "AGO"

  return (
    <div className="mb-3.5 flex items-center gap-3 last:mb-0">
      <div className="w-[58px] flex-shrink-0">
        <div className="text-xs font-extrabold" style={{ color: overCapacity ? "#DC2626" : idColor(pct) }}>
          {tank.id}
        </div>
        <div className="mt-px text-[9px] text-ink-4">
          {tank.product} · {tank.pumps}
        </div>
      </div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-border bg-surface">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${
            barPct === 0 ? "" : overCapacity ? "bg-red" : isAgo ? "bg-gradient-to-r from-[#1188B5] to-[var(--brand-accent)]" : "bg-gradient-to-r from-cyan-dark to-cyan"
          }`}
          style={{ width: `${barPct}%`, background: barPct === 0 ? "#E8EDF5" : undefined }}
        />
      </div>
      <div className="flex w-[106px] flex-shrink-0 items-center justify-end gap-1.5">
        <div className="mono text-[11.5px] font-bold text-ink">{litres(tank.vol)}</div>
        <div className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${overCapacity ? "bg-red-light text-red" : pctClass(pct)}`}>
          {overCapacity ? "Check ⚠" : `${pct}%`}
        </div>
      </div>
    </div>
  )
}

export default function TankLevelsCard({ status, tankLevels }) {
  const loading = status === "loading" || status === "idle"
  const hasData = tankLevels && tankLevels.length > 0

  const critical =
    hasData &&
    tankLevels.filter(
      t => t.product === "PMS" && t.cap > 0 && Math.round((t.vol / t.cap) * 100) <= 10
    )

  return (
    <div className="h-full overflow-hidden rounded-panel border border-border bg-white shadow-card transition-all duration-300 hover:-translate-y-[2px] hover:shadow-lift">
      <div className="flex items-start justify-between gap-2.5 border-b border-surface px-[18px] py-3.5">
        <div>
          <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">Live Tank Levels</div>
          <div className="mt-0.5 text-[10.5px] text-ink-4">4 tanks · latest dip reading</div>
        </div>
      </div>

      <div className="p-[18px]">
        {loading || !hasData ? (
          <div className="space-y-3.5">
            {[0, 1, 2, 3].map(i => (
              <span key={i} className="skel block h-[10px] w-full rounded-full" />
            ))}
          </div>
        ) : (
          <>
            {tankLevels.map(t => (
              <TankRow key={t.id} tank={t} />
            ))}
            {critical.length > 0 && (
              <div className="mt-3.5 flex items-center gap-2 rounded-[10px] border border-[#FECACA] bg-red-light px-[13px] py-[9px] text-xs font-semibold text-red">
                <i className="bi bi-exclamation-triangle-fill flex-shrink-0" />
                {critical.map(t => t.id).join(" & ")} critically low — discharge needed.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
