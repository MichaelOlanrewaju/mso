import React, { useCallback, useEffect, useMemo, useState } from "react"
import { getStation } from "../config/stations"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, litres } from "../utils/format"
import { getToken } from "../utils/session"
import { activeStation } from "../utils/station"
import { toISO, rangeFor, getAPI, postAPI, Card, Row } from "./stockpl/shared"
import { addDaysISO } from "../utils/dateRange"

function OverallHero({ overall, pmsTotal, agoTotal, label = "Today" }) {
  const positive = overall >= 0
  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-6 shadow-xl"
      style={{
        background: positive
          ? "linear-gradient(135deg, #6D5AE6 0%, #4338CA 55%, #3730A3 100%)"
          : "linear-gradient(135deg, #F97066 0%, #E4433A 55%, #C1272D 100%)",
      }}
    >
      {/* Soft decorative blobs — the one bold, fintech-card gesture */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
      <div className="pointer-events-none absolute -bottom-14 -left-6 h-32 w-32 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />

      <div className="relative">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[1px] text-white/70">
          <i className="bi bi-graph-up-arrow" />
          Overall — {label}
        </div>
        <div className="mono text-[34px] font-black leading-none text-white">{naira(overall)}</div>
        <div className="mt-5 flex gap-2.5">
          <div className="flex-1 rounded-[16px] px-3.5 py-3" style={{ background: "rgba(255,255,255,0.14)", backdropFilter: "blur(6px)" }}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/65">
              <span className="h-1.5 w-1.5 rounded-full bg-white/90" />PMS
            </div>
            <div className="mono mt-0.5 text-[15.5px] font-extrabold text-white">{naira(pmsTotal)}</div>
          </div>
          <div className="flex-1 rounded-[16px] px-3.5 py-3" style={{ background: "rgba(255,255,255,0.14)", backdropFilter: "blur(6px)" }}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/65">
              <span className="h-1.5 w-1.5 rounded-full bg-white/90" />AGO
            </div>
            <div className="mono mt-0.5 text-[15.5px] font-extrabold text-white">{naira(agoTotal)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductSection({ label, data }) {
  if (!data) return null
  const isPMS = label === "PMS"
  const accent = isPMS ? "var(--brand-accent)" : "#7C3AED"
  const accentBg = isPMS ? "bg-cyan-light" : "bg-[#F3EEFF]"
  const accentText = isPMS ? "text-cyan-dark" : "text-[#7C3AED]"

  // Merge opening + closing + variance by batchId so each batch's full
  // day — what it started with, what was drawn from it, what it ended
  // with — shows as one row, in the same order it was actually drawn.
  const batchRows = (data.openingStock || []).map(ob => {
    const closing = (data.closingStock || []).find(cb => cb.batchId === ob.batchId)
    const drawn = (data.variance || []).find(v => v.batchId === ob.batchId)
    return {
      batchId: ob.batchId,
      costPrice: ob.costPrice,
      opening: ob.litres,
      closing: closing ? closing.litres : ob.litres,
      drawnLitres: drawn ? drawn.litres : 0,
      varianceAmount: drawn ? drawn.amount : 0,
      touched: Boolean(drawn),
    }
  })

  const dipPct = data.tankDipIn > 0 ? Math.max(0, Math.min(100, (data.tankDipOut / data.tankDipIn) * 100)) : 0

  // Donut showing remaining stock vs. what was sold today, as a share of
  // opening stock — the "spending breakdown" pattern from the reference
  // kit, applied to fuel stock instead of a spending category split.
  const R = 34, C = 2 * Math.PI * R
  const soldShare = data.openingStockTotal > 0 ? Math.min(1, data.litresSold / data.openingStockTotal) : 0

  return (
    <Card className="shadow-md rounded-[24px]">
      <div className="flex items-center gap-3 px-5 pb-1 pt-5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px]" style={{ background: accentBg === "bg-cyan-light" ? "#E6F7FF" : "#F3EEFF" }}>
          <span className="text-[15px] font-black" style={{ color: accent }}>{label[0]}</span>
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-black tracking-tight text-ink">{label}</div>
          <div className="mono text-[11.5px] font-semibold text-ink-4">{naira(data.sellingPrice)}/L selling</div>
        </div>
      </div>

      {/* Tank movement + donut — remaining stock share, visually */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-surface">
        <svg width="84" height="84" viewBox="0 0 84 84" className="flex-shrink-0 -rotate-90">
          <circle cx="42" cy="42" r={R} fill="none" stroke="#F1F3F6" strokeWidth="9" />
          <circle cx="42" cy="42" r={R} fill="none" stroke={accent} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * soldShare} />
        </svg>
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wide text-ink-4">
            <span>Tank dip</span>
            <span>{litres(data.litresSold)} sold</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="mono text-[15px] font-extrabold text-ink">{litres(data.tankDipIn)}</div>
              <div className="text-[10px] text-ink-4">Opening</div>
            </div>
            <div className="text-right">
              <div className="mono text-[15px] font-extrabold text-ink">{litres(data.tankDipOut)}</div>
              <div className="text-[10px] text-ink-4">Closing</div>
            </div>
          </div>
        </div>
      </div>

      {/* Every batch's day — opening, drawn, closing — same order FIFO drew them, timeline-style */}
      <div className="px-5 py-4 border-b border-surface">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-ink-4">Deliveries</span>
          <span className="mono text-[10.5px] font-bold text-ink-4">{litres(data.openingStockTotal)} → {litres(data.closingStockTotal)}</span>
        </div>
        {batchRows.length === 0 ? (
          <div className="rounded-[14px] bg-red-light px-3.5 py-3 text-[12px] font-semibold text-red">
            No deliveries on file for {label} — add one from the Deliveries page.
          </div>
        ) : (
          <div className="space-y-2">
            {batchRows.map((b, i) => (
              <div key={b.batchId} className={`flex items-center gap-3 rounded-[16px] px-3.5 py-3 ${b.touched ? accentBg : "bg-surface"}`}>
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: b.touched ? accent : "#D1D5DB" }}>
                  <i className="bi bi-droplet-fill text-[12px] text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-extrabold text-ink">{naira(b.costPrice)}<span className="font-medium text-ink-4">/L</span></span>
                    {b.touched && <span className={`mono text-[11.5px] font-extrabold ${accentText}`}>−{litres(b.drawnLitres)}</span>}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10.5px] text-ink-4">
                    <span>{litres(b.opening)} → {litres(b.closing)}</span>
                    {b.touched && <span className="mono font-bold text-green">{naira(b.varianceAmount)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {data.litresUnmatched > 0 && (
          <div className="mt-2.5 rounded-[14px] bg-red-light px-3.5 py-2.5 text-[11px] font-semibold text-red">
            {litres(data.litresUnmatched)} sold beyond any delivery — add a new one to cover it.
          </div>
        )}
      </div>

      {/* Financial summary — builds up to the day's total, in order */}
      <div className="px-5">
        <Row label="Total (FIFO variance)" value={naira(data.total)} tone="green" sub="Sum of each batch's own variance" />
        <Row label="Pump diff − Tank diff" value={litres(data.pumpDiff)} sub="Marginal litres" />
        <Row label="Amount" value={naira(data.amount)} sub="Marginal x selling price" />
      </div>
      <div className="mx-3 mb-3 mt-1 rounded-[18px] px-4 py-3.5" style={{ background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-black text-green">{label} Total Amount</span>
          <span className="mono text-[17px] font-black text-green">{naira(data.productTotalAmount)}</span>
        </div>
        <div className="mt-0.5 text-[10.5px] text-green/70">Amount + Total</div>
      </div>
    </Card>
  )
}


export default function StockPLPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle(`Tank and Pump Analysis — ${getStation(activeStation()).name}`)

  const [view, setView] = useState("today") // "today" | "week" | "month"
  const [offset, setOffset] = useState(0)
  const [dayData, setDayData] = useState(null)
  const [summaryData, setSummaryData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState(null)

  const range = useMemo(() => (view === "today" ? null : rangeFor(view, offset)), [view, offset])
  const todayISO = toISO(new Date())
  // Confirmed directly: she needs to be able to go back and compute a
  // day she missed, not just always see today — defaults to today, but
  // is freely changeable via the date nav below.
  const [selectedDate, setSelectedDate] = useState(todayISO)
  const isToday = selectedDate === todayISO

  const loadDay = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAPI("getStockPL", { date: selectedDate, username: auth.username, token: getToken() })
      if (res.ok) setDayData(res)
      else setError(res.error || "Couldn't load this day's figures.")
    } catch (e) {
      setError("Network error — please try again.")
    } finally {
      setLoading(false)
    }
  }, [auth.username, selectedDate])

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
      const res = await postAPI("computeStockPL", { date: selectedDate, username: auth.username, token: getToken() })
      if (res.ok) setDayData(res)
      else setError(res.error || "Couldn't compute this day's figures.")
    } catch (e) {
      setError("Network error — please try again.")
    } finally {
      setComputing(false)
    }
  }

  const [reopening, setReopening] = useState(false)
  const reopenToday = async () => {
    if (!window.confirm(`Reopen ${isToday ? "today's" : selectedDate + "'s"} figures? This restores the litres drawn from deliveries and lets you recompute — use this after correcting sales data for that day.`)) return
    setReopening(true)
    setError(null)
    try {
      const res = await postAPI("reopenStockPLDay", { date: selectedDate, username: auth.username, token: getToken() })
      if (res.ok) {
        setDayData(null)
        await loadDay()
      } else {
        setError(res.error || "Couldn't reopen this day's figures.")
      }
    } catch (e) {
      setError("Network error — please try again.")
    } finally {
      setReopening(false)
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
      <div className="sticky top-0 z-10 bg-white px-4 pb-4 pt-[calc(env(safe-area-inset-top)+12px)] shadow-sm">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))} className="text-[13px] font-bold text-ink-3">
            <i className="bi bi-chevron-left mr-1" />Back
          </button>
          <div className="text-[13px] font-extrabold text-ink">Tank and Pump Analysis</div>
          <div className="w-[44px]" />
        </div>
        <button type="button" onClick={() => navigate(`/stock-pl/${auth.station}/batches`)}
          className="mt-3.5 flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left transition-transform active:scale-[0.99]"
          style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)" }}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: "rgba(67,56,202,0.14)" }}>
            <i className="bi bi-box-seam-fill text-[14px]" style={{ color: "#4338CA" }} />
          </div>
          <span className="flex-1 text-[13px] font-bold" style={{ color: "#3730A3" }}>Fuel Deliveries</span>
          <i className="bi bi-chevron-right text-[13px]" style={{ color: "#4338CA" }} />
        </button>
        <div className="mt-3.5 flex gap-1 rounded-[13px] bg-surface p-1">
          {[["today", "Today"], ["week", "Week"], ["month", "Month"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => { setView(v); setOffset(0) }}
              className={`flex-1 rounded-[10px] py-2 text-[12.5px] font-bold transition-all ${view === v ? "bg-white text-ink shadow-sm" : "text-ink-4"}`}>
              {l}
            </button>
          ))}
        </div>
        {range && (
          <div className="mt-3 flex items-center justify-between rounded-[13px] bg-surface px-2 py-1.5">
            <button type="button" onClick={() => setOffset(o => o - 1)} className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3"><i className="bi bi-chevron-left text-[12px]" /></button>
            <div className="text-[12.5px] font-bold text-ink-3">{range.label}</div>
            <button type="button" onClick={() => setOffset(o => o + 1)} className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3"><i className="bi bi-chevron-right text-[12px]" /></button>
          </div>
        )}
        {/* Confirmed directly: she needs to be able to go back and
            compute a day she missed, not just always see today. */}
        {view === "today" && (
          <div className="mt-3 flex items-center gap-2 rounded-[13px] bg-surface px-2 py-1.5">
            <button type="button"
              onClick={() => setSelectedDate(d => addDaysISO(d, -1))}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-3"><i className="bi bi-chevron-left text-[12px]" /></button>
            <input type="date" value={selectedDate} max={todayISO}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="flex-1 rounded-[9px] border-none bg-transparent px-2 py-1 text-center text-[12.5px] font-bold text-ink-3" />
            <button type="button" disabled={isToday}
              onClick={() => setSelectedDate(d => addDaysISO(d, 1))}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-3 disabled:opacity-30"><i className="bi bi-chevron-right text-[12px]" /></button>
            {!isToday && (
              <button type="button" onClick={() => setSelectedDate(todayISO)}
                className="flex-shrink-0 rounded-[9px] bg-cyan-light px-2.5 py-1.5 text-[11px] font-bold text-cyan-dark">Today</button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pt-4">
        {(
          <>
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
                  <div className="rounded-[20px] bg-white px-5 py-6 text-center shadow-sm">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "#EEF2FF" }}>
                      <i className="bi bi-hourglass-split text-[22px]" style={{ color: "#4338CA" }} />
                    </div>
                    <div className="text-[13px] font-bold text-ink">{isToday ? "Today" : selectedDate} hasn't been computed yet</div>
                    <div className="mx-auto mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-ink-4">
                      This draws litres sold from the oldest delivery first — if sales data needs correcting afterward,
                      {" "}{isToday ? "today" : "this day"} can be reopened to redo it.
                    </div>
                  </div>
                )}
                {!dayData.cached ? (
                  <button type="button" onClick={computeToday} disabled={computing}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-[16px] py-4 text-[14px] font-bold text-white shadow-lg disabled:opacity-70"
                    style={{ background: "linear-gradient(135deg, #6D5AE6 0%, #4338CA 100%)" }}>
                    {computing && <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" />}
                    {computing ? "Computing…" : isToday ? "Compute today's P&L" : `Compute P&L for ${selectedDate}`}
                  </button>
                ) : (
                  <>
                    <OverallHero overall={dayData.overall} pmsTotal={dayData.pms.productTotalAmount} agoTotal={dayData.ago.productTotalAmount} />
                    <ProductSection label="PMS" data={dayData.pms} />
                    <ProductSection label="AGO" data={dayData.ago} />
                    <Card>
                      <Row label="Expenses" value={`− ${naira(dayData.expenses)}`} tone="red" />
                      <Row label="M.P Charges" value={`− ${naira(dayData.mpCharges)}`} tone="red" />
                    </Card>
                    {/* Confirmed directly: needed for when sales data gets
                        corrected after this day was already computed —
                        without this, a stale, wrong snapshot had no way to
                        ever be fixed short of editing the sheet by hand. */}
                    <button type="button" onClick={reopenToday} disabled={reopening}
                      className="w-full rounded-[16px] bg-surface py-3.5 text-[13px] font-bold text-ink-3 disabled:opacity-50">
                      {reopening ? "Reopening…" : isToday ? "Reopen today (after correcting sales data)" : `Reopen ${selectedDate} (after correcting sales data)`}
                    </button>
                  </>
                )}
              </>
            )}

            {!loading && view !== "today" && summaryData && (
              <>
                <OverallHero
                  overall={summaryData.totals.overall}
                  pmsTotal={summaryData.totals.pmsTotal}
                  agoTotal={summaryData.totals.agoTotal}
                  label={range ? range.label : view === "week" ? "This Week" : "This Month"}
                />
                {summaryData.days.length === 0 ? (
                  <Card>
                    <div className="px-4 py-8 text-center text-[12.5px] text-ink-4">
                      No computed days in this period yet — go to Today and compute a day to see it here.
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {/* Confirmed directly: each day should be reachable
                        from here, not just listed — tapping jumps
                        straight to that day's full detail, same as
                        picking it from the date nav on Today. */}
                    {[...summaryData.days].reverse().map(d => (
                      <button key={d.date} type="button"
                        onClick={() => { setSelectedDate(d.date); setView("today") }}
                        className="flex w-full items-center gap-3 overflow-hidden rounded-[18px] bg-white p-3.5 text-left shadow-sm transition-transform active:scale-[0.99]">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px]"
                          style={{ background: d.overall >= 0 ? "#ECFDF5" : "#FEF2F2" }}>
                          <i className={`bi ${d.overall >= 0 ? "bi-arrow-up-short" : "bi-arrow-down-short"} text-[18px]`}
                            style={{ color: d.overall >= 0 ? "#22C55E" : "#EF4444" }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-bold text-ink">{d.date}</div>
                          <div className="mt-0.5 flex items-center gap-2.5 text-[10.5px] text-ink-4">
                            <span><span style={{ color: "var(--brand-accent)" }} className="font-bold">PMS</span> {naira(d.pmsProductTotal)}</span>
                            <span><span style={{ color: "#7C3AED" }} className="font-bold">AGO</span> {naira(d.agoProductTotal)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`mono text-[14px] font-extrabold ${d.overall >= 0 ? "text-green" : "text-red"}`}>{naira(d.overall)}</div>
                        </div>
                        <i className="bi bi-chevron-right flex-shrink-0 text-[13px] text-ink-4" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>
  )
}
