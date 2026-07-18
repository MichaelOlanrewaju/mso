import React from "react"

/**
 * The date field.
 *
 * The previous version rendered a real <input type="date"> that was
 * `h-0 w-0 opacity-0 pointer-events-none`, nested inside a <button>, and tried
 * to open it with showPicker(). That fails on mobile for three separate
 * reasons, any one of which is fatal:
 *
 *   1. showPicker() throws on an element that isn't visible — and the throw was
 *      being swallowed by a bare catch, so it failed silently.
 *   2. pointer-events:none means the focus()/click() fallback can't reach it
 *      either.
 *   3. An <input> inside a <button> is invalid HTML; browsers handle it
 *      unpredictably.
 *
 * So the field never opened, and the "tap to change" label was a lie.
 *
 * The fix is to stop hiding the input. It's a real, full-size, transparent
 * input laid over the styled face — the browser's own native picker opens
 * because the user is genuinely tapping a date input. No showPicker(), no
 * fallback chain, nothing to fail.
 */
export default function DateRow({ date, onChange, supName, roleLabel = "Supervisor" }) {
  const label = date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-NG", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      })
    : "Select date"

  return (
    <div className="mb-3 flex items-center gap-3 rounded-[14px] border border-cyan/15 bg-white px-3.5 py-3 shadow-card">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: "var(--brand-gradient-btn)" }}
      >
        <i className="bi bi-calendar3 text-white" />
      </div>

      <div className="relative min-w-0 flex-1">
        {/* The visible face. Purely decorative — it never receives the tap. */}
        <div className="pointer-events-none rounded-[10px] bg-cyan/5 px-3 py-1.5">
          <div className="text-[9px] font-bold uppercase tracking-[1px] text-cyan-dark">
            Date * · tap to change
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13.5px] font-bold text-ink">{label}</span>
            <i className="bi bi-chevron-down flex-shrink-0 text-[13px] text-cyan-dark" />
          </div>
        </div>

        {/* The real input, stretched over the whole face and transparent. The
            user is tapping an actual date input, so the native picker opens on
            its own — no scripting, nothing to go wrong. Opacity 0 rather than
            display:none, because a hidden input cannot be tapped. */}
        <input
          type="date"
          value={date}
          onChange={e => onChange(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          aria-label="Date"
          className="absolute inset-0 h-full w-full cursor-pointer rounded-[10px] opacity-0"
          style={{ WebkitAppearance: "none", colorScheme: "light" }}
        />
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="text-[12px] font-bold text-ink">{supName}</div>
        <div className="text-[10px] text-ink-4">{roleLabel}</div>
      </div>
    </div>
  )
}
