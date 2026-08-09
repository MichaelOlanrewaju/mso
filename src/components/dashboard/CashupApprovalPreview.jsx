import React from "react"
import { useRecordsData } from "../../hooks/useRecordsData"
import { naira } from "../../utils/format"
import { activeStation } from "../../utils/station"

/**
 * Shown when someone taps "Approve" on a pending cash reconciliation.
 *
 * Previously, Approve fired immediately — the report was only visible via a
 * separate "View" button, and nothing required looking at it first. So it was
 * genuinely possible to approve money without ever having seen the numbers.
 * This makes the report the thing you're looking at in the same moment you
 * decide, rather than trusting that whoever's approving already checked
 * separately.
 */
export default function CashupApprovalPreview({ date, onApprove, onReject, onClose }) {
  const { status, report } = useRecordsData(null, date)
  const loading = status === "loading"

  const expected = (report?.pms_revenue || 0) + (report?.ago_revenue || 0)
  /* Same bug found and fixed in Summary/Records: trf_zb doesn't exist under
     that name (the real field is trf_zb_amelia), and trf_fcmb_truck /
     trf_fcmb_md were entirely absent — confirmed directly on a real day
     where a ₦329,800 truck transfer produced a fabricated shortage here
     too, since this preview never picked up the earlier fix. */
  const collected = (report?.pos_mp || 0) + (report?.pos_zm || 0) + (report?.cash || 0)
    + (report?.trf_mp || 0) + (report?.trf_zb_amelia || 0) + (report?.trf_fcmb_truck || 0) + (report?.trf_fcmb_md || 0)
  const variance = collected - expected
  const varianceLabel = Math.abs(variance) < 1 ? "Balanced" : variance < 0 ? "Shortage" : "Surplus"
  const varianceColor = Math.abs(variance) < 1 ? "text-green" : variance < 0 ? "text-red" : "text-cyan"

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-t-[22px] bg-white sm:rounded-[22px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-surface bg-white px-5 py-4">
          <div>
            <div className="text-[15px] font-extrabold text-ink">Review before approving</div>
            <div className="text-[11.5px] text-ink-4">{date} · {activeStation() === "mrs" ? "M&M" : "MSO"}</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-4 active:bg-surface">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <span className="h-6 w-6 animate-spin-fast rounded-full border-2 border-ink-4/30 border-t-ink-4" />
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-[14px] bg-surface p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-ink-4">Cash to Bank</div>
                <div className="mono mt-1 text-[26px] font-black text-ink">{naira(report?.to_bank || 0)}</div>
              </div>

              <div className="mb-4 space-y-2">
                {[
                  ["POS (M.P)", report?.pos_mp],
                  ["POS (Z.M)", report?.pos_zm],
                  ["Transfer (M.P)", report?.trf_mp],
                  ["Cash", report?.cash],
                  ["Expenses", -(report?.total_expenses || 0)],
                ].map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-3">{label}</span>
                    <span className={`mono font-semibold ${val < 0 ? "text-red" : "text-ink"}`}>{naira(val || 0)}</span>
                  </div>
                ))}
              </div>

              {report?.expense_items?.length > 0 && (
                <div className="mb-4 rounded-[12px] border border-border p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.6px] text-ink-4">What the expenses were for</div>
                  {report.expense_items.map((e, i) => (
                    <div key={i} className="flex justify-between text-[12px] text-ink-3">
                      <span>{e.description}</span>
                      <span className="mono">{naira(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between rounded-[12px] border border-border px-4 py-3">
                <span className="text-[12.5px] font-bold text-ink-3">Variance</span>
                <div className="text-right">
                  <div className={`mono text-[15px] font-extrabold ${varianceColor}`}>{naira(variance)}</div>
                  <div className={`text-[10px] font-bold uppercase ${varianceColor}`}>{varianceLabel}</div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2.5 border-t border-surface bg-white px-5 py-4">
          <button
            type="button" onClick={onReject}
            className="flex h-[46px] flex-1 items-center justify-center rounded-[11px] border border-red/25 bg-red-light text-[13.5px] font-bold text-red"
          >
            Reject
          </button>
          <button
            type="button" onClick={onApprove}
            className="flex h-[46px] flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-green text-[13.5px] font-bold text-white"
          >
            <i className="bi bi-check2-all" /> Approve
          </button>
        </div>
      </div>
    </div>
  )
}
