import { useState, useRef, useCallback } from "react"

/**
 * Records a short voice note using MediaRecorder.
 *
 * The tricky part is that browsers disagree on audio formats: Chrome/Android
 * record webm/opus, iOS Safari records mp4/aac. We don't force a format — we let
 * the browser pick what it supports and report the resulting mimeType, so the
 * backend stores it with the right extension and playback uses the right type.
 */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState("")

  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const resolveRef = useRef(null)

  const start = useCallback(async () => {
    setError("")
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === "undefined") {
      setError("Recording isn't supported on this device or browser.")
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      /* Pick the first mime type the browser actually supports. */
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
      const mimeType = candidates.find(t => window.MediaRecorder?.isTypeSupported?.(t)) || ""

      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const type = mr.mimeType || "audio/webm"
        const blob = new Blob(chunksRef.current, { type })
        streamRef.current?.getTracks().forEach(t => t.stop())
        if (resolveRef.current) { resolveRef.current({ blob, mimeType: type }); resolveRef.current = null }
      }

      mr.start()
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => {
        /* Hard stop at 2 minutes so a note can't run away. */
        if (s >= 120) { stopInternal() ; return s }
        return s + 1
      }), 1000)
      return true
    } catch (e) {
      /* Clean up any partial stream so the mic light doesn't stay on. */
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setRecording(false)
      const name = e && e.name
      setError(name === "NotAllowedError" ? "Microphone permission denied."
             : name === "NotFoundError" ? "No microphone found on this device."
             : "Couldn't start recording.")
      return false
    }
  }, [])

  const stopInternal = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecording(false)
    try { mediaRef.current?.state !== "inactive" && mediaRef.current?.stop() } catch { /* already stopped */ }
  }

  /* Stop and resolve with the recorded blob. */
  const stop = useCallback(() => {
    return new Promise(resolve => {
      resolveRef.current = resolve
      stopInternal()
    })
  }, [])

  /* Cancel without producing a blob (e.g. user slid to cancel). */
  const cancel = useCallback(() => {
    resolveRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecording(false)
    try { mediaRef.current?.state !== "inactive" && mediaRef.current?.stop() } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach(t => t.stop())
    chunksRef.current = []
  }, [])

  return { recording, seconds, error, start, stop, cancel }
}
