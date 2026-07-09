import React from "react"
import { naira } from "../../utils/format"

// NOTE: ExpensesCard is only ever rendered on owner/GM dashboards. Adding
// an expense is a supervisor/cashier task, so this card is view-only here —
// no "Add" link into the entry form.
export default function ExpensesCard({ status, expensesTotal }) {
  const loading = status === "loading" || status === "idle"
  const total = Number(expensesTotal || 0)

  return (
    <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="flex items-start justify-between gap-2.5 border-b border-surface px-[18px] py-3.5">
        <div>
          <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">Expenses</div>
          <div className="mt-0.5 text-[10.5px] text-ink-4">
            {loading ? <span className="skel inline-block h-3 w-16" /> : `${naira(total)} today`}
          </div>
        </div>
      </div>
      <div className="px-[18px] py-[22px] text-center text-[12.5px] text-ink-4">
        <i className="bi bi-check-circle mb-2 block text-[28px] text-border" />
        {total > 0 ? "No itemized expenses yet" : "Nothing spent today"}
      </div>
    </div>
  )
}
