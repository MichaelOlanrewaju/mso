import React, { useState } from "react"
import { useNavigate } from "react-router-dom"

function monthLabel(month) {
  if (!month) return ""
  const [y, m] = month.split("-")
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-NG", { month: "long", year: "numeric" })
}

export default function PayrollApprovalCard({ pendingPayroll = [], onApprove, onReject }) {
  const navigate = useNavigate()
  const [processing, setProcessing] = useState(null) // which month is being processed

  if (!pendingPayroll.length) return null

  const handle = async (month, decision) => {
    setProcessing(month)
    if (decision === "approve") await onApprove(month)
    else await onReject(month)
    setProcessing(null)
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-surface px-[18px] py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-light">
            <i className="bi bi-clock-fill text-[11px] text-amber" />
          </div>
          <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">Payroll Approval</div>
        </div>
        <span className="inline-flex items-center rounded-full border border-amber/30 bg-amber-light px-2.5 py-px text-[10.5px] font-bold text-amber">
          {pendingPayroll.length} pending
        </span>
      </div>

      <div>
        {pendingPayroll.map((p, idx) => {
          const isProcessing = processing === p.month
          return (
            <div key={p.month}
              className={`px-[18px] py-4 ${idx < pendingPayroll.length - 1 ? "border-b border-surface" : ""}`}>
              {/* Month header */}
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13.5px] font-extrabold text-ink">{monthLabel(p.month)}</div>
                  <div className="text-[11px] text-ink-4">
                    {p.staffCount} staff · Prepared by {p.preparedBy || "GM"}
                  </div>
                </div>
                <button type="button"
                  onClick={() => navigate(`/payroll-mso?month=${p.month}`)}
                  className="flex-shrink-0 text-[11px] font-semibold text-cyan-dark underline-offset-2 hover:underline">
                  View detail →
                </button>
              </div>

              {/* Net pay total */}
              <div className="mb-3 flex items-center gap-3 rounded-[10px] bg-surface px-3.5 py-2.5">
                <div>
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Total Net Payroll</div>
                  <div className="mono text-[18px] font-extrabold text-navy">
                    ₦{Math.round(p.totalNet).toLocaleString("en-NG")}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Period</div>
                  <div className="text-[13px] font-bold text-ink">{monthLabel(p.month)}</div>
                </div>
              </div>

              {/* Approve / Reject */}
              <div className="flex gap-2">
                <button type="button"
                  disabled={isProcessing}
                  onClick={() => handle(p.month, "reject")}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-red/20 bg-red-light py-2.5 text-[12.5px] font-bold text-red disabled:opacity-50">
                  {isProcessing
                    ? <span className="h-3.5 w-3.5 animate-spin-fast rounded-full border-2 border-red/30 border-t-red" />
                    : <i className="bi bi-x-lg text-[11px]" />
                  }
                  Reject
                </button>
                <button type="button"
                  disabled={isProcessing}
                  onClick={() => handle(p.month, "approve")}
                  className="flex flex-[2] items-center justify-center gap-1.5 rounded-[9px] bg-green py-2.5 text-[12.5px] font-bold text-white shadow-lift disabled:opacity-50">
                  {isProcessing
                    ? <span className="h-3.5 w-3.5 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" />
                    : <i className="bi bi-check2 text-[13px]" />
                  }
                  Approve Payroll
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
