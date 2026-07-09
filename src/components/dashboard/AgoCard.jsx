import React from "react"
import { numberNG, naira } from "../../utils/format"

function DataBox({ label, value, bg, border, color }) {
  return (
    <div className="rounded-[10px] p-3" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.8px]" style={{ color }}>
        {label}
      </div>
      <div className="mono text-lg font-extrabold" style={{ color: label === "Opening" || label === "Closing" ? "#0F172A" : color }}>
        {value}
      </div>
    </div>
  )
}

export default function AgoCard({ status, ago, agoPrice }) {
  const loading = status === "loading" || status === "idle"
  const hasData = Boolean(ago)
  const price = Number(agoPrice) || 1819

  const pct = hasData && ago.capacity > 0 ? Math.round((ago.closing / ago.capacity) * 100) : 0
  const revenue = hasData ? ago.diff * price : 0

  return (
    <div className="h-full overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="flex items-start justify-between gap-2.5 border-b border-surface px-[18px] py-3.5">
        <div>
          <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">AGO Performance</div>
          <div className="mt-0.5 text-[10.5px] text-ink-4">TK4 · Diesel · P1·N1</div>
        </div>
        <span className="inline-flex h-fit items-center rounded-full border border-[#FDE68A] bg-amber-light px-2.5 py-[3px] text-[10.5px] font-bold text-amber">
          {loading || !hasData ? "—" : `${pct}%`}
        </span>
      </div>

      <div className="p-[18px]">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <DataBox
            label="Opening"
            value={loading || !hasData ? "—" : `${numberNG(ago.opening)}L`}
            bg="#F8FAFC"
            border="#E8EDF5"
            color="#94A3B8"
          />
          <DataBox
            label="Closing"
            value={loading || !hasData ? "—" : `${numberNG(ago.closing)}L`}
            bg="#F8FAFC"
            border="#E8EDF5"
            color="#94A3B8"
          />
          <DataBox
            label="Difference"
            value={loading || !hasData ? "—" : `${numberNG(ago.diff)}L`}
            bg="#FFFBEB"
            border="#FDE68A"
            color="#D97706"
          />
          <DataBox
            label="Margin"
            value={loading || !hasData ? "—" : `${Number(ago.margin).toFixed(2)}L`}
            bg="#FEF2F2"
            border="#FECACA"
            color="#DC2626"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1 rounded-[10px] border border-[#FDE68A] bg-amber-light px-3.5 py-[11px]">
          <span className="text-xs font-medium text-ink-2">
            {loading || !hasData ? `— L × ₦${price.toLocaleString("en-NG")}` : `${numberNG(ago.diff)}L × ₦${price.toLocaleString("en-NG")}`}
          </span>
          <span className="mono text-[15px] font-extrabold text-amber">
            {loading || !hasData ? "—" : naira(revenue)}
          </span>
        </div>
      </div>
    </div>
  )
}
