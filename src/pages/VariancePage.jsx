import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

function todayStr() { return new Date().toISOString().split("T")[0] }
function weekAgoStr() { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().split("T")[0] }

function getAPI(action, extra = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false })
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", action)
  url.searchParams.set("station", STATION_KEY)
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
}

export default function VariancePage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle("Variance — MSO Limpid")
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState(weekAgoStr())
  const [dateTo, setDateTo] = useState(todayStr())

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getAPI("getVariance", { dateFrom, dateTo })
    if (res.ok) setData(res.variance || [])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  const totalVariance = data.reduce((s,r) => s + (r.variance||0), 0)

  return (
    <div className="min-h-screen bg-pagebg pb-16">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[200] border-b border-border bg-white shadow-sm" style={{ paddingTop: "max(var(--sat),52px)" }}>
        <div className="flex items-center gap-3 px-4 pb-3">
          <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">Stock Variance</div>
            <div className="text-[10px] text-ink-4">Dip vs Sales reconciliation</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        {/* Date range */}
        <div className="mb-4 flex items-center gap-3 rounded-[14px] bg-white p-4 shadow-sm">
          <div className="flex-1">
            <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.6px] text-ink-4">From</div>
            <input type="date" value={dateFrom} max={dateTo} onChange={e=>setDateFrom(e.target.value)} className="bg-transparent text-[14px] font-bold text-ink outline-none [color-scheme:light]" />
          </div>
          <div className="h-px w-6 bg-border" />
          <div className="flex-1">
            <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.6px] text-ink-4">To</div>
            <input type="date" value={dateTo} max={todayStr()} onChange={e=>setDateTo(e.target.value)} className="bg-transparent text-[14px] font-bold text-ink outline-none [color-scheme:light]" />
          </div>
        </div>

        {/* Summary */}
        {data.length > 0 && (
          <div className={`mb-4 flex items-center gap-3 rounded-[12px] px-4 py-3.5 ${totalVariance > 50 ? "bg-red-light" : totalVariance < -50 ? "bg-amber-light" : "bg-green-light"}`}>
            <i className={`bi text-[18px] ${totalVariance > 50 ? "bi-exclamation-triangle text-red" : totalVariance < -50 ? "bi-exclamation-circle text-amber" : "bi-check2-circle text-green"}`} />
            <div>
              <div className={`text-[13px] font-bold ${totalVariance > 50 ? "text-red" : totalVariance < -50 ? "text-amber" : "text-green"}`}>
                {totalVariance > 50 ? "Over-sold vs dip readings" : totalVariance < -50 ? "Short — unaccounted stock loss" : "Variance within acceptable range"}
              </div>
              <div className="text-[11px] opacity-70">Total variance: {totalVariance > 0 ? "+" : ""}{totalVariance.toFixed(0)}L across {data.length} records</div>
            </div>
          </div>
        )}

        {loading && <div className="flex justify-center py-12"><span className="h-6 w-6 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" /></div>}

        {!loading && data.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-[16px] bg-white py-14 text-center shadow-sm">
            <i className="bi bi-graph-up text-4xl text-ink-4" />
            <div className="text-[14px] font-bold text-ink">No variance data</div>
            <div className="text-[12.5px] text-ink-4">Dip readings and sales records are needed to calculate variance.</div>
          </div>
        )}

        <div className="space-y-2">
          {data.map((r,i) => (
            <div key={i} className="overflow-hidden rounded-[14px] bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-bold text-ink">{r.tank} — {r.date}</div>
                  <div className="text-[10.5px] text-ink-4">Opening: {r.openingDip}{r.unit || "L"} → Closing: {r.closingDip}{r.unit || "L"} (Δ {r.dipDiff}{r.unit || "L"})</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${r.status==="OK"?"bg-green-light text-green":r.status==="OVER"?"bg-cyan-light text-cyan-dark":"bg-red-light text-red"}`}>
                  {r.variance > 0 ? "+" : ""}{r.variance.toFixed(0)}L
                </span>
              </div>
              <div className="grid grid-cols-3 gap-px border-t border-surface bg-border">
                {[["Dip Loss",`${r.dipDiff.toFixed(0)}${r.unit || "L"}`,"text-ink"],["Sales",`${r.salesLitres.toFixed(0)}${r.unit || "L"}`,"text-cyan-dark"],["Variance",`${r.variance>0?"+":""}${r.variance.toFixed(0)}${r.unit || "L"}`,r.status==="OK"?"text-green":r.status==="OVER"?"text-cyan-dark":"text-red"]].map(([l,v,c])=>(
                  <div key={l} className="bg-white px-3 py-2">
                    <div className="text-[9px] font-bold text-ink-4">{l}</div>
                    <div className={`mono text-[12.5px] font-bold ${c}`}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
