import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { PrintHeader } from "../components/ui/PrintElements"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { getStation } from "../config/stations"
import { activeStation } from "../utils/station"
import { getToken } from "../utils/session"
import { readJsonReply } from "../utils/readReply"
import { naira, litresValue } from "../utils/format"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

/* Local-date helpers — never toISOString(), which is UTC and slips a day for
   anyone looking at it just after midnight in Lagos. */
const pad = n => String(n).padStart(2, "0")
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = s => new Date(`${s}T12:00:00`)
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7))
const short = s => parse(s).toLocaleDateString("en-NG", { day: "numeric", month: "short" })
const long = s => parse(s).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })

function rangeFor(mode, anchor, custom) {
  if (mode === "week") { const m = mondayOf(anchor); return [iso(m), iso(addDays(m, 6))] }
  if (mode === "month") {
    const a = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const b = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return [iso(a), iso(b)]
  }
  return custom
}

function useReport(from, to) {
  const [state, setState] = useState({ loading: true, error: "", data: null })
  const load = useCallback(async () => {
    if (!SCRIPT_URL) { setState({ loading: false, error: "Not connected.", data: null }); return }
    if (!from || !to || from > to) { setState({ loading: false, error: "Choose a valid date range.", data: null }); return }
    setState(s => ({ ...s, loading: true, error: "" }))
    try {
      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "getDischargeReport")
      url.searchParams.set("station", activeStation())
      url.searchParams.set("dateFrom", from)
      url.searchParams.set("dateTo", to)
      url.searchParams.set("token", getToken() || "")
      const res = await readJsonReply(await fetch(url.toString(), { method: "GET", redirect: "follow" }))
      if (res.ok) setState({ loading: false, error: "", data: res })
      else setState({ loading: false, error: res.error || "Could not load the report.", data: null })
    } catch {
      setState({ loading: false, error: "Could not reach the server. Check your connection and try again.", data: null })
    }
  }, [from, to])
  useEffect(() => { load() }, [load])
  return { ...state, reload: load }
}

const q = (v, unit) => unit === "KG" ? `${litresValue(v)} KG` : `${litresValue(v)} L`

