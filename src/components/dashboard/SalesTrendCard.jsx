import React from "react"
import { naira } from "../../utils/format"

export default function SalesTrendCard({ status, weekly, pmsRevenue, agoRevenue }) {
  const loading = status === "loading" || status === "idle"
  const hasData = weekly && weekly.days && weekly.days.length > 0

  let bars = []
  if (hasData) {
    const max = Math.max(...weekly.pms, ...weekly.ago, 1)
    bars = weekly.days.map((day, i) => ({
      day,
      pmsHeight: Math.round((weekly.pms[i] / max) * 92),
      agoHeight: Math.round((weekly.ago[i] / max) * 92),
      isNow: i === weekly.days.length - 1,
    }))
  }

  return (
    <div className="h-full overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="border-b border-surface px-[18px] py-3.5">
        <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">7-Day Sales Trend</div>
        <div className="mt-0.5 text-[10.5px] text-ink-4">PMS vs AGO · litres dispensed</div>
      </div>

      <div className="p-[18px]">
        <div className="mb-3 flex gap-4">
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-2">
            <span className="h-[9px] w-[9px] rounded-sm bg-cyan" /> PMS Petrol
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-2">
            <span className="h-[9px] w-[9px] rounded-sm bg-[#F59E0B]" /> AGO Diesel
          </div>
        </div>

        <div className="mb-3 flex h-24 items-end gap-[5px]">
          {loading || !hasData
            ? Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="skel block h-full w-full rounded-t" />
                </div>
              ))
            : bars.map(b => (
                <div key={b.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-[92px] w-full items-end gap-0.5">
                    <div
                      className="flex-1 rounded-t-[3px] bg-gradient-to-t from-cyan-dark to-cyan transition-opacity hover:opacity-70"
                      style={{ height: `${Math.max(b.pmsHeight, 3)}px` }}
                    />
                    <div
                      className="flex-1 rounded-t-[3px] bg-gradient-to-t from-[#92400E] to-[#F59E0B] transition-opacity hover:opacity-70"
                      style={{ height: `${Math.max(b.agoHeight, 3)}px` }}
                    />
                  </div>
                  <div className={`text-[9px] font-semibold ${b.isNow ? "font-extrabold text-cyan" : "text-ink-4"}`}>
                    {b.day}
                  </div>
                </div>
              ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[11px] border border-cyan/20 bg-cyan-light p-3">
            <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.8px] text-cyan-dark">
              PMS Revenue
            </div>
            <div className="mono mb-0.5 text-[15px] font-extrabold text-ink">
              {loading ? <span className="skel inline-block h-4 w-20" /> : naira(pmsRevenue)}
            </div>
            <div className="text-[10.5px] text-ink-4">—</div>
          </div>
          <div className="rounded-[11px] border border-[#FDE68A] bg-amber-light p-3">
            <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.8px] text-amber">
              AGO Revenue
            </div>
            <div className="mono mb-0.5 text-[15px] font-extrabold text-ink">
              {loading ? <span className="skel inline-block h-4 w-20" /> : naira(agoRevenue)}
            </div>
            <div className="text-[10.5px] text-ink-4">—</div>
          </div>
        </div>
      </div>
    </div>
  )
}
