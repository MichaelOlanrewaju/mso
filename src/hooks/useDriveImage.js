import { useEffect, useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

// Drive's public uc?export=view link is unreliable for embedding as an
// <img src> — Google increasingly serves an HTML interstitial instead of
// the raw image. This fetches the actual bytes through Apps Script
// (which has direct file access) and builds a data URI instead, which
// always works regardless of Drive's link-sharing quirks.
export function useDriveImage(fileId) {
  const [dataUri, setDataUri] = useState(null)
  const [status, setStatus] = useState("idle") // idle | loading | ready | error

  useEffect(() => {
    if (!fileId || !SCRIPT_URL) {
      setDataUri(null)
      setStatus("idle")
      return
    }
    let cancelled = false
    setStatus("loading")
    setDataUri(null)

    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getImage")
    url.searchParams.set("fileId", fileId)

    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (cancelled) return
        if (d.ok && d.base64) {
          setDataUri(`data:${d.mimeType || "image/jpeg"};base64,${d.base64}`)
          setStatus("ready")
        } else {
          setStatus("error")
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [fileId])

  return { dataUri, status }
}
