import React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { activeStation } from "../../utils/station"

/* Blocking: a price change means the old-price pump readings MUST be closed before
   any more work is done. There is deliberately no "remind me later". The alert
   steps aside only on the Sales page while that product's cutover sheet is open,
   and goes away for good once the cutover is completed (clearPendingCutover). */
export default function PriceChangeAlert({ change }) {
  const navigate = useNavigate()
  const location = useLocation()
  if (!change) return null

  const { product, oldPrice, newPrice } = change
  const onCutoverSheet =
    location.pathname.startsWith("/sales/") &&
    (new URLSearchParams(location.search).get("cutover") || "").toUpperCase() === String(product).toUpperCase()
  if (onCutoverSheet) return null

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center px-4"
      style={{ background: "rgba(127,29,29,.82)", backdropFilter: "blur(3px)" }}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[420px] rounded-[18px] bg-white p-5 shadow-lift" style={{ borderTop: "4px solid #DC2626" }}>
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-10 w-10 flex-shrink-0 animate-pulse items-center justify-center rounded-[11px]" style={{ background: "#FEE2E2", boxShadow: "0 0 0 6px rgba(220,38,38,.18)" }}>
            <i className="bi bi-exclamation-triangle-fill text-[17px]" style={{ color: "#DC2626" }} />
          </div>
          <div className="text-[16px] font-extrabold uppercase tracking-wide text-[#B91C1C]">Price changed — act now</div>
        </div>
        <div className="text-[13px] font-bold text-ink-2">
          {product} price changed — {Number(oldPrice) > 0 ? `₦${Number(oldPrice).toLocaleString("en-NG")} → ` : ""}₦{Number(newPrice).toLocaleString("en-NG")}
        </div>
        <div className="mt-1.5 text-[12px] leading-snug text-ink-3">
          Close the current pump readings for {product} pumps now, with a photo. The closing metre becomes the opening
          reading for the new price. You can't continue until this is done, so the litres sold at the old price are
          not lost from the day's revenue.
        </div>
        <button
          type="button"
          onClick={() => navigate(`/sales/${activeStation()}?cutover=` + String(product).toLowerCase())}
          className="mt-4 w-full rounded-[11px] py-3 text-[14px] font-extrabold text-white"
          style={{ background: "#DC2626" }}
        >
          Close pumps now
        </button>
      </div>
    </div>
  )
}
