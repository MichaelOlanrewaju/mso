import React, { useCallback, useEffect, useState } from "react"
import { naira, litres } from "../../utils/format"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

function usePeriodTotals() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!SCRIPT_URL) { setLoading(false); return }
    setLoading(true)
    try {
      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "getPeriodTotals")
      url.searchParams.set("station", STATION_KEY)
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
      if (res.ok) setData(res)
    } catch (e) {
      // leave data as-is; card just shows its loading/empty state
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  return { data, loading, refresh: load }
}

function StatRow({ icon, label, value, sub, valueColor }) {
  return (
    <div className="flex items-center justify-between border-b border-surface px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-surface text-[13px] text-ink-3">
          <i className={`bi ${icon}`} />
        </div>
        <div>
          <div className="text-[12.5px] font-semibold text-ink-2">{label}</div>
          {sub && <div className="mono text-[10.5px] text-ink-4">{sub}</div>}
        </div>
      </div>
      <div className={`mono text-[14px] font-extrabold ${valueColor || "text-ink"}`}>{value}</div>
    </div>
  )
}

export default function PeriodTotalsCard() {
  const { data, loading } = usePeriodTotals()
  const [period, setPeriod] = useState("today") // "today" | "week" | "month" | "year"

  if (loading) {
    return (
      <div className="rounded-card border border-border bg-white p-4 shadow-card">
        <div className="mb-3 text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">Totals</div>
        <div className="flex justify-center py-8">
          <span className="h-5 w-5 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const bucket = data[period] || {}
  const periodLabel = period === "today" ? "So far today — updates live"
    : period === "week" ? "Since " + new Date(data.weekStart).toLocaleDateString("en-NG", { day: "numeric", month: "short" })
    : period === "month" ? new Date(data.monthStart).toLocaleDateString("en-NG", { month: "long", year: "numeric" })
    : new Date(data.yearStart).getFullYear()

  return (
    <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">Totals</div>
        <div className="flex gap-1 rounded-full bg-surface p-1">
          {[["today", "Today"], ["week", "Week"], ["month", "Month"], ["year", "Year"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setPeriod(k)}
              className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold transition ${period === k ? "bg-navy text-white" : "text-ink-4"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-4 pb-1 pt-1.5 text-[10.5px] text-ink-4">
        {period === "today" && <span className="h-1.5 w-1.5 rounded-full bg-green" />}
        {periodLabel}
      </div>

      {/* Revenue hero strip */}
      <div className="mx-4 my-3 overflow-hidden rounded-[12px]" style={{ background: "linear-gradient(135deg,#130656,#1a0875)" }}>
        <div className="grid grid-cols-2 divide-x divide-white/10 px-1 py-3.5">
          <div className="px-3 text-center">
            <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-white/50">Total Revenue</div>
            <div className="mono mt-1 text-[16px] font-extrabold text-white">{naira(bucket.totalRevenue)}</div>
          </div>
          <div className="px-3 text-center">
            <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-white/50">Net (after cost)</div>
            <div className={`mono mt-1 text-[16px] font-extrabold ${bucket.netProfit >= 0 ? "text-white" : "text-red"}`}>{naira(bucket.netProfit)}</div>
          </div>
        </div>
      </div>

      {/* Fuel sold */}
      <div className="px-4 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Fuel Sold</div>
      <div>
        <StatRow icon="bi-fuel-pump" label="PMS Sold" value={litres(bucket.pmsLitres)} sub={naira(bucket.pmsRevenue)} valueColor="text-navy" />
        <StatRow icon="bi-fuel-pump-diesel" label="AGO Sold" value={litres(bucket.agoLitres)} sub={naira(bucket.agoRevenue)} valueColor="text-navy" />
      </div>

      {/* Costs & issues */}
      <div className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Costs & Issues</div>
      <div>
        <StatRow icon="bi-arrow-down-circle" label="Expenses" value={naira(bucket.expenses)} valueColor="text-red" />
        <StatRow icon="bi-truck" label="Discharge Bought" value={naira(bucket.dischargeCost)}
          sub={`${litres(bucket.dischargeLitres)} · ${bucket.dischargeCount} record${bucket.dischargeCount !== 1 ? "s" : ""}`} valueColor="text-ink" />
        <StatRow icon="bi-exclamation-triangle" label="Discharge Shortage" value={naira(bucket.dischargeShortageAmount)}
          sub={bucket.dischargeShortageLitres > 0 ? litres(bucket.dischargeShortageLitres) + " short" : "None"}
          valueColor={bucket.dischargeShortageAmount > 0 ? "text-red" : "text-green"} />
        <StatRow icon="bi-flag" label="Station Shortage" value={naira(bucket.stationShortage)}
          sub={`${bucket.shortageCount} report${bucket.shortageCount !== 1 ? "s" : ""}`}
          valueColor={bucket.stationShortage > 0 ? "text-red" : "text-green"} />
      </div>
    </div>
  )
}
