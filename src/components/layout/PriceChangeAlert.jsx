import React from "react"
import { useNavigate } from "react-router-dom"

export default function PriceChangeAlert({ change, onDismissForNow }) {
  const navigate = useNavigate()
  if (!change) return null

  const { product, oldPrice, newPrice } = change

  return (
    <div className="fixed inset-x-0 top-0 z-[9998] px-3" style={{ paddingTop: "max(var(--sat), 10px)" }}>
      <div className="mx-auto flex max-w-[640px] items-start gap-3 rounded-[14px] border border-amber/30 bg-[#FFFBEB] p-3.5 shadow-lift">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-amber/15">
          <i className="bi bi-exclamation-triangle-fill text-[15px] text-amber" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold text-[#92400E]">
            {product} price changed — ₦{oldPrice.toLocaleString("en-NG")} → ₦{newPrice.toLocaleString("en-NG")}
          </div>
          <div className="mt-0.5 text-[11.5px] leading-snug text-[#92400E]/80">
            Close the current pump readings for {product} pumps now, with a photo. The closing metre becomes the
            opening reading for the new price.
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => navigate("/sales-mso?cutover=" + product.toLowerCase())}
              className="rounded-[9px] bg-amber px-3.5 py-2 text-[12px] font-bold text-white"
            >
              Close pumps now
            </button>
            <button
              type="button"
              onClick={onDismissForNow}
              className="rounded-[9px] border border-amber/30 bg-white px-3.5 py-2 text-[12px] font-bold text-[#92400E]"
            >
              Remind me later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
