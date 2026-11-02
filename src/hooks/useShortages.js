import { useCallback, useEffect, useRef, useState } from "react"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"

export const SHORTAGE_CATEGORIES = ["Cash Shortage", "Spillage", "Dispensing Error", "Theft", "Equipment Fault", "Other"]

export function useShortages({ all = false } = {}) {
  const [status, setStatus] = useState("loading")
  const [shortages, setShortages] = useState([])
  const [saving, setSaving] = useState(false)
  const isMounted = useRef(true)
  /* Every load gets a number; only the NEWEST one may write state. Without this,
     the page's first request (made before the role is known, so "pending only")
     could finish after the second ("all") and overwrite the full list with an
     empty one — the list flashed, then vanished. */
  const requestRef = useRef(0)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL) {
      setStatus("idle")
      return
    }
    const myRequest = ++requestRef.current
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getShortages")
    url.searchParams.set("station", activeStation())
    if (all) url.searchParams.set("all", "1")
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (!isMounted.current || myRequest !== requestRef.current) return
        if (d.ok) {
          setShortages(d.shortages || [])
          setStatus("ready")
        } else {
          setStatus("error")
        }
      })
      .catch(() => {
        if (isMounted.current && myRequest === requestRef.current) setStatus("error")
      })
  }, [all])

  useEffect(() => {
    load()
  }, [load])

  const reportShortage = useCallback(
    async ({ date, category, litres, amount, description, username, attendantId }) => {
      if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
      setSaving(true)
      try {
        const res = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ action: "saveShortage", station: activeStation(), date, category, litres, amount, description, username, attendantId }),
        })
        const d = await res.json()
        if (d.ok) load()
        return d
      } catch (e) {
        return { ok: false, error: "Network error — please try again." }
      } finally {
        if (isMounted.current) setSaving(false)
      }
    },
    [load]
  )

  const reviewShortage = useCallback(
    async ({ rowIndex, decision, username }) => {
      if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "reviewShortage")
      url.searchParams.set("station", activeStation())
      url.searchParams.set("rowIndex", rowIndex)
      url.searchParams.set("decision", decision)
      url.searchParams.set("username", username || "")
      url.searchParams.set("token", getToken())
      try {
        const res = await fetch(url.toString(), { method: "GET", redirect: "follow" })
        const d = await res.json()
        if (d.ok) load()
        return d
      } catch (e) {
        return { ok: false, error: "Network error — please try again." }
      }
    },
    [load]
  )

  return { status, shortages, saving, reportShortage, reviewShortage, refresh: load }
}
