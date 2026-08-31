import React from "react"
import Sparkline from "./Sparkline"
import { naira, litres, litresValue } from "../../utils/format"

/**
 * The headline card — the day's number AND the day's progress, in one place.
 *
 * Two things this gets right that the previous version didn't:
 *
 * 1. A petrol station's day has PHASES. The supervisor dips the tanks and reads
 *    the pumps in the morning; price, closing meters and cash-up only land in
 *    the evening. A hero built purely around grandTotal therefore says "nothing
 *    recorded" from 6am until close — which is untrue, hides real work, and
 *    makes the dashboard look broken exactly when a GM is managing the day.
 *
 * 2. An empty day should say what's EXPECTED, not print zeros. "PMS sold 0L
 *    ₦0" is noise dressed as data. When nothing has been submitted, the split
 *    row is dropped entirely and the card says what it's waiting for.
 *
 * The 1-2-3 close-out sequence lives in here rather than in its own card,
 * because on a quiet morning it's the most useful thing the hero can show —
 * and on a busy day it's still the answer to "where are we up to?".
 *
 * Every value comes from getDashboard. Nothing new is fetched.
 */

function Chip({ tone = "muted", pulse, children }) {
  const tones = {
    live: { bg: "rgba(34,197,94,.16)", fg: "#4ADE80" },
    open: { bg: "rgba(23,157,208,.18)", fg: "#7FCDEA" },
    up: { bg: "rgba(34,197,94,.16)", fg: "#4ADE80" },
    down: { bg: "rgba(239,68,68,.16)", fg: "#FCA5A5" },
    muted: { bg: "rgba(255,255,255,.08)", fg: "rgba(255,255,255,.65)" },
  }
  const t = tones[tone] || tones.muted
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
      style={{ background: t.bg, color: t.fg }}
    >
      {pulse && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: t.fg }} />
      )}
      {children}
    </span>
  )
}

function Split({ label, value, sub, tint }) {
  return (
    <div className="min-w-0 flex-1 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: tint }} />
        <span className="truncate text-[9.5px] font-bold uppercase tracking-[0.8px] text-white/45">
          {label}
        </span>
      </div>
      <div className="mono mt-1 truncate text-[15px] font-extrabold leading-none text-white">
        {value}
      </div>
      {sub && <div className="mono mt-1 truncate text-[10.5px] text-white/40">{sub}</div>}
    </div>
  )
}

/* ── The day's close-out, on the gradient ──────────────────────────────
   These three steps are strictly ordered — cash-up can't happen before the
   closing dip, which can't happen before the opening one. So they're numbered,
   and the rail between them fills only when the step before is genuinely done.
   A half-filled rail reads as "this is where the day stopped." */
const STEPS = [
  { key: "opening", n: 1, icon: "bi-sunrise", label: "Opening Dip" },
  { key: "closing", n: 2, icon: "bi-moon-stars", label: "Closing Dip" },
  { key: "cash", n: 3, icon: "bi-cash-stack", label: "Cash Recon" },
]

