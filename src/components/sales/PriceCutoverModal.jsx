import React, { useState } from "react"
import { pumpsFor } from "../../config/stations"
import { activeStation } from "../../utils/station"
import { naira } from "../../utils/format"

/**
 * Mid-day price cutover.
 *
 * When the CEO/GM changes a price, every pump selling that product has to be
 * closed off at the old price and reopened at the new one. This collects one
 * reading per affected pump — the current metre — and the server uses it twice:
 * as the closing figure for the old-price session, and as the opening figure for
 * the new-price session.
 *
 * Only pumps for the changed product appear. A PMS price change leaves the AGO
 * pumps alone, because they're still selling at their own unchanged price.
 */
export default function PriceCutoverModal({ open, product, newPrice, oldPrice, onClose, onConfirm, saving }) {
  const [readings, setReadings] = useState({})
  const [touched, setTouched] = useState(false)

  if (!open) return null

  const affected = pumpsFor(activeStation()).filter(
    p => String(p.product || "").toUpperCase() === String(product || "").toUpperCase()
  )

  const allFilled = affected.length > 0 && affected.every(p => Number(readings[p.pumpId || p.id]) > 0)

  const setVal = (id, v) => {
    setTouched(true)
    setReadings(prev => ({ ...prev, [id]: v.replace(/[^\d.]/g, "") }))
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-[460px] overflow-y-auto rounded-t-[20px] bg-white sm:rounded-[18px]">
        <div className="sticky top-0 border-b border-border bg-white px-5 pb-3 pt-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px] bg-amber/15">
              <i className="bi bi-arrow-left-right text-[16px] text-amber" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold text-ink">Close {product} pumps</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-ink-4">
                {oldPrice > 0 && <>{naira(oldPrice)} → </>}
                <span className="font-bold text-ink-2">{naira(newPrice)}/L</span>
                {" · "}Enter each pump's reading now.
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-4 hover:bg-surface">
              <i className="bi bi-x-lg text-[13px]" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-4 rounded-[11px] border border-cyan/15 bg-cyan-light/40 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-2">
            This one number does two jobs: it closes the pump at{" "}
            {oldPrice > 0 ? naira(oldPrice) : "the old price"} and opens it again at {naira(newPrice)}.
            You won't need to type it twice.
          </div>

          {affected.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-ink-4">
              No {product} pumps configured at this station.
            </p>
          ) : (
            <div className="space-y-2.5">
              {affected.map(p => {
                const id = p.pumpId || p.id
                const val = readings[id] || ""
                const missing = touched && !(Number(val) > 0)
                return (
                  <div key={id} className="flex items-center gap-3">
                    <div className="w-[86px] flex-shrink-0">
                      <div className="text-[12.5px] font-bold text-ink">{p.label || id}</div>
                      <div className="text-[10px] text-ink-4">{p.tank}</div>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={val}
                      onChange={e => setVal(id, e.target.value)}
                      placeholder="Current metre"
                      className={`mono flex-1 rounded-[10px] border px-3 py-2.5 text-[13px] outline-none transition-colors ${
                        missing ? "border-red/40 bg-red-light/40" : "border-border focus:border-cyan"
                      }`}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2.5 border-t border-border bg-white px-5 py-3.5">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-[11px] border border-border py-3 text-[12.5px] font-bold text-ink-3">
            Not now
          </button>
          <button
            type="button"
            disabled={!allFilled || saving}
            onClick={() => onConfirm(readings)}
            className="flex-[1.6] rounded-[11px] py-3 text-[12.5px] font-bold text-white transition-opacity disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#16A34A,#22C55E)" }}
          >
            {saving ? "Closing…" : `Close & reopen at ${naira(newPrice)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
