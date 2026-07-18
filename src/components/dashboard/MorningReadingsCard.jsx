import React from "react"
/* Tanks and pumps are per-station now — M&M has no TK3, and its pumps map
   to different tanks. Reading a shared config that assumed MSO's layout would
   have collected dips for a tank that does not exist. */
import { tanksFor, pumpsFor } from "../../config/stations"
import { activeStation } from "../../utils/station"

/**
 * The morning submission, made visible.
 *
 * The opening dip and the opening pump meters are the first real work of the
 * station's day, and until now a GM opening the dashboard had no way to see
 * either. The tank side was buried inside DipSummaryCard (mixed in with closing
 * figures that don't exist yet), and the pump side wasn't rendered anywhere at
 * all — `data.pumpMetres` was being fetched from getDashboard and silently
 * dropped on the floor.
 *
 * So this card answers, in one place: has the morning been done, and what are
 * the actual numbers?
 *
 * It stays on the page all day rather than vanishing at close-out — the opening
 * readings are what the closing figures get measured against, so they're worth
 * keeping in view, not only while you're waiting for them.
 *
 * No new API calls: tankLevels and pumpMetres both already come from
 * getDashboard.
 */

/* A tank's opening level, with a fill bar — the number alone doesn't tell you
   whether 4,200L is comfortable or nearly empty. The bar does. */
function TankRow({ tank, vol }) {
  const cap = tank.cap || 0
  const pct = cap > 0 ? Math.min(100, Math.round((vol / cap) * 100)) : 0
  const low = pct <= 20 && vol > 0
  const unit = tank.unit === "KG" ? "KG" : "L"
  const tint =
    tank.product === "AGO" ? "#7C3AED" : tank.product === "LPG" ? "#F59E0B" : "var(--brand-accent)"

  return (
    <div className="border-b border-surface px-[18px] py-3 last:border-none">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-extrabold text-ink">{tank.id}</span>
          <span
            className="rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.5px]"
            style={{ background: `${tint}18`, color: tint }}
          >
            {tank.product}
          </span>
          {low && (
            <span className="rounded-full bg-red-light px-1.5 py-px text-[9px] font-extrabold uppercase tracking-[0.5px] text-red">
              Low
            </span>
          )}
        </div>
        <div className="mono text-[13px] font-extrabold tabular-nums text-ink">
          {vol > 0 ? `${Math.round(vol).toLocaleString("en-NG")}${unit}` : "—"}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2.5">
        <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${pct}%`,
              background: low
                ? "linear-gradient(90deg,#DC2626,#F87171)"
                : `linear-gradient(90deg,${tint},var(--brand-primary))`,
            }}
          />
        </div>
        <span className="mono w-[34px] shrink-0 text-right text-[10px] font-bold tabular-nums text-ink-4">
          {pct}%
        </span>
      </div>
    </div>
  )
}

/* One pump's opening meter. The reading itself is the point — a GM checking the
   morning's work wants the actual number the supervisor typed, not a total
   derived from it. */
function PumpRow({ id, reading }) {
  const open = reading?.open || 0
  const done = open > 0

  return (
    <div className="flex items-center justify-between border-b border-surface px-[18px] py-2.5 last:border-none">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[10px] font-extrabold"
          style={
            done
              ? { background: "var(--brand-accent-light)", color: "var(--brand-accent-dark)" }
              : { background: "#F8FAFC", color: "#94A3B8" }
          }
        >
          {id}
        </span>
        <div className="min-w-0">
          <div className="text-[11.5px] font-bold text-ink">{reading?.tank || "—"}</div>
          <div className="text-[9.5px] font-medium text-ink-4">Opening meter</div>
        </div>
      </div>
      {done ? (
        <div className="mono text-[13px] font-extrabold tabular-nums text-ink">
          {Math.round(open).toLocaleString("en-NG")}
        </div>
      ) : (
        <span className="rounded-full bg-surface px-2 py-1 text-[9.5px] font-bold text-ink-4">
          Not read
        </span>
      )}
    </div>
  )
}

export default function MorningReadingsCard({ status, tankLevels, pumpMetres, submittedBy }) {
  const loading = status === "loading" || status === "idle"

  const pumpIds = pumpMetres ? Object.keys(pumpMetres) : []
  const dipped = (tankLevels || []).filter(t => (t.vol || 0) > 0)
  const hasAnything = dipped.length > 0 || pumpIds.length > 0

  /* Nothing submitted yet → render nothing. DayHero already says "Waiting on
     the opening dip" in that state, and repeating it on a second card directly
     underneath just says the same sentence twice. This card's job is to show
     the READINGS; with no readings it has no job. The section heading above it
     is hidden too (see the dashboard pages), so no orphaned label is left
     behind. */
  if (!loading && !hasAnything) return null

  if (loading) {
    return (
      <div className="h-full overflow-hidden rounded-panel border border-border bg-white shadow-card">
        <div className="border-b border-surface px-[18px] py-3.5">
          <span className="skel inline-block h-4 w-40" />
        </div>
        <div className="space-y-3 p-[18px]">
          {[0, 1, 2, 3].map(i => (
            <span key={i} className="skel block h-4 w-full" />
          ))}
        </div>
      </div>
    )
  }

  /* Merge the tank config with today's levels, so a tank that hasn't been dipped
     still appears (as "—") instead of silently vanishing from the list — an
     absent tank is information too. LPG is hidden unless it's actually in use. */
  const tankRows = tanksFor(activeStation()).map(t => {
    const level = (tankLevels || []).find(
      l => String(l.id).replace(/\s+/g, "") === t.id
    )
    return { tank: t, vol: level?.vol || 0 }
  }).filter(r => r.vol > 0 || r.tank.product !== "LPG")

  return (
    <div className="h-full overflow-hidden rounded-panel border border-border bg-white shadow-card transition-all duration-300 hover:-translate-y-[2px] hover:shadow-lift">
      <div className="flex items-start justify-between gap-2.5 border-b border-surface px-[18px] py-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: hasAnything ? "#F0FDF4" : "#F8FAFC" }}
          >
            <i
              className={`bi ${hasAnything ? "bi-check-lg" : "bi-sunrise"} text-[15px]`}
              style={{ color: hasAnything ? "#16A34A" : "#94A3B8" }}
            />
          </span>
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">
              This morning
            </h3>
            <p className="mt-0.5 text-[10.5px] text-ink-4">
              {submittedBy
                ? `Opening readings · submitted by ${submittedBy}`
                : "Opening dip and pump readings"}
            </p>
          </div>
        </div>
        {hasAnything && (
          <span className="inline-flex shrink-0 items-center rounded-full border border-green/20 bg-green-light px-2.5 py-[3px] text-[10px] font-bold text-green">
            Submitted
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="min-w-0">
            <div className="bg-surface px-[18px] py-2 text-[9.5px] font-extrabold uppercase tracking-[1px] text-ink-4">
              Tank dip · opening
            </div>
            {tankRows.map(r => (
              <TankRow key={r.tank.id} tank={r.tank} vol={r.vol} />
            ))}
          </div>

          <div className="min-w-0">
            <div className="bg-surface px-[18px] py-2 text-[9.5px] font-extrabold uppercase tracking-[1px] text-ink-4">
              Pump meters · opening
            </div>
            {pumpIds.length === 0 ? (
              <div className="px-[18px] py-9 text-center text-[11.5px] text-ink-4">
                No pump readings submitted yet.
              </div>
            ) : (
              pumpIds.sort().map(id => <PumpRow key={id} id={id} reading={pumpMetres[id]} />)
            )}
        </div>
      </div>
    </div>
  )
}
