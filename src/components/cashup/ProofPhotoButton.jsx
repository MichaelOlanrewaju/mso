import React, { useRef } from "react"

/**
 * A single "attach proof photo" control — used for both the Moniepoint
 * settlement screenshot and the bank deposit slip/alert.
 *
 * This deliberately does NOT try to read or verify the photo's contents.
 * The point is narrower and cheaper than that: it means the number typed in
 * next to it isn't trusted blind — a supervisor or owner can open the photo
 * later and glance at it against the figure. That's a real trust improvement
 * for very little engineering cost, and it doesn't depend on any bank or
 * payment-provider API existing.
 */
export default function ProofPhotoButton({ label, hint, fileId, uploading, onCapture }) {
  const inputRef = useRef(null)

  const handleChange = e => {
    const file = e.target.files?.[0]
    if (file) onCapture(file)
    e.target.value = ""
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
      <div
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px]"
        style={{ background: fileId ? "var(--brand-accent-light)" : "var(--pagebg)" }}
      >
        {uploading
          ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-ink-4/30 border-t-ink-4" />
          : <i className={`bi ${fileId ? "bi-check-circle-fill" : "bi-camera"} text-[17px]`} style={{ color: fileId ? "var(--brand-accent)" : "var(--text-muted)" }} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        <div className="text-[11px] text-ink-4">{fileId ? "Photo attached — tap to replace" : hint}</div>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex-shrink-0 rounded-[9px] border border-border bg-white px-3 py-2 text-[12px] font-bold text-ink-2 disabled:opacity-60"
      >
        {fileId ? "Replace" : "Add photo"}
      </button>
    </div>
  )
}
