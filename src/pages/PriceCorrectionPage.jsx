import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { usePriceCorrection } from "../hooks/usePriceCorrection"
import { naira, numberNG, litres } from "../utils/format"
import { pumpsFor } from "../config/stations"
import { activeStation } from "../utils/station"

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const TONE = {
  PMS: { bg: "bg-cyan-light", border: "border-cyan/20", text: "text-cyan-dark" },
  AGO: { bg: "bg-amber-light", border: "border-amber/25", text: "text-amber" },
  LPG: { bg: "bg-surface", border: "border-border", text: "text-ink-3" },
}

export default function PriceCorrectionPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle("Correct prices")

  const [date, setDate] = useState(todayISO())
  const { bands, status, saving, correct, splitDay } = usePriceCorrection(auth.username, date)
  const [splitting, setSplitting] = useState(null)   // { product, oldPrice }
  const [splitNewPrice, setSplitNewPrice] = useState("")
  const [splitReadings, setSplitReadings] = useState({})
  const [editing, setEditing] = useState(null)   // { product, price }
  const [newPrice, setNewPrice] = useState("")
  const [feedback, setFeedback] = useState(null)

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  /* Rewriting historical sales is an owner-level act — it changes what the
     books say happened. Not a GM decision. */
  const allowed = auth.role === "owner" || auth.role === "ceo"
  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pagebg p-6">
        <div className="max-w-[300px] rounded-panel border border-border bg-white px-6 py-8 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-surface">
            <i className="bi bi-lock text-[19px] text-ink-4" />
          </div>
          <p className="text-[13px] font-bold text-ink">Not your page</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-4">
            Only the CEO or owner can correct a recorded price.
          </p>
          <button type="button" onClick={() => window.history.back()}
            className="mt-4 rounded-[10px] border border-border px-4 py-2 text-[12px] font-bold text-ink-3">
            Go back
          </button>
        </div>
      </div>
    )
  }

  const startEdit = b => {
    setEditing({ product: b.product, price: b.price })
    setNewPrice(String(b.price))
    setFeedback(null)
  }

  const submitSplit = async () => {
    const np = Number(splitNewPrice)
    if (!np || np <= 0) { setFeedback({ ok:false, text:"Enter the second price." }); return }
    const cleaned = {}
    Object.keys(splitReadings).forEach(k => { if (Number(splitReadings[k]) > 0) cleaned[k] = Number(splitReadings[k]) })
    if (!Object.keys(cleaned).length) { setFeedback({ ok:false, text:"Enter at least one pump reading." }); return }
    const res = await splitDay({
      product: splitting.product, oldPrice: splitting.oldPrice, newPrice: np, splits: cleaned,
    })
    if (res.ok) {
      setFeedback({ ok:true, text: `${res.message} ${res.note}` })
      setSplitting(null); setSplitReadings({}); setSplitNewPrice("")
    } else {
      setFeedback({ ok:false, text: res.error || "Could not split that day." })
    }
  }

  const submit = async () => {
    const np = Number(newPrice)
    if (!np || np <= 0) { setFeedback({ ok: false, text: "Enter a valid price." }); return }
    const res = await correct({ product: editing.product, oldPrice: editing.price, newPrice: np })
    if (res.ok) {
      setFeedback({
        ok: true,
        text: `${res.rowsChanged} sale row(s) corrected — ${res.product} now ${naira(res.newPrice)}/L. ${res.note}`,
      })
      setEditing(null)
    } else {
      setFeedback({ ok: false, text: res.error || "Could not correct that band." })
    }
  }

  return (
    <div className="min-h-screen bg-pagebg pb-16">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[200] border-b border-border bg-white shadow-sm" style={{ paddingTop: "max(var(--sat),52px)" }}>
        <div className="flex items-center gap-3 px-4 pb-2.5">
          <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">Correct prices</div>
            <div className="text-[10px] text-ink-4">Fix a wrong price on a past day</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        <div className="mb-4 rounded-[12px] border border-amber/25 bg-amber-light/50 px-4 py-3 text-[11.5px] leading-relaxed text-ink-2">
          This rewrites the actual sale records for the day, so the revenue,
          the price bands and the daily total all follow. Every correction is logged.
        </div>

        <div className="mb-4 overflow-hidden rounded-panel border border-border bg-white shadow-card">
          <label className="block px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Date</label>
          <input type="date" value={date} max={todayISO()}
            onChange={e => { setDate(e.target.value); setEditing(null); setFeedback(null) }}
            className="mono w-full border-0 px-4 pb-3.5 text-[14px] font-bold text-ink outline-none" />
        </div>

        {feedback && (
          <div className={`mb-4 flex items-start gap-2 rounded-[11px] border px-4 py-3 text-[12px] font-semibold ${feedback.ok ? "border-green/20 bg-green-light text-green" : "border-red/20 bg-red-light text-red"}`}>
            <i className={`bi ${feedback.ok ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"} mt-px`} />
            <span className="flex-1 leading-relaxed">{feedback.text}</span>
          </div>
        )}

        {status === "loading" ? (
          <div className="space-y-2">{[0, 1].map(i => <div key={i} className="skel h-20 w-full rounded-panel" />)}</div>
        ) : bands.length === 0 ? (
          <div className="rounded-panel border border-border bg-white px-4 py-10 text-center shadow-card">
            <p className="text-[12.5px] text-ink-4">No sales recorded on this date.</p>
          </div>
        ) : (
          <>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">
              Price bands on this day
            </div>
            <div className="space-y-2.5">
              {bands.map((b, i) => {
                const t = TONE[b.product] || TONE.LPG
                const isEditing = editing && editing.product === b.product && editing.price === b.price
                const isSplitting = splitting && splitting.product === b.product && splitting.oldPrice === b.price
                return (
                  <div key={i} className="overflow-hidden rounded-panel border border-border bg-white shadow-card">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-[3px] text-[10.5px] font-bold ${t.bg} ${t.border} ${t.text}`}>
                        {b.product}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mono text-[14px] font-extrabold text-ink">{naira(b.price)}/L</div>
                        <div className="text-[10.5px] text-ink-4">
                          {litres(b.litres, { maximumFractionDigits: 2 })} · {naira(b.amount)} · {b.rowCount} sale{b.rowCount === 1 ? "" : "s"}
                        </div>
                      </div>
                      {!isEditing && !isSplitting && (
                        <div className="flex flex-shrink-0 gap-1.5">
                          <button type="button" onClick={() => startEdit(b)}
                            className="rounded-[9px] border border-border px-3 py-1.5 text-[11px] font-bold text-ink-3 hover:bg-surface">
                            Correct
                          </button>
                          <button type="button"
                            onClick={() => { setSplitting({ product: b.product, oldPrice: b.price }); setSplitNewPrice(""); setSplitReadings({}); setEditing(null); setFeedback(null) }}
                            title="The price changed this day but was never recorded"
                            className="rounded-[9px] border border-amber/30 bg-amber-light px-3 py-1.5 text-[11px] font-bold text-amber hover:bg-amber/10">
                            Split
                          </button>
                        </div>
                      )}
                    </div>

                    {isSplitting && (
                      <div className="border-t border-surface bg-amber-light/30 px-4 py-3">
                        <p className="mb-3 text-[11px] leading-relaxed text-ink-2">
                          Use this when the price changed that day but nobody recorded the cutover.
                          The pump metre reading <strong>at the moment the price changed</strong> was
                          never captured, so enter it per pump from your records.
                        </p>

                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-[1px] text-ink-4">
                          Second price (after the change)
                        </label>
                        <input type="text" inputMode="decimal" value={splitNewPrice}
                          onChange={e => setSplitNewPrice(e.target.value.replace(/[^\d.]/g, ""))}
                          placeholder="e.g. 1100"
                          className="mono mb-3 w-full rounded-[10px] border border-border px-3 py-2.5 text-[13px] outline-none focus:border-cyan" />

                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[1px] text-ink-4">
                          Metre reading when the price changed
                        </label>
                        <div className="space-y-2">
                          {pumpsFor(activeStation())
                            .filter(pp => String(pp.product || "").toUpperCase() === b.product)
                            .map(pp => {
                              const id = pp.pumpId || pp.id
                              return (
                                <div key={id} className="flex items-center gap-2.5">
                                  <span className="w-[70px] flex-shrink-0 text-[11.5px] font-bold text-ink-2">{pp.label || id}</span>
                                  <input type="text" inputMode="decimal"
                                    value={splitReadings[id] || ""}
                                    onChange={e => setSplitReadings(prev => ({ ...prev, [id]: e.target.value.replace(/[^\d.]/g, "") }))}
                                    placeholder="Metre at change"
                                    className="mono flex-1 rounded-[10px] border border-border px-3 py-2 text-[12.5px] outline-none focus:border-cyan" />
                                </div>
                              )
                            })}
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => setSplitting(null)}
                            className="flex-1 rounded-[10px] border border-border py-2.5 text-[11.5px] font-bold text-ink-3">
                            Cancel
                          </button>
                          <button type="button" onClick={submitSplit} disabled={saving}
                            className="flex-[1.6] rounded-[10px] py-2.5 text-[11.5px] font-bold text-white disabled:opacity-50"
                            style={{ background: "linear-gradient(135deg,#D97706,#F59E0B)" }}>
                            {saving ? "Splitting…" : "Split into two prices"}
                          </button>
                        </div>
                      </div>
                    )}

                    {isEditing && (
                      <div className="border-t border-surface bg-surface/40 px-4 py-3">
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[1px] text-ink-4">
                          Correct price per litre
                        </label>
                        <div className="flex gap-2">
                          <input type="text" inputMode="decimal" value={newPrice} autoFocus
                            onChange={e => setNewPrice(e.target.value.replace(/[^\d.]/g, ""))}
                            className="mono flex-1 rounded-[10px] border border-border px-3 py-2.5 text-[13px] outline-none focus:border-cyan" />
                          <button type="button" onClick={() => setEditing(null)}
                            className="rounded-[10px] border border-border px-3 text-[11.5px] font-bold text-ink-3">
                            Cancel
                          </button>
                          <button type="button" onClick={submit} disabled={saving}
                            className="rounded-[10px] px-4 text-[11.5px] font-bold text-white disabled:opacity-50"
                            style={{ background: "linear-gradient(135deg,#16A34A,#22C55E)" }}>
                            {saving ? "Saving…" : "Apply"}
                          </button>
                        </div>
                        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-4">
                          Updates {b.rowCount} sale row{b.rowCount === 1 ? "" : "s"} and recalculates their revenue.
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