function downloadCsv(data, from, to) {
  const money = data.canSeePrices
  const head = ["Product", "Date", "Day", "Driver", "Supplier", "Truck / Waybill", "Tanks (received)", "Ordered", "Received", "Shortage", "Unit"]
  if (money) head.push("Price per unit", "Total cost", "Shortage cost", "Priced")
  const rows = [head]
  data.products.forEach(p => p.days.forEach(d => {
    d.loads.forEach(l => {
      const r = [p.product, d.date, d.day, l.driver, l.supplier, [l.trucks, l.waybills].filter(Boolean).join(" / "),
        l.tanks.map(t => `${t.tank} ${t.received}`).join(" | "), l.ordered, l.received, l.shortage, p.unit]
      if (money) r.push((l.prices || []).join(" / "), l.cost, l.shortageCost, l.priced ? "yes" : "NO")
      rows.push(r)
    })
    if (d.loads.length > 1) {
      const r = [p.product, d.date, d.day, "DAY TOTAL", "", "", "", d.ordered, d.received, d.shortage, p.unit]
      if (money) r.push("", d.cost, d.shortageCost, "")
      rows.push(r)
    }
  }))
  data.products.forEach(p => {
    const r = [p.product, "TOTAL", "", `${p.totals.deliveries} deliveries`, "", "", "", p.totals.ordered, p.totals.received, p.totals.shortage, p.unit]
    if (money) r.push("", p.totals.cost, p.totals.shortageCost, "")
    rows.push(r)
  })
  const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }))
  a.download = `discharge-${activeStation()}-${from}-to-${to}.csv`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export default function DischargeReportPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const station = getStation(activeStation())
  usePageTitle(`Discharge Report — ${station.name}`)

  const today = useMemo(() => new Date(), [])
  const [mode, setMode] = useState("week")          // week | month | custom
  const [anchor, setAnchor] = useState(today)
  const [custom, setCustom] = useState([iso(addDays(today, -6)), iso(today)])
  const [from, to] = rangeFor(mode, anchor, custom)
  const { loading, error, data, reload } = useReport(from, to)

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  const step = dir => setAnchor(a => {
    const d = new Date(a)
    if (mode === "week") d.setDate(d.getDate() + 7 * dir)
    else { d.setDate(1); d.setMonth(d.getMonth() + dir) }
    return d
  })
  const thisPeriod = mode === "week" ? iso(mondayOf(anchor)) === iso(mondayOf(today))
    : mode === "month" ? anchor.getMonth() === today.getMonth() && anchor.getFullYear() === today.getFullYear() : false
  const money = !!data?.canSeePrices
  const unpricedCount = data?.unpriced?.count || 0
  const label = mode === "month"
    ? parse(from).toLocaleDateString("en-NG", { month: "long", year: "numeric" })
    : `${short(from)} – ${long(to)}`

  const th = "whitespace-nowrap px-2.5 py-2 text-right text-[10.5px] font-bold uppercase tracking-[0.4px] text-ink-4"
  const td = "whitespace-nowrap px-2.5 py-2 text-right mono text-[12px] text-ink"

  return (
    <div className="min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />
      <div className="no-print sticky top-0 z-[200] border-b border-border bg-white" style={{ paddingTop: "max(var(--sat),14px)" }}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pb-2.5">
          <button type="button" aria-label="Back" onClick={() => navigate(`/discharge/${activeStation()}`)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border border-border text-ink-3">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-extrabold tracking-tight text-ink">Discharge Report</div>
            <div className="text-[10.5px] font-medium text-ink-4">{station.name}</div>
          </div>
          <button type="button" onClick={() => data && downloadCsv(data, from, to)} disabled={!data}
            className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[12px] font-bold text-ink disabled:opacity-40">
            <i className="bi bi-filetype-csv" /> CSV
          </button>
          <button type="button" onClick={() => window.print()} disabled={!data}
            className="flex h-9 items-center gap-1.5 rounded-full bg-navy px-3.5 text-[12px] font-bold text-white disabled:opacity-40">
            <i className="bi bi-printer" /> Print
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-4">
        {/* Period picker */}
        <div className="no-print mb-4 rounded-[14px] border border-border bg-white p-3 shadow-sm">
          <div className="flex gap-2">
            {[["week", "Weekly"], ["month", "Monthly"], ["custom", "Custom"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => { setMode(k); if (k !== "custom") setAnchor(today) }}
                className={`flex-1 rounded-full py-2 text-[12.5px] font-bold transition ${mode === k ? "bg-navy text-white" : "bg-surface text-ink-3"}`}>{l}</button>
            ))}
          </div>
          {mode !== "custom" ? (
            <div className="mt-3 flex items-center gap-2">
              <button type="button" aria-label="Previous" onClick={() => step(-1)} className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border text-ink-2"><i className="bi bi-chevron-left" /></button>
              <div className="flex-1 text-center">
                <div className="text-[14px] font-extrabold text-ink">{label}</div>
                {!thisPeriod && <button type="button" onClick={() => setAnchor(today)} className="text-[11.5px] font-bold text-cyan-dark underline">{mode === "week" ? "Back to this week" : "Back to this month"}</button>}
              </div>
              <button type="button" aria-label="Next" onClick={() => step(1)} disabled={thisPeriod} className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border text-ink-2 disabled:opacity-30"><i className="bi bi-chevron-right" /></button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[["From", 0], ["To", 1]].map(([l, i]) => (
                <label key={l} className="block">
                  <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.4px] text-ink-4">{l}</span>
                  <input type="date" value={custom[i]} max={iso(today)} onChange={e => setCustom(c => i ? [c[0], e.target.value] : [e.target.value, c[1]])}
                    className="w-full rounded-[10px] border border-border bg-white px-3 py-2.5 text-[13px] font-semibold text-ink outline-none focus:border-cyan" />
                </label>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-2 py-16">
            <span className="h-6 w-6 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
            <div className="text-[12px] text-ink-4">Loading report…</div>
          </div>
        )}
        {!loading && error && (
          <div className="rounded-[14px] border border-red/20 bg-red-light px-4 py-4 text-[13px] font-semibold text-red">
            {error} <button type="button" onClick={reload} className="ml-1 underline">Try again</button>
          </div>
        )}

        {!loading && data && (
          <div className="print-document">
            <PrintHeader title="Discharge Report" subtitle={`${station.name} · ${long(from)} to ${long(to)}${money ? "" : " · litres only"}`} />

            {money && unpricedCount > 0 && (
              <div className="mb-4 rounded-[14px] border border-red/25 bg-red-light px-4 py-3 text-[12.5px] font-semibold text-red">
                <i className="bi bi-exclamation-triangle-fill mr-1.5" />
                {unpricedCount} deliver{unpricedCount === 1 ? "y" : "ies"} in this period {unpricedCount === 1 ? "has" : "have"} no price yet — costs below leave {unpricedCount === 1 ? "it" : "them"} out.
              </div>
            )}

            {data.products.length === 0 && (
              <div className="rounded-[16px] bg-white py-14 text-center shadow-sm">
                <i className="bi bi-fuel-pump text-4xl text-ink-4" />
                <div className="mt-2 text-[14px] font-bold text-ink">No deliveries in this period</div>
              </div>
            )}

            {/* Totals per product — never blended into one litres figure */}
            {data.products.length > 0 && (
              <div className="mb-4 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(data.products.length, 3)}, minmax(0, 1fr))` }}>
                {data.products.map(p => (
                  <div key={p.product} className="rounded-[14px] border border-border bg-white p-3 shadow-sm">
                    <div className="text-[11px] font-extrabold tracking-[0.5px] text-ink-4">{p.product}</div>
                    <div className="mono mt-1 text-[16px] font-extrabold text-ink">{q(p.totals.received, p.unit)}</div>
                    <div className="text-[11px] text-ink-4">{p.totals.deliveries} deliver{p.totals.deliveries === 1 ? "y" : "ies"}</div>
                    {money && (() => {
                      const np = p.days.reduce((n, d) => n + d.loads.filter(l => !l.priced && !l.partlyPriced).length, 0)
                      return np === p.totals.deliveries
                        ? <div className="mt-1 text-[12px] font-bold text-red">Not priced</div>
                        : <div className="mono mt-1 text-[13px] font-bold text-ink">{naira(p.totals.cost)}{np > 0 && <span className="ml-1 text-[10.5px] font-bold text-red">+{np} unpriced</span>}</div>
                    })()}
                  </div>
                ))}
              </div>
            )}

            {data.products.map(p => (
              <section key={p.product} className="mb-5 overflow-hidden rounded-[14px] border border-border bg-white shadow-sm" style={{ breakInside: "avoid-page" }}>
                <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5">
                  <div className="text-[13px] font-extrabold text-ink">{p.product}</div>
                  <div className="text-[11px] font-semibold text-ink-4">{p.unit === "KG" ? "kilograms" : "litres"}</div>
                </div>
                {/* Phone layout: one card per delivery (a wide table would hide the price columns) */}
                <div className="sm:hidden print:hidden">
                  {p.days.map(d => (
                    <div key={d.date} className="border-b border-border last:border-b-0">
                      <div className="flex items-center justify-between bg-surface px-4 py-1.5 text-[11.5px] font-extrabold text-ink">
                        <span>{short(d.date)} <span className="font-semibold text-ink-4">{d.day}</span></span>
                        {d.loads.length > 1 && <span className="mono text-ink-3">Day: {litresValue(d.received)}{money ? ` · ${naira(d.cost)}` : ""}</span>}
                      </div>
                      {d.loads.map((l, i) => (
                        <div key={i} className="border-t border-surface px-4 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[13px] font-extrabold text-ink">{l.driver || "—"}</div>
                              <div className="mono text-[10.5px] text-ink-4">{l.tanks.map(t => `${t.tank} ${litresValue(t.received)}`).join(" · ")}</div>
                            </div>
                            <div className="text-right">
                              <div className="mono text-[14px] font-extrabold text-ink">{litresValue(l.received)}<span className="text-[10px] font-bold text-ink-4"> {p.unit}</span></div>
                              <div className="text-[10.5px] text-ink-4">of {litresValue(l.ordered)} ordered</div>
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
                            {l.shortage !== 0 && <span className={l.shortage > 0 ? "font-bold text-red" : "font-bold text-green"}>{l.shortage > 0 ? "Short" : "Over"} {litresValue(Math.abs(l.shortage))}</span>}
                            {money && (l.priced || l.partlyPriced ? (
                              <>
                                <span className="mono text-ink-3">@ {(l.prices || []).map(x => litresValue(x)).join(" / ") || "—"}</span>
                                <span className="mono font-extrabold text-ink">{naira(l.cost)}</span>
                                {l.shortageCost !== 0 && <span className="mono text-ink-3">loss {naira(l.shortageCost)}</span>}
                              </>
                            ) : <span className="rounded-full bg-red-light px-2 py-0.5 text-[10.5px] font-bold text-red">Not priced</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-navy px-4 py-3 text-white">
                    <span className="text-[12px] font-extrabold">Total · {p.totals.deliveries} deliver{p.totals.deliveries === 1 ? "y" : "ies"}</span>
                    <span className="mono text-right text-[12px] font-extrabold">{litresValue(p.totals.received)} {p.unit}{p.totals.shortage ? ` · short ${litresValue(p.totals.shortage)}` : ""}{money ? <><br />{naira(p.totals.cost)}</> : null}</span>
                  </div>
                </div>
                <div className="hidden overflow-x-auto sm:block print:block">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={`${th} !text-left`}>Date</th>
                        <th className={`${th} !text-left`}>Driver · tanks</th>
                        <th className={th}>Ordered</th>
                        <th className={th}>Received</th>
                        <th className={th}>Shortage</th>
                        {money && <><th className={th}>Price</th><th className={th}>Cost</th><th className={th}>Short cost</th></>}
                      </tr>
                    </thead>
                    <tbody>
                      {p.days.map(d => (
                        <React.Fragment key={d.date}>
                          {d.loads.map((l, i) => (
                            <tr key={i} className="border-b border-surface align-top">
                              <td className="whitespace-nowrap px-2.5 py-2 text-[12px] font-semibold text-ink">{i === 0 ? <>{short(d.date)} <span className="text-ink-4">{d.day}</span></> : ""}</td>
                              <td className="px-2.5 py-2 text-[12px] text-ink">
                                <div className="font-bold">{l.driver || "—"}</div>
                                <div className="mono text-[10.5px] text-ink-4">{l.tanks.map(t => `${t.tank} ${litresValue(t.received)}`).join(" · ")}</div>
                              </td>
                              <td className={td}>{litresValue(l.ordered)}</td>
                              <td className={`${td} font-bold`}>{litresValue(l.received)}</td>
                              <td className={`${td} ${l.shortage > 0 ? "text-red" : l.shortage < 0 ? "text-green" : ""}`}>{l.shortage ? litresValue(l.shortage) : "—"}</td>
                              {money && (l.priced || l.partlyPriced ? (
                                <>
                                  <td className={td}>{(l.prices || []).map(x => litresValue(x)).join(" / ") || "—"}</td>
                                  <td className={`${td} font-bold`}>{naira(l.cost)}</td>
                                  <td className={td}>{l.shortageCost ? naira(l.shortageCost) : "—"}</td>
                                </>
                              ) : (
                                <td colSpan={3} className="px-2.5 py-2 text-right"><span className="rounded-full bg-red-light px-2 py-0.5 text-[10.5px] font-bold text-red">Not priced</span></td>
                              ))}
                            </tr>
                          ))}
                          {d.loads.length > 1 && (
                            <tr className="border-b border-border bg-surface">
                              <td className="px-2.5 py-2 text-[11px] font-extrabold text-ink" colSpan={2}>Day total · {short(d.date)}</td>
                              <td className={`${td} font-bold`}>{litresValue(d.ordered)}</td>
                              <td className={`${td} font-extrabold`}>{litresValue(d.received)}</td>
                              <td className={`${td} font-bold`}>{d.shortage ? litresValue(d.shortage) : "—"}</td>
                              {money && <><td className={td} /><td className={`${td} font-extrabold`}>{naira(d.cost)}</td><td className={`${td} font-bold`}>{d.shortageCost ? naira(d.shortageCost) : "—"}</td></>}
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      <tr className="bg-navy text-white">
                        <td className="px-2.5 py-2.5 text-[12px] font-extrabold" colSpan={2}>Total · {p.totals.deliveries} deliver{p.totals.deliveries === 1 ? "y" : "ies"}</td>
                        <td className="mono px-2.5 py-2.5 text-right text-[12px] font-bold">{litresValue(p.totals.ordered)}</td>
                        <td className="mono px-2.5 py-2.5 text-right text-[12px] font-extrabold">{litresValue(p.totals.received)}</td>
                        <td className="mono px-2.5 py-2.5 text-right text-[12px] font-bold">{p.totals.shortage ? litresValue(p.totals.shortage) : "—"}</td>
                        {money && <><td /><td className="mono px-2.5 py-2.5 text-right text-[12px] font-extrabold">{naira(p.totals.cost)}</td><td className="mono px-2.5 py-2.5 text-right text-[12px] font-bold">{p.totals.shortageCost ? naira(p.totals.shortageCost) : "—"}</td></>}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

            {money && data.products.length > 0 && (
              <div className="mb-2 rounded-[14px] border border-border bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-bold text-ink-3">All products · fuel cost</span>
                  <span className="mono text-[15px] font-extrabold text-ink">{naira(data.totals.cost)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[12px]">
                  <span className="text-ink-4">Shortage cost (oil loss)</span>
                  <span className="mono font-bold text-ink">{naira(data.totals.shortageCost)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
