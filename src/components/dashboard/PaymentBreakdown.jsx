import React, { useState } from "react"
import { naira } from "../../utils/format"
import { motion, CountUp, StateSwap, EASE } from "../motion"

/* Donut + legend. Segments draw in one after another; hovering (or tapping) a
   legend row or a segment highlights it and dims the rest. Same data as
   before — name, amount, colour — and the same Grand Total. */
const R = 46
const C = 2 * Math.PI * R
const GAP = 3

function Donut({ payments, total, active, setActive }) {
  let acc = 0
  return (
    <div className="relative mx-auto h-[148px] w-[148px] flex-shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#EEF2F7" strokeWidth="15" />
        {payments.map((p, i) => {
          const share = total > 0 ? p.amount / total : 0
          const len = Math.max(0, share * C - (payments.length > 1 ? GAP : 0))
          const offset = -acc
          acc += share * C
          const dim = active !== null && active !== i
          return (
            <motion.circle
              key={p.name}
              cx="60" cy="60" r={R} fill="none" stroke={p.color} strokeWidth={active === i ? 18 : 15}
              strokeLinecap="butt"
              strokeDashoffset={offset}
              initial={{ strokeDasharray: `0 ${C}`, opacity: 0 }}
              animate={{ strokeDasharray: `${len} ${C - len}`, opacity: dim ? 0.3 : 1 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.18 }}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
              onClick={() => setActive(active === i ? null : i)}
              style={{ cursor: "pointer" }}
            />
          )
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[9px] font-bold uppercase tracking-[1px] text-ink-4">
          {active !== null ? payments[active].name : "Total"}
        </div>
        <div className="mono text-[13px] font-extrabold text-ink">
          <CountUp value={naira(active !== null ? payments[active].amount : total)} duration={0.5} />
        </div>
      </div>
    </div>
  )
}

function dayLabel(d) {
  if (!d) return "Yesterday"
  const dt = new Date(`${d}T12:00:00`)
  if (isNaN(dt)) return "Yesterday"
  return `Yesterday · ${dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`
}

export default function PaymentBreakdown({ status, payments, date }) {
  const loading = status === "loading" || status === "idle"
  const hasData = payments && payments.length > 0
  const [active, setActive] = useState(null)
  const total = hasData ? payments.reduce((s, p) => s + p.amount, 0) : 0

  return (
    <div className="h-full overflow-hidden rounded-panel border border-border bg-white shadow-card transition-all duration-300 hover:-translate-y-[2px] hover:shadow-lift">
      <div className="border-b border-surface px-[18px] py-3.5">
        <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">Payment Breakdown</div>
        <div className="mt-0.5 text-[10.5px] text-ink-4">{dayLabel(date)} · POS · Transfer · Cash</div>
      </div>

      <div className="p-[18px]">
        <StateSwap stateKey={loading ? "skel" : !hasData ? "empty" : "data"}>
          {loading ? (
            <div className="flex items-center gap-5">
              <span className="skel block h-[120px] w-[120px] flex-shrink-0 !rounded-full" />
              <div className="flex-1 space-y-3">
                <span className="skel block h-3.5 rounded-md" />
                <span className="skel block h-3.5 rounded-md" />
                <span className="skel block h-3.5 rounded-md" />
              </div>
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <i className="bi bi-pie-chart text-3xl text-ink-4 opacity-50" />
              <div className="text-[13px] font-bold text-ink">No payments recorded for yesterday</div>
              <div className="max-w-[260px] text-[11.5px] text-ink-4">
                Yesterday's POS, transfer and cash totals show here once that day's cash-up has been submitted.
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <Donut payments={payments} total={total} active={active} setActive={setActive} />
              <div className="w-full min-w-0 flex-1">
                {payments.map((p, i) => (
                  <motion.div
                    key={p.name}
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: active !== null && active !== i ? 0.4 : 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + i * 0.1 }}
                    onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
                    className="flex cursor-default items-center justify-between rounded-lg border-b border-surface px-1.5 py-[9px] transition-colors last:border-none hover:bg-surface"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: p.color }} />
                      <div>
                        <div className="text-[12.5px] font-semibold text-ink">{p.name}</div>
                        <div className="mt-px text-[10.5px] text-ink-4">{total > 0 ? Math.round((p.amount / total) * 100) : 0}%</div>
                      </div>
                    </div>
                    <div className="mono text-[13.5px] font-bold text-ink"><CountUp value={naira(p.amount)} /></div>
                  </motion.div>
                ))}
                <div className="mt-1 flex items-center justify-between border-t border-border px-1.5 pt-2.5">
                  <span className="text-[11.5px] text-ink-3">Grand Total</span>
                  <span className="mono text-base font-extrabold text-navy"><CountUp value={naira(total)} /></span>
                </div>
              </div>
            </div>
          )}
        </StateSwap>
      </div>
    </div>
  )
}
