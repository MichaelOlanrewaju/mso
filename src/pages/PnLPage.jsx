import React, { useCallback, useEffect, useMemo, useState } from "react"
import { getStation } from "../config/stations"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, litres } from "../utils/format"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"

function toISO(d) { return d.toISOString().split("T")[0] }

/* Confirmed directly: the date picker should be structured, not a
   freeform "pick any two dates" pair — Week always runs Sunday to
   Saturday, Month always runs the 1st to the actual last day (28-31,
   whichever the month has), Year runs Jan 1 to Dec 31. offset moves
   backward/forward by whole periods from the current one (0 = this
   week/month/year, -1 = the previous one, etc.), the same pattern as
   a calendar app's prev/next arrows. */
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
  if (mode === "year") {
    const y = today.getFullYear() + offset
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y), subLabel: "1 Jan – 31 Dec" }
  }
  // month
  const ref = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  return {
    from: toISO(first), to: toISO(last),
    label: ref.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    subLabel: `1 – ${last.getDate()} ${ref.toLocaleDateString("en-GB", { month: "short" })}`,
  }
}

function getAPI(action, extra = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false })
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", action)
  url.searchParams.set("station", activeStation())
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
}

function SummaryRow({ label, value, tone, hint, expandable, open, onToggle, children }) {
  const toneClass = tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-navy"
  return (
    <div className="overflow-hidden rounded-[16px] bg-white shadow-sm">
      {expandable ? (
        <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <div className="flex items-center gap-2">
            <div className="text-[12.5px] font-bold text-ink">{label}</div>
            <i className={`bi bi-chevron-down text-[10px] text-ink-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
          <div className={`mono text-[15px] font-extrabold ${toneClass}`}>{value}</div>
        </button>
      ) : (
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-[12.5px] font-bold text-ink">{label}</div>
          <div className={`mono text-[15px] font-extrabold ${toneClass}`}>{value}</div>
        </div>
      )}
      {hint && <div className="border-t border-surface px-4 py-2.5 text-[12px] text-ink-4">{hint}</div>}
      {expandable && open && <div className="border-t border-surface bg-surface">{children}</div>}
    </div>
  )
}

export default function PnLPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle(`P&L — ${getStation(activeStation()).name}`)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState("month") // "week" | "month" | "year"
  const [offset, setOffset] = useState(0)
  const [expanded, setExpanded] = useState(null) // "revenue" | "stockCost" | "expenses" | null

  const range = useMemo(() => rangeFor(mode, offset), [mode, offset])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAPI("getPnL", { dateFrom: range.from, dateTo: range.to, username: auth.username, token: getToken() })
      if (res.ok) setData(res)
      else setError(res.error || "Couldn't load P&L data.")
    } catch (e) {
      // Was uncaught before — a thrown error (bad JSON from the backend,
      // a network failure) meant setLoading(false) never ran at all,
      // leaving the page spinning forever with no explanation. Confirmed
      // directly this is what "page isn't loading" actually was.
      setError("Something went wrong loading this page. " + String(e.message || e))
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to, auth.username])

  useEffect(() => { load() }, [load])

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />
  if (!auth.isGM && !auth.isOwner && auth.role !== "ceo" && auth.role !== "owner") {
    return <div className="flex min-h-screen items-center justify-center"><div className="text-[14px] font-bold text-ink">Restricted to GM and Owner.</div></div>
  }

  return (
    <div className="min-h-screen bg-pagebg pb-16">
      <SafeAreaDebug />

      {/* Dark header */}
      <div style={{ background: "linear-gradient(135deg,#06091A,#0D1226)" }}>
        <div className="mx-auto max-w-[640px] px-4 pb-5 pt-[max(var(--sat),52px)] lg:max-w-[960px]">
          <div className="mb-4 flex items-center gap-3">
            <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/10 bg-white/5 text-white/70">
              <i className="bi bi-arrow-left" />
            </button>
            <div>
              <div className="text-[17px] font-extrabold text-white">Profit &amp; Loss</div>
              <div className="text-[10px] text-white/40">{getStation(activeStation()).legalName}</div>
            </div>
          </div>

          {/* Week / Month / Year toggle */}
          <div className="mb-3 flex gap-2">
            {[["week", "Week"], ["month", "Month"], ["year", "Year"]].map(([m, l]) => (
              <button key={m} type="button" onClick={() => { setMode(m); setOffset(0) }}
                className={`flex-1 rounded-[10px] py-2 text-[12px] font-bold ${mode === m ? "bg-cyan text-white" : "bg-white/10 text-white/60"}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Prev / period label / next */}
          <div className="mb-4 flex items-center justify-between rounded-[12px] bg-white/5 px-2 py-1.5">
            <button type="button" onClick={() => setOffset(o => o - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-white/70 active:bg-white/10">
              <i className="bi bi-chevron-left" />
            </button>
            <div className="text-center">
              <div className="text-[13px] font-bold text-white">{range.label}</div>
              {range.subLabel && <div className="text-[10px] text-white/40">{range.subLabel}</div>}
            </div>
            <button type="button" onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset >= 0}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-white/70 active:bg-white/10 disabled:opacity-30">
              <i className="bi bi-chevron-right" />
            </button>
          </div>

          {/* Big net profit number */}
          {data && (
            <>
              <div className="mb-0.5 text-[9.5px] font-bold uppercase tracking-[1px] text-white/40">Net Profit</div>
              <div className="mono mb-1 text-[34px] font-extrabold leading-none text-white">
                {naira(data.netProfit)}
              </div>
              <div className="text-[11px] text-white/40">{data.margin}% margin</div>
            </>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4 lg:max-w-[960px]">
        {loading && <div className="flex justify-center py-12"><span className="h-6 w-6 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" /></div>}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 rounded-[16px] bg-white px-6 py-10 text-center shadow-sm">
            <i className="bi bi-exclamation-circle text-3xl text-red" />
            <div className="text-[13px] font-bold text-ink">Couldn't load this page</div>
            <div className="text-[12px] text-ink-4">{error}</div>
            <button type="button" onClick={load}
              className="mt-1 rounded-full bg-navy px-4 py-2 text-[12.5px] font-bold text-white">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-3">
            {/* Unpriced deliveries — real cost sitting outside the
                calculation entirely until GM prices them. Shown as its
                own banner rather than silently missing, since a stock
                cost that looks low just because pricing hasn't happened
                yet is misleading, not good news. */}
            {data.dischargeLines?.some(l => !l.priced) && (
              <div className="flex items-start gap-2.5 rounded-[14px] border border-amber/25 bg-amber-light px-4 py-3.5">
                <i className="bi bi-exclamation-triangle-fill mt-0.5 text-[13px] text-amber" />
                <div className="text-[12px] leading-relaxed text-amber">
                  <strong>{data.dischargeLines.filter(l => !l.priced).length} deliver{data.dischargeLines.filter(l => !l.priced).length !== 1 ? "ies" : "y"} in this period not yet priced by GM.</strong> Their real cost isn't reflected in Stock Cost or Net Profit below until they are.
                </div>
              </div>
            )}

            {/* Revenue */}
            <SummaryRow label="Revenue" value={naira(data.revenue)} tone="navy"
              hint={data.litresSold ? `${litres(data.litresSold)} sold` : "No sales data"}
              expandable open={expanded === "revenue"} onToggle={() => setExpanded(v => v === "revenue" ? null : "revenue")}>
              {data.dailyBreakdown?.length > 0 ? [...data.dailyBreakdown].reverse().map(d => (
                <div key={d.date} className="flex items-center justify-between border-b border-border px-4 py-2.5 text-[12px] last:border-b-0">
                  <span className="text-ink-3">{d.date}</span>
                  <span className="mono font-bold text-navy">{naira(d.revenue)}</span>
                </div>
              )) : <div className="px-4 py-3 text-[12px] text-ink-4">No daily data for this range.</div>}
            </SummaryRow>

            {/* Stock Cost */}
            <SummaryRow label="Stock Cost" value={`− ${naira(data.stockCost)}`} tone="red"
              hint="From priced discharge records"
              expandable open={expanded === "stockCost"} onToggle={() => setExpanded(v => v === "stockCost" ? null : "stockCost")}>
              {data.dischargeLines?.length > 0 ? data.dischargeLines.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 text-[12px] last:border-b-0">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink-2">{l.supplier || "—"} · {l.product}</div>
                    <div className="text-[10.5px] text-ink-4">{l.date} · {litres(l.litres)}</div>
                  </div>
                  {l.priced ? (
                    <span className="mono flex-shrink-0 font-bold text-navy">{naira(l.total)}</span>
                  ) : (
                    <span className="flex-shrink-0 rounded-full bg-amber-light px-2 py-0.5 text-[10px] font-bold text-amber">Not priced</span>
                  )}
                </div>
              )) : <div className="px-4 py-3 text-[12px] text-ink-4">No deliveries for this range.</div>}
            </SummaryRow>

            {/* Gross Profit */}
            <div className="overflow-hidden rounded-[16px] border-2 border-cyan/20 bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="text-[13px] font-extrabold text-ink">Gross Profit</div>
                <div className={`mono text-[16px] font-extrabold ${data.grossProfit >= 0 ? "text-green" : "text-red"}`}>{naira(data.grossProfit)}</div>
              </div>
            </div>

            {/* Expenses */}
            <SummaryRow label="Expenses" value={`− ${naira(data.expenses)}`} tone="red"
              hint="Operating expenses for the period"
              expandable open={expanded === "expenses"} onToggle={() => setExpanded(v => v === "expenses" ? null : "expenses")}>
              {data.expenseLines?.length > 0 ? data.expenseLines.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 text-[12px] last:border-b-0">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink-2">{l.description || "—"}</div>
                    <div className="text-[10.5px] text-ink-4">{l.date}{l.submittedBy ? ` · ${l.submittedBy}` : ""}</div>
                  </div>
                  <span className="mono flex-shrink-0 font-bold text-red">− {naira(l.amount)}</span>
                </div>
              )) : <div className="px-4 py-3 text-[12px] text-ink-4">No expenses for this range.</div>}
            </SummaryRow>

            {/* Staff Salary — confirmed directly: once GM's payroll for a
                month is approved, that's real money going out and Net
                Profit below should reflect it. Kept as its own line
                rather than folded into Expenses, since it comes from a
                completely different sheet/process (Payroll approval,
                not the day-to-day Expenses log). */}
            {data.staffSalary > 0 && (
              <SummaryRow label="Staff Salary" value={`− ${naira(data.staffSalary)}`} tone="red"
                hint={data.staffSalaryMonths?.length ? `Approved payroll: ${data.staffSalaryMonths.join(", ")}` : "Approved payroll for this period"} />
            )}

            {/* Net Profit */}
            <div className={`overflow-hidden rounded-[16px] shadow-sm ${data.netProfit >= 0 ? "bg-green-light" : "bg-red-light"}`}>
              <div className="flex items-center justify-between px-4 py-4">
                <div>
                  <div className={`text-[14px] font-extrabold ${data.netProfit >= 0 ? "text-green" : "text-red"}`}>Net Profit</div>
                  <div className={`text-[11px] ${data.netProfit >= 0 ? "text-green/70" : "text-red/70"}`}>{data.margin}% net margin</div>
                </div>
                <div className={`mono text-[20px] font-extrabold ${data.netProfit >= 0 ? "text-green" : "text-red"}`}>{naira(data.netProfit)}</div>
              </div>
              {/* The formula, spelled out plainly — confirmed directly
                  CEO wasn't sure the number was right; showing exactly
                  how it's built is more reassuring than just asserting
                  it's correct. */}
              <div className="border-t border-black/5 px-4 py-3 text-[11px] leading-relaxed text-ink-3">
                {naira(data.revenue)} revenue − {naira(data.stockCost)} stock − {naira(data.expenses)} expenses
                {data.staffSalary > 0 ? ` − ${naira(data.staffSalary)} salary` : ""} = <strong>{naira(data.netProfit)}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
