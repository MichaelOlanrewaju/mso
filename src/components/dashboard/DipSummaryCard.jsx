import React from "react"
import { numberNG, naira } from "../../utils/format"

function Row({ tank }) {
  const empty = tank.diff === 0
  return (
    <tr className="border-b border-surface last:border-none hover:bg-[#FAFBFE]">
      <td className="px-3.5 py-2.5">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-[3px] text-[10.5px] font-bold
            ${empty ? "border-border bg-surface text-ink-3" : "border-cyan/20 bg-cyan-light text-cyan-dark"}`}
        >
          {tank.id}
        </span>
      </td>
      <td className={`mono px-3.5 py-2.5 font-semibold ${empty ? "text-ink-4" : ""}`}>
        {numberNG(tank.opening)}L
      </td>
      <td className={`mono px-3.5 py-2.5 ${empty ? "text-ink-4" : ""}`}>{numberNG(tank.closing)}L</td>
      <td className={`mono px-3.5 py-2.5 font-bold ${empty ? "text-ink-4" : "text-cyan-dark"}`}>
        {numberNG(tank.diff)}L
      </td>
      <td className={`mono px-3.5 py-2.5 font-bold ${empty ? "text-ink-4" : "text-amber"}`}>
        {Number(tank.margin).toFixed(2)}L
      </td>
    </tr>
  )
}

export default function DipSummaryCard({ status, tanks, pmsPrice }) {
  const loading = status === "loading" || status === "idle"
  const price = Number(pmsPrice) || 1272

  let totalMargin = 0
  let totalRevenue = 0
  if (tanks) {
    tanks.forEach(t => {
      totalMargin += t.margin
      totalRevenue += t.diff * price
    })
  }

  return (
    <div className="h-full overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="flex items-start justify-between gap-2.5 border-b border-surface px-[18px] py-3.5">
        <div>
          <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">PMS Dipping Summary</div>
          <div className="mt-0.5 text-[10.5px] text-ink-4">3 underground tanks · today</div>
        </div>
        <span className="inline-flex items-center rounded-full border border-cyan/20 bg-cyan-light px-2.5 py-[3px] text-[10.5px] font-bold text-cyan-dark">
          PMS
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Tank", "Opening", "Closing", "Diff", "Margin"].map(h => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b border-border bg-surface px-3.5 py-[9px] text-left text-[9.5px] font-bold uppercase tracking-[1px] text-ink-4"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading || !tanks ? (
              <tr>
                <td colSpan={5} className="px-3.5 py-5 text-center">
                  <span className="skel mx-auto block h-3.5 w-[180px]" />
                </td>
              </tr>
            ) : (
              tanks.map(t => <Row key={t.id} tank={t} />)
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-cyan/[0.15] bg-cyan-light px-[18px] py-[11px]">
        <span className="text-[12.5px] font-bold text-navy">Total PMS Margin</span>
        <span className="mono text-sm font-extrabold text-cyan-dark">
          {loading || !tanks ? "—" : `${totalMargin.toFixed(2)}L · ${naira(totalRevenue)}`}
        </span>
      </div>
    </div>
  )
}
