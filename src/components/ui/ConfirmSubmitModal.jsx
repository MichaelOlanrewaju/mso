import React, { useEffect } from "react"

// Shared review-before-save popup. Shows exactly what's about to be
// submitted plus any sanity-check warnings, and requires an explicit
// tap to actually save — a deliberate speed bump against fat-finger
// entry (a misplaced decimal, a forgotten field, a value that's way
// out of the normal range), which has caused real problems this
// project before.
export default function ConfirmSubmitModal({ open, title, subtitle, rows, warnings, onConfirm, onCancel, confirming }) {
  // Escape closes the modal — but never mid-save, so a stray keypress
  // can't dismiss the sheet while the request is in flight.
  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key === "Escape" && !confirming) onCancel?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, confirming, onCancel])

  if (!open) return null
  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-[999] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={confirming ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-up max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-t-[22px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:animate-modal-pop sm:rounded-[20px]"
        onClick={e => e.stopPropagation()}
      >
        {/* Grab handle — signals "sheet" on mobile, hidden on desktop */}
        <div className="mx-auto -mt-1 mb-3 h-1 w-9 rounded-full bg-border sm:hidden" aria-hidden="true" />

        <div className="mb-0.5 flex items-center gap-2">
          <i className="bi bi-clipboard2-check text-[17px] text-cyan-dark" />
          <div className="text-[15px] font-extrabold text-ink">{title}</div>
        </div>
        {subtitle && <div className="mb-3.5 mt-1 text-[12px] text-ink-4">{subtitle}</div>}

        <div className="mb-3.5 divide-y divide-surface overflow-hidden rounded-[12px] border border-border">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-3 bg-white px-3.5 py-2.5">
              <span className="text-[12.5px] text-ink-3">{r.label}</span>
              <span className={`mono text-right text-[13px] font-bold ${r.warn ? "text-red" : "text-ink"}`}>{r.value}</span>
            </div>
          ))}
        </div>

        {warnings && warnings.length > 0 && (
          <div className="mb-3.5 space-y-1.5">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 rounded-[10px] border border-red/25 bg-red-light px-3 py-2 text-[12px] font-medium text-red">
                <i className="bi bi-exclamation-triangle-fill mt-0.5 flex-shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="min-h-[46px] flex-1 rounded-[12px] border border-border bg-surface py-3 text-[13.5px] font-bold text-ink-2 transition-colors hover:bg-border/60 disabled:opacity-60"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-[12px] bg-navy py-3 text-[13.5px] font-bold text-white shadow-lift transition-all hover:bg-navy-2 disabled:opacity-60"
          >
            {confirming ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> : <i className="bi bi-check2" />}
            {confirming ? "Saving…" : "Confirm & Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
