import { useCallback, useEffect, useRef, useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

export function usePrices() {
  const [prices, setPrices] = useState({ pms: 1272, ago: 1819, lpg: 1250 })
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
    url.searchParams.set("station", STATION_KEY)
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (!isMounted.current || !d.ok) return
        setPrices({ pms: d.pmsPrice ? Number(d.pmsPrice) : 1272, ago: d.agoPrice ? Number(d.agoPrice) : 1819, lpg: d.lpgPrice ? Number(d.lpgPrice) : 1250 })
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
          body: JSON.stringify({ action: "savePrice", station: STATION_KEY, product, price, note, username }),
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
