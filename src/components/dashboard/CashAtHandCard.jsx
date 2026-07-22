import React from "react"
import { useNavigate } from "react-router-dom"
import { useBankDeposits } from "../../hooks/useBankDeposits"
import { activeStation } from "../../utils/station"
import { naira } from "../../utils/format"

/* Read-only for everyone who can see it — this is the number an owner or CEO
   checks against what the cashier counts in the safe. Logging an actual
   deposit (the only thing that reduces it) is restricted elsewhere to the two
   people who do the bank run; this card never lets anyone edit it. */
export default function CashAtHandCard() {
  const navigate = useNavigate()
  const { needsSetup, cashAtHand, lastDepositDate, loading } = useBankDeposits(activeStation())

  return (
    <button
      type="button"
      onClick={() => navigate(`/bank-deposits/${activeStation()}`)}
      className="block w-full overflow-hidden rounded-card border border-border bg-white text-left shadow-card active:opacity-90"
    >
      <div className="flex items-center justify-between p-4">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.8px] text-ink-4">
            <i className="bi bi-cash-stack" /> Cash At Hand
          </div>
          <div className="mono mt-1 text-[24px] font-black tracking-tight text-ink">
            {loading ? "…" : needsSetup ? "Not set up" : naira(cashAtHand || 0)}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-4">
            {needsSetup ? "Tap to set a starting point" : lastDepositDate ? `Last deposit: ${lastDepositDate}` : "No deposits logged yet"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--brand-primary-light)" }}>
            <i className="bi bi-safe2 text-[18px]" style={{ color: "var(--brand-primary)" }} />
          </div>
          <i className="bi bi-chevron-right text-ink-4" />
        </div>
      </div>
      <div className="border-t border-surface bg-surface/50 px-4 py-2 text-[11px] font-semibold text-ink-3">
        Tap to see the full deposit history and proof photos
      </div>
    </button>
  )
}
