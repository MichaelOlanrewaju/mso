import React, { useState } from "react"
import { naira } from "../../utils/format"
import { motion, AnimatePresence, CountUp, EASE } from "../motion"
import { litres } from "../../utils/format"

export default function SalesTrendCard({ status, weekly, pmsRevenue, agoRevenue }) {
  const loading = status === "loading" || status === "idle"
  const hasData = weekly && weekly.days && weekly.days.length > 0
  const [hover, setHover] = useState(null)

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
    <div className="h-full overflow-hidden rounded-panel border border-border bg-white shadow-card transition-all duration-300 hover:-translate-y-[2px] hover:shadow-lift">
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
            <span className="h-[9px] w-[9px] rounded-sm bg-[var(--brand-accent)]" /> AGO Diesel
          </div>
        </div>

        <div className="mb-3 flex h-24 items-end gap-[5px]">
          {loading || !hasData
            ? Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="skel block h-full w-full rounded-t" />
                </div>
              ))
            : bars.map((b, i) => (
                <div key={b.day} className="relative flex flex-1 cursor-pointer flex-col items-center gap-1 transition-opacity duration-200"
                  style={{ opacity: hover !== null && hover !== i ? 0.45 : 1 }}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(hover === i ? null : i)}>
                  <AnimatePresence>
                    {hover === i && (
                      <motion.div key="tip" initial={{ opacity: 0, y: 6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-[10px] border border-border bg-white px-2.5 py-1.5 text-[10.5px] shadow-lift">
                        <div className="font-extrabold text-ink">{b.day}</div>
                        <div className="text-ink-3">PMS <span className="mono font-bold text-ink">{litres(weekly.pms[i] || 0)}</span></div>
                        <div className="text-ink-3">AGO <span className="mono font-bold text-ink">{litres(weekly.ago[i] || 0)}</span></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex h-[92px] w-full items-end gap-0.5">
                    <motion.div
                      className="flex-1 origin-bottom rounded-t-[3px] bg-gradient-to-t from-cyan-dark to-cyan transition-opacity hover:opacity-70"
                      initial={{ height: 0 }} animate={{ height: Math.max(b.pmsHeight, 3) }}
                      transition={{ duration: 0.6, ease: EASE, delay: 0.1 + i * 0.06 }}
                    />
                    <motion.div
                      className="flex-1 origin-bottom rounded-t-[3px] bg-gradient-to-t from-[#1188B5] to-[var(--brand-accent)] transition-opacity hover:opacity-70"
                      initial={{ height: 0 }} animate={{ height: Math.max(b.agoHeight, 3) }}
                      transition={{ duration: 0.6, ease: EASE, delay: 0.15 + i * 0.06 }}
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
              {loading ? <span className="skel inline-block h-4 w-20" /> : <CountUp value={naira(pmsRevenue)} />}
            </div>
            <div className="text-[10.5px] text-ink-4">—</div>
          </div>
          <div className="rounded-[11px] border border-[#BEE6F5] bg-amber-light p-3">
            <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.8px] text-amber">
              AGO Revenue
            </div>
            <div className="mono mb-0.5 text-[15px] font-extrabold text-ink">
              {loading ? <span className="skel inline-block h-4 w-20" /> : <CountUp value={naira(agoRevenue)} />}
            </div>
            <div className="text-[10.5px] text-ink-4">—</div>
          </div>
        </div>
      </div>
    </div>
  )
}
