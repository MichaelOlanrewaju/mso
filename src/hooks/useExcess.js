import { useCallback, useEffect, useRef, useState } from "react"
import { getToken } from "../utils/session"
import { activeStation } from "../utils/station"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

export function useExcess(username) {
  const [status, setStatus] = useState("loading")
  const [excess, setExcess] = useState([])
  const [saving, setSaving] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL || !username) { setStatus("idle"); return }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getExcess")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("username", username)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setExcess(d.ok ? (d.excess || []) : [])
        setStatus("ready")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [username])

  useEffect(() => { load() }, [load])

  const reportExcess = useCallback(({ date, amount, description }) => {
    setSaving(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "saveExcess", station: activeStation(), token: getToken(),
        username, date, amount, description,
      }),
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
  }, [username, load])

  return { status, excess, saving, reportExcess, refresh: load }
}
