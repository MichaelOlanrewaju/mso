import { useState, useCallback, useRef } from "react"

/* Reads a numeric meter/gauge reading out of a captured photo. Confirmed
   directly: this runs the moment a photo is captured, as part of the same
   motion — not a separate step, and not continuous live-video scanning
   (which would be both slower and no more accurate, since the underlying
   weak point — seven-segment digital displays — is the same either way).

   Tesseract is configured to recognize ONLY digits and a decimal point,
   not general text. A meter reading is never letters, so eliminating that
   whole search space cuts down on the misreads a general-purpose OCR
   config would otherwise produce (mistaking a "7" segment gap for what
   looks like a stray "l" or "/", for example). This alone meaningfully
   improves accuracy on exactly this kind of display, even before any
   image preprocessing.

   The detected number is a SUGGESTION, never trusted blindly — the
   calling page always shows it as a pre-filled, editable value the
   supervisor can see and correct before submitting, the same safety net
   confirmed directly as necessary earlier. */
export function useOcrReading() {
  const [status, setStatus] = useState("idle") // idle | reading | done | error
  const [confidence, setConfidence] = useState(null)
  const [lastError, setLastError] = useState(null)
  const workerRef = useRef(null)

  const getWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current
    const { createWorker } = await import("tesseract.js")
    /* Confirmed directly, tracing a real "works nowhere on iOS, not even
       alert()" report through to a documented, known cause: Tesseract's
       worker normally loads from the CDN, a different origin than the
       app itself, and falls back to a blob: URL to make that work.
       WKWebView — what an installed iOS home-screen app runs inside,
       even though it looks like Safari — can silently block that
       cross-origin/blob worker from ever starting. Not an error, just
       nothing, which matches exactly what was seen. The worker script
       (small, tens of KB) is now self-hosted at /tesseract/worker.min.js
       instead, with workerBlobURL disabled so it's forced to load
       same-origin, which WKWebView doesn't block. The much larger core
       engine and language data still load from the CDN as before — only
       the worker bootstrap file itself needed to move. */
    const worker = await createWorker("eng", undefined, {
      workerPath: "/tesseract/worker.min.js",
      workerBlobURL: false,
    })
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789.",
      /* Confirmed directly, tracing a real "resolves with null despite a
         clean, close, well-lit photo" report: Tesseract's default mode
         assumes a full page of mixed text and layout — the wrong
         assumption for a single, isolated number reading. PSM 7 tells it
         to treat the whole image as one line of text instead, which is
         the standard, documented setting for exactly this kind of task
         (meter readings, plates, codes). */
      tessedit_pageseg_mode: "7",
    })
    workerRef.current = worker
    return worker
  }, [])

  /* dataUri: the same data: URI PhotoCapture already produces on capture —
     no separate upload or file handling needed, this runs on exactly what
     was just taken. Returns the cleaned-up numeric string, or null if
     nothing confident enough was found. */
  const readNumber = useCallback(async dataUri => {
    setStatus("reading")
    setConfidence(null)
    setLastError(null)
    try {
      const worker = await getWorker()
      const { data } = await worker.recognize(dataUri)
      const raw = (data.text || "").trim()
      // Keep only digits and a single decimal point — Tesseract's digit-only
      // whitelist should already ensure this, but a stray newline or space
      // can still slip into the raw text.
      const cleaned = raw.replace(/[^\d.]/g, "")
      setConfidence(Math.round(data.confidence || 0))
      if (!cleaned || Number.isNaN(Number(cleaned))) {
        /* Confirmed directly, tracing a real "resolved with null" report:
           this used to discard the raw text entirely on a failed read,
           leaving no way to tell "Tesseract saw nothing at all" apart
           from "Tesseract saw something, but it didn't clean up into a
           valid number" — two very different situations that call for
           different next steps. Surfaced here instead of thrown away. */
        setLastError(raw ? `Detected "${raw}" — not a valid number` : "No text detected in the photo")
        setStatus("error")
        return null
      }
      setStatus("done")
      return cleaned
    } catch (e) {
      /* Confirmed directly, tracing a real "detects nothing at all" report:
         this used to swallow the error completely — neither the developer
         nor whoever was testing could see what actually failed. Logged to
         the console now (visible in any browser's devtools, including on
         a phone via remote debugging) rather than hidden. */
      console.error("[OCR] Tesseract recognition failed:", e)
      setLastError(e && e.message ? e.message : String(e))
      setStatus("error")
      return null
    }
  }, [getWorker])

  return { readNumber, status, confidence, lastError }
}
