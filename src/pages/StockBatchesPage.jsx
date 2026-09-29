import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, litres } from "../utils/format"
import { getToken } from "../utils/session"
import { getAPI, postAPI, Card, toISO } from "./stockpl/shared"

function BatchesTabContent({ auth }) {
  const [product, setProduct] = useState("PMS")
  const [batches, setBatches] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const loadBatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAPI("getStockBatchesList", { username: auth.username, token: getToken() })
      if (res.ok) setBatches(res.batches)
      else setError(res.error || "Couldn't load batches.")
    } catch (e) {
      setError("Network error — please try again.")
    } finally {
      setLoading(false)
    }
  }, [auth.username])

  useEffect(() => { loadBatches() }, [loadBatches])

  const filtered = (batches || []).filter(b => b.product === product)
  const active = filtered.filter(b => b.active)
  const exhausted = filtered.filter(b => !b.active)
  const activeTotal = active.reduce((sum, b) => sum + b.remaining, 0)

  return (
    <>
      <div className="mb-4 flex gap-1 rounded-[13px] bg-surface p-1">
        {["PMS", "AGO"].map(p => (
          <button key={p} type="button" onClick={() => setProduct(p)}
            className={`flex-1 rounded-[10px] py-2.5 text-[13px] font-bold transition-all ${product === p ? "bg-white text-ink shadow-sm" : "text-ink-4"}`}>
            {p}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 rounded-[12px] bg-red-light px-4 py-3 text-[12px] font-semibold text-red">{error}</div>
      )}

      <div className="relative mb-3 overflow-hidden rounded-[24px] p-5 shadow-xl" style={{ background: "linear-gradient(135deg, #6D5AE6 0%, #4338CA 55%, #3730A3 100%)" }}>
        <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="relative">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[1px] text-white/70">Currently in stock — {product}</div>
          <div className="mono text-[26px] font-black leading-none text-white">{litres(activeTotal)}</div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-[13px] text-ink-4">Loading batches…</div>
      ) : (
        <>
          <Card className="mb-3 rounded-[20px]">
            <div className="bg-surface px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-4">
              Deliveries — draws oldest first
            </div>
            {active.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12.5px] text-ink-4">No active {product} deliveries — add one below.</div>
            ) : (
              <div className="space-y-1.5 p-2">
                {active.map((b, i) => (
                  <div key={b.batchId} className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 ${i === 0 ? "bg-cyan-light" : ""}`}>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: i === 0 ? "var(--brand-accent)" : "#E5E7EB" }}>
                      <i className="bi bi-droplet-fill text-[12px]" style={{ color: i === 0 ? "#fff" : "#9CA3AF" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-bold text-ink">
                        {i === 0 ? "Draws next · " : ""}{naira(b.costPrice)}/L
                      </div>
                      <div className="text-[10.5px] text-ink-4">Added {b.dateAdded}{b.addedBy ? ` · ${b.addedBy}` : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="mono text-[13px] font-extrabold text-ink">{litres(b.remaining)}</div>
                      <div className="text-[10px] text-ink-4">of {litres(b.litres)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {exhausted.length > 0 && (
            <Card className="mb-3 rounded-[20px] opacity-60">
              <div className="bg-surface px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-4">
                Fully used — {exhausted.length}
              </div>
              {exhausted.map(b => (
                <div key={b.batchId} className="flex items-center justify-between border-b border-surface px-4 py-2.5 last:border-b-0">
                  <div className="text-[12px] text-ink-3">{naira(b.costPrice)}/L · added {b.dateAdded}</div>
                  <div className="mono text-[12px] font-semibold text-ink-4">{litres(b.litres)}</div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {showForm ? (
        <AddBatchForm
          auth={auth}
          defaultProduct={product}
          onCancel={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadBatches() }}
        />
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="w-full rounded-[16px] py-4 text-[14px] font-bold text-white shadow-lg"
          style={{ background: "linear-gradient(135deg, #6D5AE6 0%, #4338CA 100%)" }}>
          <i className="bi bi-plus-lg mr-1.5" />Add a delivery
        </button>
      )}
    </>
  )
}

function AddBatchForm({ onCancel, onSaved, auth, defaultProduct }) {
  // Confirmed directly, tracing a real "confusing" report: the product
  // was already chosen on the parent tab before this form even opened —
  // a second, duplicate PMS/AGO toggle in here was redundant and
  // confusing, not a genuine second choice. Fixed, not a live toggle.
  const product = defaultProduct || "PMS"
  const [rows, setRows] = useState([{ litres: "", costPrice: "" }])
  // Confirmed directly: a delivery being entered today may have actually
  // arrived a few days ago — defaults to today, but changeable.
  const [dateAdded, setDateAdded] = useState(toISO(new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [tankLevel, setTankLevel] = useState(null)
  const [tankLevelLoading, setTankLevelLoading] = useState(true)

  /* Confirmed directly: GM shouldn't be typing litres blind — this
     pulls the most recent tank reading already on file from the
     normal dip flow, so the form can show "tank currently shows X"
     right alongside the input, letting the batches' combined litres
     be sanity-checked against reality rather than trusted unchecked. */
  useEffect(() => {
    let cancelled = false
    setTankLevelLoading(true)
    getAPI("getCurrentTankLevel", { product, username: auth.username, token: getToken() })
      .then(res => { if (!cancelled) setTankLevel(res.ok ? res : null) })
      .catch(() => { if (!cancelled) setTankLevel(null) })
      .finally(() => { if (!cancelled) setTankLevelLoading(false) })
    return () => { cancelled = true }
  }, [product, auth.username])

  const updateRow = (i, field, value) => {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }
  const addRow = () => setRows(prev => [...prev, { litres: "", costPrice: "" }])
  const removeRow = i => setRows(prev => prev.filter((_, idx) => idx !== i))

  const runningTotal = rows.reduce((sum, r) => sum + (Number(r.litres) || 0), 0)

  const submit = async () => {
    const parsed = rows.map(r => ({ litres: Number(r.litres), costPrice: Number(r.costPrice) }))
    const badRow = parsed.findIndex(r => !(r.litres > 0) || !(r.costPrice > 0))
    if (badRow !== -1) { setError(`Row ${badRow + 1} needs litres and cost price, both greater than 0.`); return }
    setSaving(true)
    setError(null)
    try {
      const res = await postAPI("addStockBatchesBulk", { product, batches: parsed, dateAdded, username: auth.username, token: getToken() })
      if (res.ok) onSaved()
      else setError(res.error || "Couldn't save these batches.")
    } catch (e) {
      setError("Network error — please try again.")
    } finally {
      setSaving(false)
    }
  }

  const accent = product === "PMS" ? "var(--brand-accent)" : "#7C3AED"
  const accentDark = product === "PMS" ? "#0D3B54" : "#4C1D95"
  const tankTotal = tankLevel && tankLevel.closingLitres > 0 ? tankLevel.closingLitres : null
  const diff = tankTotal !== null ? runningTotal - tankTotal : null
  const matches = diff !== null && Math.abs(diff) < 1

  return (
    <Card className="shadow-md">
      <div className="px-5 py-4" style={{ background: `linear-gradient(135deg, ${accentDark} 0%, ${accent} 130%)` }}>
        <div className="text-[15px] font-black tracking-tight text-white">Add {product} delivery{rows.length > 1 ? "/deliveries" : ""}</div>
        <div className="mt-1 text-[11.5px] text-white/75">
          What's in the tank right now might be leftover from a few deliveries at different costs —
          add each one, oldest first.
        </div>
      </div>

      <div className="p-5">
        <div className="mb-3">
          <label className="mb-1 block text-[10.5px] font-bold text-ink-4">Delivered on</label>
          <input type="date" value={dateAdded} max={toISO(new Date())}
            onChange={e => e.target.value && setDateAdded(e.target.value)}
            className="w-full rounded-[10px] border border-border px-3 py-2.5 text-[14px]" />
        </div>
        <div className="mb-4 flex items-center gap-2 rounded-[10px] bg-cyan-light px-3 py-2.5 text-[12px] font-semibold text-cyan-dark">
          <i className="bi bi-info-circle-fill flex-shrink-0" />
          {tankLevelLoading ? "Checking tank level…" :
            tankTotal !== null
              ? `All ${product} tanks combined currently hold ${tankTotal.toLocaleString()}L, as of ${tankLevel.date} closing`
              : "No recent tank reading on file to compare against"}
        </div>

        <div className="space-y-2.5">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2.5">
              <div
                className="mt-2.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                style={{ background: accent }}
              >
                {i + 1}
              </div>
              <div className="flex-1 rounded-[12px] border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-ink-4">
                    {i === 0 ? "Oldest — drawn first" : `Batch ${i + 1}`}
                  </span>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)} className="text-[11px] font-bold text-red">Remove</button>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10.5px] font-bold text-ink-4">Litres</label>
                    <input type="number" value={row.litres} onChange={e => updateRow(i, "litres", e.target.value)}
                      className="w-full rounded-[10px] border border-border px-3 py-2.5 text-[14px] focus:border-cyan focus:outline-none" placeholder="e.g. 9,150" />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[10.5px] font-bold text-ink-4">Cost price/L</label>
                    <input type="number" value={row.costPrice} onChange={e => updateRow(i, "costPrice", e.target.value)}
                      className="w-full rounded-[10px] border border-border px-3 py-2.5 text-[14px] focus:border-cyan focus:outline-none" placeholder="e.g. 860" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addRow}
          className="mt-2.5 ml-[34px] w-[calc(100%-34px)] rounded-[10px] border border-dashed border-border py-2.5 text-[12.5px] font-bold text-ink-3">
          <i className="bi bi-plus-lg mr-1.5" />Add another batch
        </button>

        {runningTotal > 0 && (
          <div className={`mt-3 rounded-[12px] px-3.5 py-3 ${matches ? "bg-green-light" : tankTotal !== null ? "bg-amber-light" : "bg-surface"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11.5px] font-bold ${matches ? "text-green" : tankTotal !== null ? "text-amber-700" : "text-ink-3"}`}>Combined total</span>
              <span className={`mono text-[14px] font-extrabold ${matches ? "text-green" : tankTotal !== null ? "text-amber-700" : "text-ink"}`}>{runningTotal.toLocaleString()}L</span>
            </div>
            {tankTotal !== null && (
              <div className={`mt-1 text-[10.5px] font-semibold ${matches ? "text-green/80" : "text-amber-700/80"}`}>
                {matches ? <><i className="bi bi-check-circle-fill mr-1" />Matches the tank reading</> :
                  <><i className="bi bi-exclamation-triangle-fill mr-1" />{Math.abs(diff).toLocaleString()}L {diff > 0 ? "more than" : "less than"} the tank reading</>}
              </div>
            )}
          </div>
        )}

        {error && <div className="mt-3 rounded-lg bg-red-light px-3 py-2 text-[12px] font-semibold text-red">{error}</div>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-[14px] bg-surface py-3.5 text-[13px] font-bold text-ink-3">Cancel</button>
          <button type="button" onClick={submit} disabled={saving}
          className="flex-1 rounded-[14px] py-3.5 text-[13px] font-bold text-white shadow-lg disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #6D5AE6 0%, #4338CA 100%)" }}>
          {saving ? "Saving…" : rows.length > 1 ? `Add ${rows.length} batches` : "Add batch"}
        </button>
      </div>
      </div>
    </Card>
  )
}


/* Its own real page — its own URL, its own Back button — not a tab
   sharing a screen with Records. Confirmed directly: they needed to be
   two genuinely separate places, reached by navigating, not by a tab
   switch inside one shared page. */
export default function StockBatchesPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle("Fuel Deliveries")

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-surface" />
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <SafeAreaDebug />
      <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] shadow-sm">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate(`/stock-pl/${auth.station}`)} className="text-[13px] font-bold text-ink-3">
            <i className="bi bi-chevron-left mr-1" />Records
          </button>
          <div className="text-[14px] font-extrabold text-ink">Fuel Deliveries</div>
          <div className="w-[70px]" />
        </div>
      </div>
      <div className="space-y-3 px-4 pt-4">
        <BatchesTabContent auth={auth} />
      </div>
    </div>
  )
}
