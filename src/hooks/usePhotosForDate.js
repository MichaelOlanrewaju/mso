import { useCallback, useEffect, useRef, useState } from "react"
import { getToken } from "../utils/session"
import { activeStation } from "../utils/station"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

export function usePhotosForDate(date) {
  const [status, setStatus] = useState("loading")
  const [photos, setPhotos] = useState([])
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL || !date) { setStatus("idle"); return }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getPhotos")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setPhotos(d.ok ? (d.photos || []) : [])
        setStatus("ready")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [date])

  useEffect(() => { load() }, [load])

  return { status, photos, refresh: load }
}
