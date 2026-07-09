import React from "react"
import { naira } from "../../utils/format"

export default function PaymentBreakdown({ status, payments }) {
  const loading = status === "loading" || status === "idle"
  const hasData = payments && payments.length > 0

  const total = hasData ? payments.reduce((s, p) => s + p.amount, 0) : 0

  return (
    <div className="h-full overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="border-b border-surface px-[18px] py-3.5">
        <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">Payment Breakdown</div>
        <div className="mt-0.5 text-[10.5px] text-ink-4">POS · Bank Transfer · Cash</div>
      </div>

      <div className="p-[18px]">
        {loading || !hasData ? (
          <>
            <span className="skel mb-4 block h-2 rounded" />
            <span className="skel mb-2.5 block h-3.5 rounded-md" />
            <span className="skel mb-2.5 block h-3.5 rounded-md" />
            <span className="skel block h-3.5 rounded-md" />
          </>
        ) : (
          <>
            <div className="mb-4 flex h-2 gap-0.5 overflow-hidden rounded">
              {payments.map(p => (
                <div
                  key={p.name}
                  className="h-full rounded-sm"
                  style={{ flex: p.amount, background: p.color }}
                />
              ))}
            </div>

            {payments.map(p => (
              <div key={p.name} className="flex items-center justify-between border-b border-surface py-[9px] last:border-none">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: p.color }} />
                  <div>
                    <div className="text-[12.5px] font-semibold text-ink">{p.name}</div>
                    <div className="mt-px text-[10.5px] text-ink-4">
                      {Math.round((p.amount / total) * 100)}%
                    </div>
                  </div>
                </div>
                <div className="mono text-[13.5px] font-bold text-ink">{naira(p.amount)}</div>
              </div>
            ))}

            <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5">
              <span className="text-[11.5px] text-ink-3">Grand Total</span>
              <span className="mono text-base font-extrabold text-navy">{naira(total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
