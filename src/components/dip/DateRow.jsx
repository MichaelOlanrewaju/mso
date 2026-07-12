import React from "react"

export default function DateRow({ date, onChange, supName, roleLabel = "Supervisor" }) {
  const inputRef = React.useRef(null)

  // Open the native date picker on tapping anywhere in the field area —
  // showPicker() is supported on modern mobile browsers; falls back to
  // focus/click for older ones.
  const openPicker = () => {
    const el = inputRef.current
    if (!el) return
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return } catch { /* fall through */ }
    }
    el.focus()
    el.click()
  }

  return (
    <div className="mb-3 flex items-center gap-3 rounded-[14px] border border-cyan/15 bg-white px-3.5 py-3 shadow-card">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: "linear-gradient(135deg, #130656, #179DD0)" }}>
        <i className="bi bi-calendar3 text-white" />
      </div>

      {/* Tappable date field — styled as an obvious control with a chevron
          so it clearly reads as "tap to change", not static text. */}
      <button
        type="button"
        onClick={openPicker}
        className="relative flex flex-1 items-center justify-between rounded-[10px] bg-cyan/5 px-3 py-1.5 text-left transition-colors active:bg-cyan/10"
      >
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[1px] text-cyan-dark">Date * · tap to change</div>
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13.5px] font-bold text-ink">
              {date
                ? new Date(date + "T00:00:00").toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
                : "Select date"}
            </span>
          </div>
        </div>
        <i className="bi bi-chevron-down flex-shrink-0 text-[13px] text-cyan-dark" />
        {/* The real input, visually hidden but still functional/native */}
        <input
          ref={inputRef}
          type="date"
          value={date}
          onChange={e => onChange(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          tabIndex={-1}
          aria-hidden="true"
        />
      </button>

      <div className="text-right">
        <div className="text-[12px] font-bold text-ink">{supName}</div>
        <div className="text-[10px] text-ink-4">{roleLabel}</div>
      </div>
    </div>
  )
}
