import React, { useState, useRef, useEffect } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

/**
 * Plays a voice note attached to a chat message.
 *
 * The audio bytes live in Drive; we fetch them once (base64) on first play and
 * turn them into a blob URL the <audio> element can use. Fetching lazily — only
 * when the user taps play — keeps the chat light when there are many notes.
 */
export default function VoiceNote({ fileId, isMine }) {
  const [state, setState] = useState("idle")   // idle | loading | ready | error
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)
  const urlRef = useRef(null)

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  const load = async () => {
    setState("loading")
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getChatAudio&fileId=${encodeURIComponent(fileId)}`)
      const d = await res.json()
      if (!d.ok) { setState("error"); return null }
      const bytes = Uint8Array.from(atob(d.base64), c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: d.mimeType || "audio/webm" })
      const url = URL.createObjectURL(blob)
      urlRef.current = url
      setState("ready")
      return url
    } catch {
      setState("error")
      return null
    }
  }

  const toggle = async () => {
    let el = audioRef.current
    if (!urlRef.current) {
      const url = await load()
      if (!url) return
      el = audioRef.current
      el.src = url
    }
    if (playing) { el.pause(); return }
    el.play()
  }

  const tint = isMine ? "rgba(255,255,255,0.85)" : "var(--brand-accent)"
  const track = isMine ? "rgba(255,255,255,0.25)" : "rgba(23,157,208,0.18)"

  const fmt = s => {
    if (!s || !isFinite(s)) return "0:00"
    const m = Math.floor(s / 60), r = Math.floor(s % 60)
    return `${m}:${String(r).padStart(2, "0")}`
  }

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ minWidth: 180 }}>
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: isMine ? "rgba(255,255,255,0.2)" : "var(--brand-accent-light)" }}
      >
        {state === "loading"
          ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-current/30 border-t-current" style={{ color: tint }} />
          : <i className={`bi ${playing ? "bi-pause-fill" : "bi-play-fill"} text-[16px]`} style={{ color: tint }} />
        }
      </button>

      <div className="flex-1">
        <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: track }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: tint }} />
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <i className="bi bi-mic-fill text-[10px]" style={{ color: tint }} />
          <span className="text-[10.5px] font-semibold" style={{ color: isMine ? "rgba(255,255,255,0.75)" : "var(--text-muted)" }}>
            {state === "error" ? "Couldn't load" : fmt(duration)}
          </span>
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0) }}
        onLoadedMetadata={e => setDuration(e.target.duration)}
        onTimeUpdate={e => {
          const el = e.target
          if (el.duration) setProgress((el.currentTime / el.duration) * 100)
        }}
      />
    </div>
  )
}
