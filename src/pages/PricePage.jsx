import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePrices } from "../hooks/usePrices"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira } from "../utils/format"

function PriceCard({ label, price, since, color, unit = "litre" }) {
  return (
    <div className="flex-1 rounded-card border border-border bg-white p-4 shadow-card">
      <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">{label}</div>
      <div className="mono mt-1 text-[22px] font-black text-ink">{naira(price)}</div>
      <div className="mt-1 text-[10.5px] text-ink-4">per {unit} · since {since}</div>
      <div className="mt-2 h-1 rounded-full" style={{ background: color }} />
    </div>
  )
}

export default function PricePage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const { prices, since, history, loading, saving, savePrice } = usePrices()
  usePageTitle("Fuel Prices — MSO Limpid")

  const [product, setProduct] = useState("PMS")
  const [price, setPrice] = useState("")
  const [note, setNote] = useState("")
  const [feedback, setFeedback] = useState(null)

  const canEdit = auth.isGM || auth.isOwner

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }

  const handleSubmit = async e => {
    e.preventDefault()
    const num = Number(price)
    if (!num || num <= 0) {
      setFeedback({ type: "error", text: "Enter a valid price greater than zero." })
      return
    }
    setFeedback(null)
    const res = await savePrice({ product, price: num, note, username: auth.username })
    if (res.ok) {
      setFeedback({ type: "success", text: `${product} price updated to ${naira(num)}/${product === "LPG" ? "kg" : "L"}.` })
      setPrice("")
      setNote("")
    } else {
      setFeedback({ type: "error", text: res.error || "Couldn't save the price. Try again." })
    }
  }

  return (
    <div className="min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />
      <div
        className="sticky top-0 z-[200] flex items-center gap-3 border-b border-border bg-white px-4 pb-2.5 shadow-[0_1px_4px_rgba(0,0,0,.04)]"
        style={{ paddingTop: "max(var(--sat), 52px)" }}
      >
        <button
          type="button"
          onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2"
        >
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-extrabold text-ink">Fuel Prices</div>
          <div className="text-[10px] text-ink-4">MSO Station</div>
        </div>
      </div>

      <div className="mx-auto max-w-[480px] px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[13px] text-ink-4">
            <span className="mr-2 h-4 w-4 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
            Loading current prices…
          </div>
        ) : (
          <>
            <div className="mb-5 flex gap-3">
              <PriceCard label="PMS" price={prices.pms} since={since.pms} color="#179DD0" />
              <PriceCard label="AGO" price={prices.ago} since={since.ago} color="#7C3AED" />
              <PriceCard label="LPG" price={prices.lpg} since={since.lpg} color="#16A34A" unit="kg" />
            </div>

            {canEdit ? (
              <form onSubmit={handleSubmit} className="mb-5 rounded-card border border-border bg-white p-4 shadow-card">
                <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.6px] text-ink-4">Update Price</div>

                <div className="mb-3 flex gap-2">
                  {["PMS", "AGO", "LPG"].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProduct(p)}
                      className={`flex-1 rounded-[9px] border px-3 py-2 text-[12.5px] font-bold ${
                        product === p ? "border-cyan bg-cyan-light text-cyan-dark" : "border-border bg-white text-ink-4"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <label className="mb-3 block">
                  <span className="mb-1 block text-[11px] font-semibold text-ink-3">New price per {product === "LPG" ? "kg" : "litre"} (₦)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder={product === "PMS" ? String(prices.pms) : product === "AGO" ? String(prices.ago) : String(prices.lpg)}
                    className="w-full rounded-[9px] border border-border px-3 py-2.5 text-[14px] font-bold text-ink outline-none focus:border-cyan"
                  />
                </label>

                <label className="mb-3 block">
                  <span className="mb-1 block text-[11px] font-semibold text-ink-3">Note (optional)</span>
                  <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="e.g. Depot price adjustment"
                    className="w-full rounded-[9px] border border-border px-3 py-2.5 text-[13px] text-ink outline-none focus:border-cyan"
                  />
                </label>

                {feedback && (
                  <div
                    className={`mb-3 rounded-[9px] px-3 py-2 text-[12px] font-semibold ${
                      feedback.type === "success" ? "bg-green-light text-green" : "bg-red-light text-red"
                    }`}
                  >
                    {feedback.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-[44px] w-full items-center justify-center rounded-[10px] text-[13.5px] font-bold text-white shadow-lift disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #130656, #1a0875)" }}
                >
                  {saving ? "Saving…" : `Update ${product} Price`}
                </button>
              </form>
            ) : (
              <div className="mb-5 flex items-center gap-2.5 rounded-card border border-border bg-white px-4 py-3.5 text-[12px] text-ink-4 shadow-card">
                <i className="bi bi-lock text-ink-4" />
                Only the GM or Owner can update fuel prices. You're viewing the current rates.
              </div>
            )}

            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Today's Price Changes</div>
            <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
              {history.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12.5px] text-ink-4">No price changes logged today</div>
              ) : (
                <div className="divide-y divide-surface">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`rounded-full px-2 py-[2px] text-[10px] font-bold ${
                            h.product === "PMS" ? "border border-cyan/20 bg-cyan-light text-cyan-dark" : "border border-purple-200 bg-[#F5F3FF] text-[#7C3AED]"
                          }`}
                        >
                          {h.product}
                        </span>
                        <div>
                          <div className="text-[12px] font-bold text-ink">{naira(h.price)}/L</div>
                          <div className="text-[10px] text-ink-4">{h.time || ""} · {h.by || "—"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
