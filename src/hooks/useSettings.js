import { useCallback, useEffect, useRef, useState } from "react"
import { getToken } from "../utils/session"
import { activeStation } from "../utils/station"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

export function useSettings() {
  const [status, setStatus] = useState("loading")
  const [settings, setSettings] = useState({ photoUploadEnabled: "true" })
  const [saving, setSaving] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL) { setStatus("idle"); return }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getSettings")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        if (d.ok) setSettings(d.settings || {})
        setStatus("ready")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [])

  useEffect(() => { load() }, [load])

  const saveSetting = useCallback((key, value, username) => {
    setSaving(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "saveSetting", station: activeStation(), token: getToken(), username, key, value }),
    })
      .then(r => r.json())
      .then(d => {
        setSaving(false)
        if (d.ok) load()
        return d
      })
      .catch(() => {
        setSaving(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [load])

  return { status, settings, saving, saveSetting, refresh: load }
}
