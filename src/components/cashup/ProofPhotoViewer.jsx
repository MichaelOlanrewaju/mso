import React, { useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

/**
 * Shows a proof photo (Moniepoint settlement / bank deposit) for review.
 * Loads lazily — only fetches the image once the person taps to view it,
 * so a records list with many days doesn't pull every photo up front.
 */
export default function ProofPhotoViewer({ label, fileId }) {
  const [src, setSrc] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)

  if (!fileId) return null

  const load = async () => {
    setOpen(true)
    if (src) return
    setLoading(true)
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getImage&fileId=${encodeURIComponent(fileId)}`)
      const d = await res.json()
      if (d.ok) setSrc(`data:${d.mimeType};base64,${d.base64}`)
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={load}
        className="flex items-center gap-2 rounded-[9px] border border-border bg-white px-3 py-2 text-[12px] font-bold text-ink-2"
      >
        <i className="bi bi-camera-fill text-[13px]" style={{ color: "var(--brand-accent)" }} />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="max-h-[85vh] max-w-full overflow-hidden rounded-[16px] bg-white" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-surface px-4 py-3">
              <span className="text-[13.5px] font-bold text-ink">{label}</span>
              <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-4 active:bg-surface">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="flex max-h-[75vh] items-center justify-center overflow-auto bg-surface p-2">
              {loading && <span className="h-6 w-6 animate-spin-fast rounded-full border-2 border-ink-4/30 border-t-ink-4" />}
              {error && <span className="p-8 text-[13px] text-ink-4">Couldn't load this photo.</span>}
              {src && <img src={src} alt={label} className="max-h-full max-w-full rounded-[8px] object-contain" />}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
