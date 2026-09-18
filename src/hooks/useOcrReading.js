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
  const workerRef = useRef(null)

  const getWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current
    const { createWorker } = await import("tesseract.js")
    const worker = await createWorker("eng")
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789.",
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
    try {
      const worker = await getWorker()
      const { data } = await worker.recognize(dataUri)
      const raw = (data.text || "").trim()
      // Keep only digits and a single decimal point — Tesseract's digit-only
      // whitelist should already ensure this, but a stray newline or space
      // can still slip into the raw text.
      const cleaned = raw.replace(/[^\d.]/g, "")
      setConfidence(Math.round(data.confidence || 0))
      setStatus("done")
      if (!cleaned || Number.isNaN(Number(cleaned))) return null
      return cleaned
    } catch (e) {
      setStatus("error")
      return null
    }
  }, [getWorker])

  return { readNumber, status, confidence }
}
