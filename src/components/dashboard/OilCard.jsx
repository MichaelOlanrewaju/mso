import React from "react"
import { useLubricantSummary } from "../../hooks/useLubricant"
import { naira } from "../../utils/format"

/**
 * Oil, for the owner and GM.
 *
 * Revenue, cost of goods, margin, stock value — and the flags that need a human.
 *
 * The margin figure carries a caveat that matters: it can only count products
 * that HAVE a cost price. If the GM hasn't entered costs from the supplier
 * invoice yet, cost-of-goods is understated and margin looks better than it is.
 * Rather than quietly reporting a flattering number, the card says so.
 */

function Stat({ label, value, sub, tint }) {
  return (
    <div className="min-w-0 flex-1 px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: tint }} />
        <span className="truncate text-[9.5px] font-bold uppercase tracking-[0.7px] text-ink-4">{label}</span>
      </div>
      <div className="mono mt-1 truncate text-[15px] font-extrabold leading-none text-ink">{value}</div>
      {sub && <div className="mono mt-1 truncate text-[10px] text-ink-4">{sub}</div>}
    </div>
  )
}

const FLAG_STYLE = {
  oversold: { icon: "bi-exclamation-triangle-fill", bg: "#FEE2E2", fg: "#DC2626" },
  out:      { icon: "bi-x-circle-fill",             bg: "#F1F5F9", fg: "#64748B" },
  low:      { icon: "bi-battery-half",              bg: "#FEF3C7", fg: "#D97706" },
  no_cost:  { icon: "bi-receipt",                   bg: "#FEF3C7", fg: "#D97706" },
  loss:     { icon: "bi-graph-down-arrow",          bg: "#FEE2E2", fg: "#DC2626" },
}

export default function OilCard() {
  const { status, summary } = useLubricantSummary()

  if (status === "loading") {
    return (
      <div className="h-full overflow-hidden rounded-panel border border-border bg-white p-4 shadow-card">
        <span className="skel mb-3 block h-4 w-24" />
        <span className="skel block h-16 w-full" />
      </div>
    )
  }
  if (status === "error" || !summary) return null

  const flags = summary.flags || []

  return (
    <div className="h-full overflow-hidden rounded-panel border border-border bg-white shadow-card transition-all duration-300 hover:-translate-y-[2px] hover:shadow-lift">
      <div className="flex items-center justify-between border-b border-surface px-[18px] py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-amber-light">
            <i className="bi bi-droplet-fill text-[15px] text-amber" />
          </span>
          <div>
            <h3 className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">Oil</h3>
            <p className="mt-0.5 text-[10.5px] text-ink-4">
              {summary.unitsSold} sold · {summary.stockUnits} on the shelf
            </p>
          </div>
        </div>
        {flags.length > 0 && (
          <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red px-1.5 text-[10.5px] font-extrabold text-white">
            {flags.length}
          </span>
        )}
      </div>

      <div className="flex divide-x divide-border border-b border-surface">
        <Stat label="Revenue" tint="var(--brand-accent)" value={naira(summary.revenue)} sub={`${summary.unitsSold} units`} />
        <Stat
          label="Margin"
          tint={summary.grossMargin >= 0 ? "#22C55E" : "#DC2626"}
          value={naira(summary.grossMargin)}
          sub={summary.marginReliable ? `${summary.marginPct}%` : "Partial — costs missing"}
        />
        <Stat label="Stock value" tint="#7C3AED" value={naira(summary.stockValue)} sub={`at cost`} />
      </div>

      {!summary.marginReliable && (
        <div className="flex items-start gap-2 border-b border-surface bg-amber-light px-[18px] py-2.5">
          <i className="bi bi-info-circle-fill mt-px text-[11px] text-amber" />
          <p className="text-[10.5px] leading-relaxed text-ink-2">
            Some products have no cost price, so margin is understated — the real figure is lower.
          </p>
        </div>
      )}

      {flags.length > 0 ? (
        <div className="max-h-[190px] overflow-y-auto">
          {flags.slice(0, 8).map((f, i) => {
            const st = FLAG_STYLE[f.type] || FLAG_STYLE.low
            return (
              <div key={`${f.product}-${f.type}-${i}`} className="flex items-start gap-2.5 border-b border-surface px-[18px] py-2.5 last:border-none">
                <span className="mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[7px]" style={{ background: st.bg }}>
                  <i className={`bi ${st.icon} text-[10px]`} style={{ color: st.fg }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] font-bold text-ink">{f.product}</div>
                  <div className="text-[10.5px] leading-snug text-ink-4">{f.note}</div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="px-[18px] py-4 text-center text-[11px] text-ink-4">
          Stock and pricing all look healthy.
        </p>
      )}
    </div>
  )
}
