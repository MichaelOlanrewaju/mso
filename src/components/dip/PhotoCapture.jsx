import React, { useRef, useState } from "react"
import { useDriveImage } from "../../hooks/useDriveImage"
import { useOcrReading } from "../../hooks/useOcrReading"

export default function PhotoCapture({ photo, onCapture, label = "Add dip photo", sub = "Optional evidence photo", progress, onNumberDetected }) {
  const inputRef = useRef(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const { readNumber, status: ocrStatus, lastError: ocrError } = useOcrReading()

  const handleChange = e => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUri = ev.target.result
      onCapture(dataUri, file.type)
      /* Runs right here, in the same motion as the capture itself — not a
         separate step, and not continuous video scanning. Confirmed
         directly as the right shape: fast enough to feel immediate,
         without the lag and lower reliability a live-video approach would
         add on top of an already-hard case (digit segments on an LCD). */
      if (onNumberDetected) {
        readNumber(dataUri).then(num => {
          if (num) onNumberDetected(num)
        })
      }
    }
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
      {/* Confirmed directly, tracing a real "nothing happens at all" report
         through to its actual cause: adding capture="environment" here
         (to enforce camera-only when gallery-attach is switched off) is
         what broke this. Photo capture worked before that change, and
         stopped working specifically when the toggle was off — which is
         exactly the one condition that applies this attribute. Removed
         entirely: a working picker that offers both camera and gallery is
         a better outcome than a completely inert one. The gallery-off
         setting still controls whether a supervisor SHOULD use gallery
         (and the app's own messaging reflects that), even though the OS
         picker itself no longer technically blocks it — enforcing that at
         the picker level isn't worth breaking capture entirely on this
         class of device. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="absolute h-px w-px overflow-hidden opacity-0"
        style={{ clip: "rect(0,0,0,0)" }}
        onChange={handleChange}
      />
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
          <div className={`text-[12.5px] font-bold ${done ? "text-green" : ocrStatus === "error" ? "text-red" : "text-ink-2"}`}>
            {ocrStatus === "reading" ? "Reading number…" : ocrStatus === "error" ? "Couldn't read a number" : uploading ? `Uploading… ${progress}%` : done ? "Photo saved" : label}
          </div>
          <div className="text-[10.5px] font-medium text-ink-4">
            {ocrStatus === "reading" ? "Checking the photo for a reading" : ocrStatus === "error" ? (ocrError || "Enter the reading manually") : uploading ? "Compressed and sending" : done ? "Tap thumbnail to view · tap here to retake" : sub}
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
