import React, { useEffect, useState } from "react"
import { activeStation } from "../../utils/station"
import { naira } from "../../utils/format"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

/**
 * Shows the day's actual money — collected, expenses, cash to bank, variance
 * — right in the approve/reject confirmation, so a CEO or GM never has to
 * approve blind or hunt down a separate page first. Tapping Approve on the
 * dashboard alert used to fire immediately with zero preview; this is the fix.
 */
export default function ApprovalPreviewModal({ date, username, onApprove, onReject, onClose }) {
  const [report, setReport] = useState(null)
  const [status, setStatus] = useState("loading")

  useEffect(() => {
    if (!SCRIPT_URL || !date) return
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getDailyReport")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)
    url.searchParams.set("username", username || "")
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (d.ok) { setReport(d.report); setStatus("ready") }
        else setStatus("error")
      })
      .catch(() => setStatus("error"))
  }, [date, username])

  const collected = report ? (report.pos_mp || 0) + (report.pos_zm || 0) + (report.cash || 0) + (report.trf_mp || 0) + (report.trf_zb || 0) : 0
  const expected = report ? (report.pms_revenue || 0) + (report.ago_revenue || 0) : 0
  const variance = collected - expected
  const varianceLabel = Math.abs(variance) < 1 ? "Balanced" : variance < 0 ? "Shortage" : "Surplus"
  const varianceColor = Math.abs(variance) < 1 ? "text-green" : variance < 0 ? "text-red" : "text-cyan"

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[22px] bg-white sm:rounded-[22px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-surface px-5 py-4">
          <div>
            <div className="text-[15px] font-extrabold text-ink">Cash Reconciliation</div>
            <div className="text-[12px] text-ink-4">{date}</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-4 active:bg-surface">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="px-5 py-4">
          {status === "loading" && (
            <div className="flex justify-center py-10"><span className="h-6 w-6 animate-spin-fast rounded-full border-2 border-ink-4/30 border-t-ink-4" /></div>
          )}
          {status === "error" && (
            <div className="py-8 text-center text-[13px] text-ink-4">Couldn't load this day's figures. You can still open the full summary instead.</div>
          )}
          {status === "ready" && report && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-[13px] bg-surface p-3">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Collected</div>
                  <div className="mono mt-0.5 text-[15px] font-extrabold text-ink">{naira(collected)}</div>
                </div>
                <div className="rounded-[13px] bg-surface p-3">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Expenses</div>
                  <div className="mono mt-0.5 text-[15px] font-extrabold text-red">−{naira(report.total_expenses || 0)}</div>
                </div>
                <div className="rounded-[13px] bg-green-light p-3">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-green">Cash to Bank</div>
                  <div className="mono mt-0.5 text-[15px] font-extrabold text-green">{naira(report.to_bank || 0)}</div>
                </div>
                <div className="rounded-[13px] bg-surface p-3">
                  <div className={`text-[9.5px] font-bold uppercase tracking-[0.5px] ${varianceColor}`}>Variance</div>
                  <div className={`mono mt-0.5 text-[15px] font-extrabold ${varianceColor}`}>{naira(variance)} · {varianceLabel}</div>
                </div>
              </div>

              {report.expense_items && report.expense_items.length > 0 && (
                <div className="mb-4">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Expense breakdown</div>
                  <div className="space-y-1 rounded-[13px] border border-border p-3">
                    {report.expense_items.map((e, i) => (
                      <div key={i} className="flex justify-between text-[12px] text-ink-3">
                        <span>{e.description || "Expense"}</span>
                        <span className="mono font-semibold">−{naira(Number(e.amount) || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2.5 border-t border-surface px-5 py-4">
          <button type="button" onClick={() => onReject(date)}
            className="flex-1 rounded-[12px] border border-red/25 bg-red-light py-3 text-[13.5px] font-bold text-red">
            Reject
          </button>
          <button type="button" onClick={() => onApprove(date)}
            className="flex-1 rounded-[12px] bg-green py-3 text-[13.5px] font-bold text-white">
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}
