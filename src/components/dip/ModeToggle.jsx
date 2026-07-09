import React from "react"

export default function ModeToggle({ mode, onChange, hasOpening, hasClosing }) {
  return (
    <div className="mb-3.5 flex rounded-[12px] border border-cyan/15 bg-white p-1 shadow-card">
      <button
        type="button"
        onClick={() => onChange("open")}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2.5 text-[12.5px] font-bold transition-all"
        style={
          mode === "open"
            ? { background: "linear-gradient(135deg, #130656, #1a0875)", color: "#fff" }
            : { color: "#94A3B8" }
        }
      >
        <i className="bi bi-sunrise" />
        Opening
        {hasOpening && <i className="bi bi-check-circle-fill text-[11px]" style={{ color: mode === "open" ? "#4ADE80" : "#16A34A" }} />}
      </button>
      <button
        type="button"
        onClick={() => onChange("close")}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2.5 text-[12.5px] font-bold transition-all"
        style={
          mode === "close"
            ? { background: "linear-gradient(135deg, #130656, #179DD0)", color: "#fff" }
            : { color: "#94A3B8" }
        }
      >
        <i className="bi bi-moon-stars" />
        Closing
        {hasClosing && <i className="bi bi-check-circle-fill text-[11px]" style={{ color: mode === "close" ? "#4ADE80" : "#16A34A" }} />}
      </button>
    </div>
  )
}
