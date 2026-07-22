import React from "react"
import { useBankDeposits } from "../../hooks/useBankDeposits"
import { activeStation } from "../../utils/station"
import { naira } from "../../utils/format"

/* Read-only for everyone who can see it — this is the number an owner or CEO
   checks against what the cashier counts in the safe. Logging an actual
   deposit (the only thing that reduces it) is restricted elsewhere to the two
   people who do the bank run; this card never lets anyone edit it. */
export default function CashAtHandCard() {
  const { cashAtHand, lastDepositDate, loading } = useBankDeposits(activeStation())

  return (
    <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="flex items-center justify-between p-4">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.8px] text-ink-4">
            <i className="bi bi-cash-stack" /> Cash At Hand
          </div>
          <div className="mono mt-1 text-[24px] font-black tracking-tight text-ink">
            {loading ? "…" : naira(cashAtHand || 0)}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-4">
            {lastDepositDate ? `Last deposit: ${lastDepositDate}` : "No deposits logged yet"}
          </div>
        </div>
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--brand-primary-light)" }}>
          <i className="bi bi-safe2 text-[18px]" style={{ color: "var(--brand-primary)" }} />
        </div>
      </div>
    </div>
  )
}
