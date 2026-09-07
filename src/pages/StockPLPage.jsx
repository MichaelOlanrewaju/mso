import React, { useCallback, useEffect, useMemo, useState } from "react"
import { getStation } from "../config/stations"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, litres } from "../utils/format"
import { getToken } from "../utils/session"
import { activeStation } from "../utils/station"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

function toISO(d) { return d.toISOString().split("T")[0] }

/* Same week/month/year range logic as the main P&L page — Sunday to
   Saturday for week, 1st to actual last day for month, Jan 1 to Dec
   31 for year. Kept identical on purpose, so switching between the
   two P&L pages feels consistent. */
function rangeFor(mode, offset) {
  const today = new Date()
  if (mode === "week") {
    const ref = new Date(today)
    ref.setDate(ref.getDate() + offset * 7)
    const sun = new Date(ref)
    sun.setDate(sun.getDate() - sun.getDay())
    const sat = new Date(sun)
    sat.setDate(sat.getDate() + 6)
    return {
      from: toISO(sun), to: toISO(sat),
      label: `${sun.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${sat.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    }
  }
  if (mode === "month") {
    const ref = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1)
    const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
    return {
      from: toISO(first), to: toISO(last),
      label: ref.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    }
  }
  return null // "today" mode doesn't use a range
}

function getAPI(action, extra = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false })
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", action)
  url.searchParams.set("station", activeStation())
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
}

function postAPI(action, body = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false })
  return fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ action, station: activeStation(), ...body }),
  }).then(r => r.json())
}

function Card({ children, className = "" }) {
  return <div className={`overflow-hidden rounded-[16px] bg-white shadow-sm ${className}`}>{children}</div>
}

function Row({ label, value, tone, sub }) {
  const toneClass = tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-navy"
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-surface last:border-b-0">
      <div>
        <div className="text-[12.5px] font-bold text-ink">{label}</div>
        {sub && <div className="text-[10.5px] text-ink-4">{sub}</div>}
      </div>
      <div className={`mono text-[14px] font-extrabold ${toneClass}`}>{value}</div>
    </div>
  )
}

/* One product's full breakdown — opening stock batches, the day's
   selling price, the FIFO variance per batch, tank litres sold,
   pump margin, and the two totals. Mirrors the real ledger's column
   layout, confirmed directly against actual entries. */
function ProductSection({ label, data }) {
  if (!data) return null
  return (
    <Card>
      <div className="bg-navy px-4 py-2.5 text-[12px] font-extrabold text-white">{label}</div>
      <div className="px-4 py-3 border-b border-surface">
        <div className="mb-1.5 text-[11px] font-bold text-ink-4">OPENING STOCK</div>
        {data.openingStock.map((b, i) => (
          <div key={i} className="flex items-center justify-between py-0.5 text-[12px]">
            <span className="text-ink-3">Batch {i + 1} @ {naira(b.costPrice)}/L</span>
            <span className="mono font-bold text-ink">{litres(b.litres)}</span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-surface pt-1 text-[12px]">
          <span className="font-bold text-ink">Total opening stock</span>
          <span className="mono font-extrabold text-ink">{litres(data.openingStockTotal)}</span>
        </div>
      </div>
      <Row label="Selling price" value={naira(data.sellingPrice) + "/L"} />
      <Row label="Tank litres sold" value={litres(data.litresSold)} sub="From tank dip, not pump margin" />
      <div className="px-4 py-3 border-b border-surface">
        <div className="mb-1.5 text-[11px] font-bold text-ink-4">VARIANCE (per batch, FIFO)</div>
        {data.variance.map((v, i) => (
          <div key={i} className="flex items-center justify-between py-0.5 text-[12px]">
            <span className="text-ink-3">{litres(v.litres)} @ {naira(v.variance)} variance</span>
            <span className="mono font-bold text-green">{naira(v.amount)}</span>
          </div>
        ))}
        {data.litresUnmatched > 0 && (
          <div className="mt-1 rounded-lg bg-red-light px-2.5 py-1.5 text-[11px] font-semibold text-red">
            {litres(data.litresUnmatched)} sold beyond any batch — add a new stock batch to cover it.
          </div>
        )}
      </div>
      <Row label="Total" value={naira(data.total)} tone="green" sub="Sum of variance x litres, per batch" />
      <Row label="Closing stock" value={litres(data.closingStockTotal)} sub="Remaining across all batches" />
      <Row label="Pump diff (margin)" value={litres(data.pumpDiff)} />
      <Row label="Amount" value={naira(data.amount)} sub="Pump diff x selling price" />
      <div className="bg-green-light px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-extrabold text-green">{label} Total Amount</span>
          <span className="mono text-[16px] font-extrabold text-green">{naira(data.productTotalAmount)}</span>
        </div>
        <div className="mt-0.5 text-[10.5px] text-green/70">Amount + Total</div>
      </div>
    </Card>
  )
}

function AddBatchModal({ onClose, onSaved, auth }) {
  const [product, setProduct] = useState("PMS")
  const [litresVal, setLitresVal] = useState("")
  const [costPrice, setCostPrice] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [tankLevel, setTankLevel] = useState(null)
  const [tankLevelLoading, setTankLevelLoading] = useState(true)

  /* Confirmed directly: GM shouldn't be typing litres blind — this
     pulls the most recent tank reading already on file from the
     normal dip flow, so the form can show "tank currently shows X"
     right alongside the input, letting the new batch's litres be
     sanity-checked against reality rather than trusted unchecked. */
  useEffect(() => {
    let cancelled = false
    setTankLevelLoading(true)
    getAPI("getCurrentTankLevel", { product, username: auth.username, token: getToken() })
      .then(res => { if (!cancelled) setTankLevel(res.ok ? res : null) })
      .catch(() => { if (!cancelled) setTankLevel(null) })
      .finally(() => { if (!cancelled) setTankLevelLoading(false) })
    return () => { cancelled = true }
  }, [product, auth.username])

  const submit = async () => {
    const l = Number(litresVal), c = Number(costPrice)
    if (!(l > 0) || !(c > 0)) { setError("Enter litres and cost price, both greater than 0."); return }
    setSaving(true)
    setError(null)
    try {
      const res = await postAPI("addStockBatch", { product, litres: l, costPrice: c, username: auth.username, token: getToken() })
      if (res.ok) onSaved()
      else setError(res.error || "Couldn't save this batch.")
    } catch (e) {
      setError("Network error — please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[20px] bg-white p-5 sm:rounded-[20px]" onClick={e => e.stopPropagation()}>
        <div className="mb-4 text-[15px] font-extrabold text-ink">Add stock batch</div>
        <div className="mb-3 flex gap-2">
          {["PMS", "AGO"].map(p => (
            <button key={p} type="button" onClick={() => setProduct(p)}
              className={`flex-1 rounded-[10px] py-2 text-[13px] font-bold ${product === p ? "bg-navy text-white" : "bg-surface text-ink-3"}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="mb-3 rounded-[10px] bg-cyan-light px-3 py-2 text-[12px] font-semibold text-cyan-dark">
          {tankLevelLoading ? "Checking tank level…" :
            tankLevel && tankLevel.closingLitres > 0
              ? `Tank currently shows ${tankLevel.closingLitres.toLocaleString()}L, as of ${tankLevel.date} closing`
              : "No recent tank reading on file to compare against"}
        </div>
        <label className="mb-1 block text-[11px] font-bold text-ink-4">Litres</label>
        <input type="number" value={litresVal} onChange={e => setLitresVal(e.target.value)}
          className="mb-3 w-full rounded-[10px] border border-border px-3 py-2.5 text-[14px]" placeholder="e.g. 34,050" />
        <label className="mb-1 block text-[11px] font-bold text-ink-4">Cost price per litre</label>
        <input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)}
          className="mb-4 w-full rounded-[10px] border border-border px-3 py-2.5 text-[14px]" placeholder="e.g. 888" />
        {error && <div className="mb-3 rounded-lg bg-red-light px-3 py-2 text-[12px] font-semibold text-red">{error}</div>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-[12px] bg-surface py-3 text-[13px] font-bold text-ink-3">Cancel</button>
          <button type="button" onClick={submit} disabled={saving}
            className="flex-1 rounded-[12px] bg-navy py-3 text-[13px] font-bold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Add batch"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StockPLPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle(`Stock P&L — ${getStation(activeStation()).name}`)

  const [view, setView] = useState("today") // "today" | "week" | "month"
  const [offset, setOffset] = useState(0)
  const [dayData, setDayData] = useState(null)
  const [summaryData, setSummaryData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState(null)
  const [showAddBatch, setShowAddBatch] = useState(false)

  const range = useMemo(() => (view === "today" ? null : rangeFor(view, offset)), [view, offset])
  const todayISO = toISO(new Date())

  const loadDay = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAPI("getStockPL", { date: todayISO, username: auth.username, token: getToken() })
      if (res.ok) setDayData(res)
      else setError(res.error || "Couldn't load today's figures.")
    } catch (e) {
      setError("Network error — please try again.")
    } finally {
      setLoading(false)
    }
  }, [auth.username, todayISO])

  const loadSummary = useCallback(async () => {
    if (!range) return
    setLoading(true)
    setError(null)
    try {
      const res = await getAPI("getStockPLSummary", { fromDate: range.from, toDate: range.to, username: auth.username, token: getToken() })
      if (res.ok) setSummaryData(res)
      else setError(res.error || "Couldn't load this period.")
    } catch (e) {
      setError("Network error — please try again.")
    } finally {
      setLoading(false)
    }
  }, [auth.username, range])

  /* Must be declared here, unconditionally, alongside every other hook —
     not after the early return below. Confirmed directly, tracing a real
     bug: without the guard below, this effect fired immediately on
     mount, before useAuth had actually resolved auth.username. That
     first call went out with no valid session, got rejected as "session
     expired" by the backend, and set the error state — which then
     lingered or flashed until the corrected, second call (once
     auth.username actually resolved) overwrote it. This is exactly what
     "today showing blank" was. */
  useEffect(() => {
    if (auth.loading || !auth.user) return
    if (view === "today") loadDay()
    else loadSummary()
  }, [view, loadDay, loadSummary, auth.loading, auth.user])

  const computeToday = async () => {
    setComputing(true)
    setError(null)
    try {
      const res = await postAPI("getStockPL", { date: todayISO, username: auth.username, token: getToken() })
      if (res.ok) setDayData(res)
      else setError(res.error || "Couldn't compute today's figures.")
    } catch (e) {
      setError("Network error — please try again.")
    } finally {
      setComputing(false)
    }
  }

  /* Every other working page in the app (DashboardPage, SummaryPage)
     guards on this exact condition before rendering anything — matching
     it here stops the effect above from ever firing with an unresolved
     auth.username in the first place. */
  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-surface" />
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <SafeAreaDebug />
      <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] shadow-sm">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate(dashboardPathFor(auth.role))} className="text-[13px] font-bold text-ink-3">
            <i className="bi bi-chevron-left mr-1" />Back
          </button>
          <div className="text-[14px] font-extrabold text-ink">Stock P&amp;L</div>
          <button type="button" onClick={() => setShowAddBatch(true)} className="text-[12px] font-bold text-navy">
            + Add batch
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          {[["today", "Today"], ["week", "Week"], ["month", "Month"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => { setView(v); setOffset(0) }}
              className={`flex-1 rounded-[10px] py-2 text-[12.5px] font-bold ${view === v ? "bg-navy text-white" : "bg-surface text-ink-3"}`}>
              {l}
            </button>
          ))}
        </div>
        {range && (
          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={() => setOffset(o => o - 1)} className="p-1 text-ink-3"><i className="bi bi-chevron-left" /></button>
            <div className="text-[12.5px] font-bold text-ink-3">{range.label}</div>
            <button type="button" onClick={() => setOffset(o => o + 1)} className="p-1 text-ink-3"><i className="bi bi-chevron-right" /></button>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pt-4">
        {loading && (
          <div className="flex items-center justify-center py-16 text-[13px] text-ink-4">
            <span className="mr-2 h-4 w-4 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
            Loading…
          </div>
        )}

        {error && (
          <div className="rounded-[16px] bg-red-light px-4 py-3 text-[13px] font-semibold text-red">{error}</div>
        )}

        {!loading && view === "today" && dayData && (
          <>
            {!dayData.cached && (
              <div className="rounded-[12px] bg-white px-4 py-3 text-[12px] text-ink-3 shadow-sm">
                Today hasn't been computed yet. This draws litres sold from the oldest stock batch first —
                once computed, it can't be re-run for today without affecting batch balances.
              </div>
            )}
            {!dayData.cached ? (
              <button type="button" onClick={computeToday} disabled={computing}
                className="w-full rounded-[14px] bg-navy py-3.5 text-[14px] font-bold text-white disabled:opacity-50">
                {computing ? "Computing…" : "Compute today's P&L"}
              </button>
            ) : (
              <>
                <ProductSection label="PMS" data={dayData.pms} />
                <ProductSection label="AGO" data={dayData.ago} />
                <Card>
                  <Row label="Expenses" value={`− ${naira(dayData.expenses)}`} tone="red" />
                  <Row label="M.P Charges" value={`− ${naira(dayData.mpCharges)}`} tone="red" />
                </Card>
                <div className={`overflow-hidden rounded-[16px] shadow-sm ${dayData.overall >= 0 ? "bg-green-light" : "bg-red-light"}`}>
                  <div className="flex items-center justify-between px-4 py-4">
                    <div className={`text-[14px] font-extrabold ${dayData.overall >= 0 ? "text-green" : "text-red"}`}>Overall</div>
                    <div className={`mono text-[20px] font-extrabold ${dayData.overall >= 0 ? "text-green" : "text-red"}`}>{naira(dayData.overall)}</div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {!loading && view !== "today" && summaryData && (
          <>
            <Card>
              {summaryData.days.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12.5px] text-ink-4">No computed days in this period yet.</div>
              ) : summaryData.days.map(d => (
                <Row key={d.date} label={d.date} value={naira(d.overall)} tone={d.overall >= 0 ? "green" : "red"} />
              ))}
            </Card>
            <div className={`overflow-hidden rounded-[16px] shadow-sm ${summaryData.totals.overall >= 0 ? "bg-green-light" : "bg-red-light"}`}>
              <div className="flex items-center justify-between px-4 py-4">
                <div className={`text-[14px] font-extrabold ${summaryData.totals.overall >= 0 ? "text-green" : "text-red"}`}>Total</div>
                <div className={`mono text-[20px] font-extrabold ${summaryData.totals.overall >= 0 ? "text-green" : "text-red"}`}>{naira(summaryData.totals.overall)}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {showAddBatch && (
        <AddBatchModal auth={auth} onClose={() => setShowAddBatch(false)}
          onSaved={() => { setShowAddBatch(false); if (view === "today") loadDay() }} />
      )}
    </div>
  )
}
