import { useCallback, useEffect, useRef, useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

export const SHORTAGE_CATEGORIES = ["Cash Shortage", "Spillage", "Dispensing Error", "Theft", "Equipment Fault", "Other"]

export function useShortages({ all = false } = {}) {
  const [status, setStatus] = useState("loading")
  const [shortages, setShortages] = useState([])
  const [saving, setSaving] = useState(false)
  const isMounted = useRef(true)

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
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getShortages")
    url.searchParams.set("station", STATION_KEY)
    if (all) url.searchParams.set("all", "1")
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (!isMounted.current) return
        if (d.ok) {
          setShortages(d.shortages || [])
          setStatus("ready")
        } else {
          setStatus("error")
        }
      })
      .catch(() => {
        if (isMounted.current) setStatus("error")
      })
  }, [all])

  useEffect(() => {
    load()
  }, [load])

  const reportShortage = useCallback(
    async ({ date, category, litres, amount, description, username }) => {
      if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
      setSaving(true)
      try {
        const res = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ action: "saveShortage", station: STATION_KEY, date, category, litres, amount, description, username }),
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
      url.searchParams.set("station", STATION_KEY)
      url.searchParams.set("rowIndex", rowIndex)
      url.searchParams.set("decision", decision)
      url.searchParams.set("username", username || "")
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
