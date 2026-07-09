import React, { useRef, useState } from "react"
import { useDriveImage } from "../../hooks/useDriveImage"

export default function PhotoCapture({ photo, onCapture, label = "Add dip photo", sub = "Optional evidence photo", progress }) {
  const inputRef = useRef(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const handleChange = e => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onCapture(ev.target.result, file.type)
    reader.readAsDataURL(file)
  }

  const done = Boolean(photo && photo.saved)
  const uploading = typeof progress === "number" && progress < 100

  // A just-captured photo already has a local data URI — instant, no
  // fetch needed. A photo loaded from a previous visit only has a
  // fileId, so its actual bytes are fetched as soon as we know a saved
  // photo exists (not just when the lightbox opens) — otherwise the
  // small thumbnail slot shows a generic checkmark with no actual
  // preview, which reads as broken rather than as "tap to view."
  const localUrl = photo && photo.localUrl
  const fileId = photo && photo.fileId
  const { dataUri: fetchedUrl, status: fetchStatus } = useDriveImage(!localUrl ? fileId : null)

  const thumbUrl = localUrl || fetchedUrl
  const lightboxUrl = thumbUrl

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
      <div
        className={`relative mt-3.5 flex w-full items-center gap-3 overflow-hidden rounded-[14px] border-[1.5px] px-3.5 py-3 transition-all ${
          done ? "border-green-light bg-green-light" : "border-dashed border-border bg-surface"
        }`}
      >
        {uploading && (
          <div
            className="absolute inset-y-0 left-0 bg-cyan/15 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        )}

        {done ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-[10px] border border-green-light bg-green-light"
          >
            {thumbUrl ? (
              <img src={thumbUrl} alt="Captured" className="h-full w-full object-cover" />
            ) : fetchStatus === "error" ? (
              <span className="flex h-full w-full items-center justify-center">
                <i className="bi bi-image text-green" />
              </span>
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <span className="h-3.5 w-3.5 animate-spin-fast rounded-full border-2 border-green/30 border-t-green" />
              </span>
            )}
          </button>
        ) : (
          <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border border-cyan/20 bg-cyan-light">
            {uploading ? (
              <span className="h-3.5 w-3.5 animate-spin-fast rounded-full border-2 border-cyan/30 border-t-cyan" />
            ) : (
              <i className="bi bi-camera-fill text-cyan-dark" />
            )}
          </div>
        )}

        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current && inputRef.current.click()}
          className="relative flex-1 text-left"
        >
          <div className={`text-[12.5px] font-bold ${done ? "text-green" : "text-ink-2"}`}>
            {uploading ? `Uploading… ${progress}%` : done ? "Photo saved" : label}
          </div>
          <div className="text-[10.5px] font-medium text-ink-4">
            {uploading ? "Compressed and sending" : done ? "Tap thumbnail to view · tap here to retake" : sub}
          </div>
        </button>

        {!uploading && !done && (
          <button
            type="button"
            onClick={() => inputRef.current && inputRef.current.click()}
            className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cyan"
          >
            <i className="bi bi-plus text-[13px] text-white" />
          </button>
        )}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-[max(16px,var(--sat))] flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm"
          >
            <i className="bi bi-x-lg" />
          </button>
          {lightboxUrl ? (
            <img src={lightboxUrl} alt="Captured" className="max-h-full max-w-full rounded-[10px] object-contain" />
          ) : (
            <span className="h-8 w-8 animate-spin-fast rounded-full border-2 border-white/20 border-t-white" />
          )}
        </div>
      )}
    </>
  )
}
