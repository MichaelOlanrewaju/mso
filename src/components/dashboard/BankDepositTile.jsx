import React from "react"
import { useNavigate } from "react-router-dom"
import { canLogBankDeposit } from "../../hooks/useBankDeposits"
import { activeStation } from "../../utils/station"

/* Visible ONLY to the two people who actually do the bank run — a username
   allowlist, not a role check, since "who does the bank run" doesn't map
   cleanly onto a role. Everyone else on the GM dashboard simply doesn't see
   this tile; it renders nothing for them. */
export default function BankDepositTile({ username, role }) {
  const navigate = useNavigate()
  if (!canLogBankDeposit(username, role)) return null

  return (
    <button
      type="button"
      onClick={() => navigate(`/bank-deposits/${activeStation()}`)}
      className="flex w-full items-center gap-3 rounded-card border border-border bg-white p-4 text-left shadow-card"
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--brand-accent-light)" }}>
        <i className="bi bi-bank text-[18px]" style={{ color: "var(--brand-accent)" }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-extrabold text-ink">Bank Deposits</div>
        <div className="text-[11px] text-ink-4">Log a deposit · view Cash At Hand</div>
      </div>
      <i className="bi bi-chevron-right text-ink-4" />
    </button>
  )
}
