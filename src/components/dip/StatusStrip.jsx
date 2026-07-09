import React from "react"

export default function StatusStrip({ hasOpening, hasClosing, hasCash }) {
  const steps = [
    { label: "Opening", done: hasOpening },
    { label: "Closing", done: hasClosing },
    { label: "Cashier done", done: hasCash },
  ]

  return (
    <div className="mb-3 flex items-center gap-2 rounded-[12px] border border-cyan/15 bg-white px-3.5 py-2.5 shadow-card">
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: s.done ? "#16A34A" : "#94A3B8" }}>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: s.done ? "#16A34A" : "#CBD5E1", boxShadow: s.done ? "0 0 6px rgba(22,163,74,.5)" : "none" }}
            />
            {s.done && <i className="bi bi-check-lg text-[10px]" />}
            {s.label}
          </div>
          {i < steps.length - 1 && <span className="text-cyan/30">›</span>}
        </React.Fragment>
      ))}
    </div>
  )
}
