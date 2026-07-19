import { useCallback, useEffect, useRef, useState } from "react"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"

export function usePrices() {
  /* 0 means "no price recorded" — the UI renders that as "—". Seeding real-
     looking numbers made stale prices indistinguishable from current ones. */
  const [prices, setPrices] = useState({ pms: 0, ago: 0, lpg: 0 })
  const [since, setSince] = useState({ pms: "default", ago: "default", lpg: "default" })
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
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
      setLoading(false)
      return
    }
    setLoading(true)
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getCurrentPrices")
    url.searchParams.set("station", activeStation())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (!isMounted.current || !d.ok) return
        setPrices({ pms: Number(d.pmsPrice) || 0, ago: Number(d.agoPrice) || 0, lpg: Number(d.lpgPrice) || 0 })
        setSince({ pms: d.pmsSince || "default", ago: d.agoSince || "default", lpg: d.lpgSince || "default" })
        setHistory(Array.isArray(d.history) ? d.history : [])
        setLoading(false)
      })
      .catch(() => {
        if (isMounted.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const savePrice = useCallback(
    async ({ product, price, note, username }) => {
      if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
      setSaving(true)
      try {
        const res = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ action: "savePrice", station: activeStation(), token: getToken(), product, price, note, username }),
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

  return { prices, since, history, loading, saving, savePrice, refresh: load }
}
