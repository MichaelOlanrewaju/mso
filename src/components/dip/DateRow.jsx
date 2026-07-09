import React from "react"

export default function DateRow({ date, onChange, supName, roleLabel = "Supervisor" }) {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-[14px] border border-cyan/15 bg-white px-3.5 py-3 shadow-card">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: "linear-gradient(135deg, #130656, #179DD0)" }}>
        <i className="bi bi-calendar3 text-white" />
      </div>
      <div className="flex-1">
        <div className="text-[9px] font-bold uppercase tracking-[1px] text-cyan-dark">Date *</div>
        <input
          type="date"
          value={date}
          onChange={e => onChange(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="w-full border-none bg-transparent p-0 text-[13.5px] font-bold text-ink outline-none"
        />
      </div>
      <div className="text-right">
        <div className="text-[12px] font-bold text-ink">{supName}</div>
        <div className="text-[10px] text-ink-4">{roleLabel}</div>
      </div>
    </div>
  )
}
