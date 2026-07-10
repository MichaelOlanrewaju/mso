import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira } from "../utils/format"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

function todayStr() { return new Date().toISOString().split("T")[0] }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01` }

function getAPI(action, extra = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false })
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", action)
  url.searchParams.set("station", STATION_KEY)
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
}

export default function PnLPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle("P&L — MSO Limpid")
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(todayStr())
  const [preset, setPreset] = useState("month")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getAPI("getPnL", { dateFrom, dateTo })
    if (res.ok) setData(res)
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const setPresetRange = (p) => {
    setPreset(p)
    const today = new Date()
    if (p === "today") { setDateFrom(todayStr()); setDateTo(todayStr()) }
    else if (p === "week") { const d = new Date(); d.setDate(d.getDate()-7); setDateFrom(d.toISOString().split("T")[0]); setDateTo(todayStr()) }
    else if (p === "month") { setDateFrom(monthStart()); setDateTo(todayStr()) }
  }

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />
  if (!auth.isGM && !auth.isOwner && auth.role !== "owner") {
    return <div className="flex min-h-screen items-center justify-center"><div className="text-[14px] font-bold text-ink">Restricted to GM and Owner.</div></div>
  }

  return (
    <div className="min-h-screen bg-pagebg pb-16">
      <SafeAreaDebug />

      {/* Dark header */}
      <div style={{ background:"linear-gradient(135deg,#06091A,#0D1226)" }}>
        <div className="px-4 pb-5 pt-[max(var(--sat),52px)]">
          <div className="flex items-center gap-3 mb-4">
            <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/10 bg-white/5 text-white/70">
              <i className="bi bi-arrow-left" />
            </button>
            <div>
              <div className="text-[17px] font-extrabold text-white">Profit &amp; Loss</div>
              <div className="text-[10px] text-white/40">MSO Limpid Co. Ltd</div>
            </div>
          </div>

          {/* Preset buttons */}
          <div className="flex gap-2 mb-4">
            {[["today","Today"],["week","This Week"],["month","This Month"]].map(([p,l])=>(
              <button key={p} type="button" onClick={()=>setPresetRange(p)}
                className={`rounded-full px-3.5 py-1.5 text-[11.5px] font-bold ${preset===p?"bg-cyan text-white":"bg-white/10 text-white/60"}`}>{l}</button>
            ))}
          </div>

          {/* Big net profit number */}
          {data && (
            <>
              <div className="text-[9.5px] font-bold uppercase tracking-[1px] text-white/40 mb-0.5">Net Profit</div>
              <div className={`mono text-[34px] font-extrabold text-white leading-none mb-1`}>
                {naira(data.netProfit)}
              </div>
              <div className="text-[11px] text-white/40">{data.margin}% margin · {dateFrom} to {dateTo}</div>
            </>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        {/* Custom date range */}
        <div className="mb-4 flex items-center gap-3 rounded-[14px] bg-white p-4 shadow-sm">
          <div className="flex-1">
            <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.6px] text-ink-4">From</div>
            <input type="date" value={dateFrom} max={dateTo} onChange={e=>{setDateFrom(e.target.value);setPreset("custom")}} className="bg-transparent text-[14px] font-bold text-ink outline-none [color-scheme:light]" />
          </div>
          <div className="h-px w-6 bg-border"/>
          <div className="flex-1">
            <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.6px] text-ink-4">To</div>
            <input type="date" value={dateTo} max={todayStr()} onChange={e=>{setDateTo(e.target.value);setPreset("custom")}} className="bg-transparent text-[14px] font-bold text-ink outline-none [color-scheme:light]" />
          </div>
        </div>

        {loading && <div className="flex justify-center py-12"><span className="h-6 w-6 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan"/></div>}

        {!loading && data && (
          <div className="space-y-3">
            {/* Revenue */}
            <div className="overflow-hidden rounded-[16px] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-surface px-4 py-3">
                <div className="text-[12.5px] font-bold text-ink">Revenue</div>
                <div className="mono text-[15px] font-extrabold text-navy">{naira(data.revenue)}</div>
              </div>
              <div className="px-4 py-3 text-[12px] text-ink-4">{data.litresSold ? `${Number(data.litresSold).toLocaleString("en-NG")}L sold` : "No sales data"}</div>
            </div>

            {/* Cost of Stock */}
            <div className="overflow-hidden rounded-[16px] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-surface px-4 py-3">
                <div className="text-[12.5px] font-bold text-ink">Stock Cost</div>
                <div className="mono text-[15px] font-extrabold text-red">− {naira(data.stockCost)}</div>
              </div>
              <div className="px-4 py-3 text-[12px] text-ink-4">From priced discharge records</div>
            </div>

            {/* Gross Profit */}
            <div className="overflow-hidden rounded-[16px] border-2 border-cyan/20 bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="text-[13px] font-extrabold text-ink">Gross Profit</div>
                <div className={`mono text-[16px] font-extrabold ${data.grossProfit >= 0 ? "text-green" : "text-red"}`}>{naira(data.grossProfit)}</div>
              </div>
            </div>

            {/* Expenses */}
            <div className="overflow-hidden rounded-[16px] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-surface px-4 py-3">
                <div className="text-[12.5px] font-bold text-ink">Expenses</div>
                <div className="mono text-[15px] font-extrabold text-red">− {naira(data.expenses)}</div>
              </div>
              <div className="px-4 py-3 text-[12px] text-ink-4">Operating expenses for the period</div>
            </div>

            {/* Net Profit */}
            <div className={`overflow-hidden rounded-[16px] shadow-sm ${data.netProfit >= 0 ? "bg-green-light" : "bg-red-light"}`}>
              <div className="flex items-center justify-between px-4 py-4">
                <div>
                  <div className={`text-[14px] font-extrabold ${data.netProfit >= 0 ? "text-green" : "text-red"}`}>Net Profit</div>
                  <div className={`text-[11px] ${data.netProfit >= 0 ? "text-green/70" : "text-red/70"}`}>{data.margin}% net margin</div>
                </div>
                <div className={`mono text-[20px] font-extrabold ${data.netProfit >= 0 ? "text-green" : "text-red"}`}>{naira(data.netProfit)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