function Step({ step, state }) {
  const done = state === "done"
  const active = state === "active"

  const fg = done ? "#4ADE80" : active ? "#FFFFFF" : "rgba(255,255,255,.35)"
  const bg = done
    ? "rgba(34,197,94,.18)"
    : active
    ? "rgba(255,255,255,.16)"
    : "rgba(255,255,255,.05)"
  const ring = done
    ? "rgba(74,222,128,.55)"
    : active
    ? "rgba(255,255,255,.45)"
    : "rgba(255,255,255,.12)"

  return (
    <li className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-[12px] border transition-all duration-300 ${
          active ? "scale-105" : ""
        }`}
        style={{
          background: bg,
          borderColor: ring,
          boxShadow: active ? "0 4px 14px rgba(0,0,0,.18)" : "none",
        }}
      >
        <i
          className={`bi ${done ? "bi-check-lg" : step.icon} text-[14px]`}
          style={{ color: fg }}
        />
        <span
          className="absolute -right-1 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full text-[8.5px] font-extrabold"
          style={{
            background: done ? "#22C55E" : active ? "var(--brand-accent)" : "rgba(255,255,255,.18)",
            color: done || active ? "#fff" : "rgba(255,255,255,.5)",
          }}
        >
          {step.n}
        </span>
      </span>
      <span
        className="text-center text-[9px] font-bold uppercase leading-tight tracking-[0.5px]"
        style={{ color: done ? "rgba(74,222,128,.9)" : active ? "#fff" : "rgba(255,255,255,.4)" }}
      >
        {step.label}
      </span>
      <span
        className="text-[9.5px] font-extrabold leading-none"
        style={{ color: done ? "#4ADE80" : active ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.3)" }}
      >
        {done ? "Done" : active ? "Pending" : "—"}
      </span>
    </li>
  )
}

function Connector({ filled }) {
  return (
    <li aria-hidden className="mt-[18px] h-[2px] w-5 shrink-0 overflow-hidden rounded-full bg-white/10 sm:w-8">
      <span
        className="block h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: filled ? "100%" : "0%", background: "#22C55E" }}
      />
    </li>
  )
}

function CloseOut({ todayStatus, loading }) {
  const opening = Boolean(todayStatus?.openingDip)
  const closing = Boolean(todayStatus?.closingDip)
  const cash = Boolean(todayStatus?.cashierRecon)
  const doneCount = [opening, closing, cash].filter(Boolean).length

  const stateOf = key => {
    if (key === "opening") return opening ? "done" : "active"
    if (key === "closing") return closing ? "done" : opening ? "active" : "locked"
    return cash ? "done" : closing ? "active" : "locked"
  }

  return (
    <div className="border-t border-white/10 bg-black/[0.14] px-5 py-4">
      <div className="mb-3.5 flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-[1.2px] text-white/40">
          Today&rsquo;s close-out
        </span>
        {!loading && (
          <span
            className="rounded-full px-2 py-0.5 text-[9.5px] font-extrabold"
            style={
              doneCount === 3
                ? { background: "rgba(34,197,94,.18)", color: "#4ADE80" }
                : { background: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.7)" }
            }
          >
            {doneCount === 3 ? "Complete" : `${doneCount} of 3`}
          </span>
        )}
      </div>
      <ol className="flex items-start justify-center">
        {STEPS.map((step, i) => (
          <React.Fragment key={step.key}>
            {i > 0 && <Connector filled={i === 1 ? opening : closing} />}
            <Step step={step} state={stateOf(step.key)} />
          </React.Fragment>
        ))}
      </ol>
    </div>
  )
}

function stockOnHand(tankLevels) {
  if (!tankLevels?.length) return null
  const pms = tankLevels.filter(t => t.product === "PMS").reduce((s, t) => s + (t.vol || 0), 0)
  const ago = tankLevels.filter(t => t.product === "AGO").reduce((s, t) => s + (t.vol || 0), 0)
  /* LPG is sold and stocked by the KILOGRAM, never litres — kept as its
     own field here rather than folded into "total", the same reasoning
     already applied to keeping PMS and AGO separate: summing different
     units together produces a number that means nothing. */
  const lpg = tankLevels.filter(t => t.product === "LPG").reduce((s, t) => s + (t.vol || 0), 0)
  return { pms, ago, lpg, total: pms + ago }
}

export default function DayHero({ status, data }) {
  const loading = status === "loading" || status === "idle"
  const opening = status === "opening"
  const noData = status === "no-data" || status === "error"
  const live = Boolean(data?.live)

  const trend =
    data?.weekly?.days?.length > 1
      ? data.weekly.days.map((_, i) => (data.weekly.pms[i] || 0) + (data.weekly.ago[i] || 0))
      : null

  const today = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  const stock = stockOnHand(data?.tankLevels)
  const pumpCount = data?.pumpMetres ? Object.keys(data.pumpMetres).length : 0

  let eyebrow = "Takings today"
  let headline = null
  let chip = null

  if (loading) {
    headline = <span className="skel-dark inline-block h-9 w-[190px] align-middle" />
  } else if (opening) {
    /* PMS and AGO must never be summed. They're different products at different
       prices — 33,500 L of petrol plus 600 L of diesel is not "34,100 L of
       fuel", it's a number that means nothing. So the hero leads with PMS (the
       main product, the big mover) and AGO gets its own line to the side. The
       split row below already breaks both out; this just stops the headline
       merging them. */
    eyebrow = "PMS on hand"
    headline = (
      <span className="flex items-baseline gap-3">
        <span className="animate-count-in text-[32px] font-extrabold leading-none tracking-[-0.03em] text-white md:text-[38px]">
          {stock ? litres(stock.pms) : "—"}
        </span>
        {stock && stock.ago > 0 && (
          <span className="flex items-baseline gap-1 whitespace-nowrap text-white/55">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: "#B69CF0" }}>+ AGO</span>
            <span className="mono text-[15px] font-bold text-white/80 md:text-[17px]">{litres(stock.ago)}</span>
          </span>
        )}
        {/* LPG kept as its own line, same treatment as AGO — never
            summed with PMS/AGO's litres, since it's measured in KG. */}
        {stock && stock.lpg > 0 && (
          <span className="flex items-baseline gap-1 whitespace-nowrap text-white/55">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: "#F0B429" }}>+ LPG</span>
            <span className="mono text-[15px] font-bold text-white/80 md:text-[17px]">{litresValue(stock.lpg, { maximumFractionDigits: 0 })}KG</span>
          </span>
        )}
      </span>
    )
    chip = <Chip tone="open" pulse>Day underway · awaiting closing dip</Chip>
  } else if (noData) {
    // An empty day gets a sentence, not a zero. Zeros imply "we sold nothing";
    // the truth is "nobody has submitted anything yet", which is actionable.
    eyebrow = "Today"
    headline = (
      <span className="text-[19px] font-bold leading-snug text-white/85 md:text-[21px]">
        Waiting on the opening dip
      </span>
    )
    chip = <Chip>Nothing submitted yet today</Chip>
  } else {
    headline = (
      <span className="animate-count-in text-[32px] font-extrabold leading-none tracking-[-0.03em] text-white md:text-[38px]">
        {naira(data.grandTotal)}
      </span>
    )
    if (live) {
      chip = <Chip tone="live" pulse>Running total · cash-up pending</Chip>
    } else if (data.totalChange !== null && data.totalChange !== undefined) {
      const up = data.totalChange >= 0
      chip = (
        <Chip tone={up ? "up" : "down"}>
          <i className={`bi ${up ? "bi-arrow-up-right" : "bi-arrow-down-right"} text-[10px]`} />
          {up ? "+" : ""}
          {data.totalChange}% <span className="font-semibold opacity-70">vs yesterday</span>
        </Chip>
      )
    }
  }

  // The split row only earns its place when it has something to say. On an
  // empty day it's three columns of zeros — so it doesn't render at all.
  const showSplit = loading || opening || !noData

  return (
    <section
      aria-label="Today at a glance"
      className="dot-grid relative overflow-hidden rounded-panel border border-deepnavy-2 shadow-hero"
      style={{ background: "var(--brand-gradient-btn)" }}
    >
      <span
        aria-hidden
        className="animate-sheen pointer-events-none absolute inset-y-0 left-0 z-[1] w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle,rgba(23,157,208,.38),transparent 68%)" }}
      />

      <div className="relative z-[2] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-white/40">
              {eyebrow} · {today}
            </p>
            <div className="mono mt-2 flex items-baseline gap-3">{headline}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {loading ? <span className="skel-dark inline-block h-5 w-32" /> : chip}
            </div>
          </div>

          {trend && !loading && (
            <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
              <span className="text-[9.5px] font-bold uppercase tracking-[1px] text-white/35">
                Last 7 days
              </span>
              <div className="opacity-90">
                <Sparkline data={trend} />
              </div>
            </div>
          )}
        </div>
      </div>

      {showSplit && (
        <div className="relative z-[2] flex divide-x divide-white/10 border-t border-white/10 bg-black/10">
          {loading ? (
            <>
              <div className="flex-1 px-4 py-4">
                <span className="skel-dark inline-block h-4 w-24" />
              </div>
              <div className="flex-1 px-4 py-4">
                <span className="skel-dark inline-block h-4 w-24" />
              </div>
              <div className="hidden flex-1 px-4 py-4 sm:block">
                <span className="skel-dark inline-block h-4 w-24" />
              </div>
            </>
          ) : opening ? (
            <>
              <Split label="PMS in tanks" tint="var(--brand-accent)" value={stock ? litres(stock.pms) : "—"} sub="From opening dip" />
              <Split label="AGO in tanks" tint="#7C3AED" value={stock ? litres(stock.ago) : "—"} sub="From opening dip" />
              {/* Hidden on mobile, same as Pumps read already was — tested
                  directly: 4 columns at phone width wrapped and looked
                  cramped, but reads cleanly from tablet width up. Mobile
                  users still see LPG in the headline above this row. */}
              {stock && stock.lpg > 0 && (
                <div className="hidden flex-1 sm:block">
                  <Split label="LPG in tanks" tint="#F0B429" value={`${litresValue(stock.lpg, { maximumFractionDigits: 0 })}KG`} sub="From opening dip" />
                </div>
              )}
              <div className="hidden flex-1 sm:block">
                <Split
                  label="Pumps read"
                  tint="#22C55E"
                  value={pumpCount ? String(pumpCount) : "—"}
                  sub={pumpCount ? "Opening readings in" : "None yet"}
                />
              </div>
            </>
          ) : (
            <>
              <Split label="PMS sold" tint="var(--brand-accent)" value={litres(data?.pmsLitres)} sub={naira(data?.pmsRevenue)} />
              <Split label="AGO sold" tint="#7C3AED" value={litres(data?.agoLitres)} sub={naira(data?.agoRevenue)} />
              <div className="hidden flex-1 sm:block">
                <Split
                  label="To bank"
                  tint="#22C55E"
                  value={naira(data?.cashToBank)}
                  sub={data?.expenses ? `${naira(data.expenses)} expenses` : "No expenses"}
                />
              </div>
            </>
          )}
        </div>
      )}

      <div className="relative z-[2]">
        <CloseOut todayStatus={data?.todayStatus} loading={loading} />
      </div>
    </section>
  )
}
