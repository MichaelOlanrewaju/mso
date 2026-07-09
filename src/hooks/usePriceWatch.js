import { useCallback, useEffect, useRef, useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"
const POLL_MS = 30000 // check every 30s while the app is open
const LAST_SEEN_KEY = `mso-price-watch-${STATION_KEY}`

function loadLastSeen() {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function saveLastSeen(v) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(v))
  } catch (e) {
    // storage unavailable — alerting still works for this session, just won't survive a refresh
  }
}

/**
 * Watches for PMS/AGO price changes on this station and surfaces a pending
 * cutover alert the moment one is detected (polling, since Apps Script has
 * no push channel). A pump only needs a cutover if it was actually open
 * (has an unclosed session) at the moment the price changed — that check
 * happens where this hook is consumed, since it needs today's pump data.
 */
export function usePriceWatch({ enabled }) {
  const [pendingChange, setPendingChange] = useState(null) // { product, oldPrice, newPrice, since }
  const lastSeenRef = useRef(loadLastSeen())
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const check = useCallback(() => {
    if (!SCRIPT_URL || !enabled) return
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getCurrentPrices")
    url.searchParams.set("station", STATION_KEY)
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (!isMounted.current || !d.ok) return
        const seen = lastSeenRef.current
        const fresh = { pms: Number(d.pmsPrice), ago: Number(d.agoPrice) }

        // First check ever on this device — just record current prices, nothing to alert about.
        if (!seen) {
          lastSeenRef.current = fresh
          saveLastSeen(fresh)
          return
        }

        if (seen.pms !== fresh.pms) {
          setPendingChange({ product: "PMS", oldPrice: seen.pms, newPrice: fresh.pms, since: d.pmsSince })
        } else if (seen.ago !== fresh.ago) {
          setPendingChange({ product: "AGO", oldPrice: seen.ago, newPrice: fresh.ago, since: d.agoSince })
        }

        lastSeenRef.current = fresh
        saveLastSeen(fresh)
      })
      .catch(() => {
        // silent — a missed poll just means we check again at the next interval
      })
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    check()
    const id = setInterval(check, POLL_MS)
    return () => clearInterval(id)
  }, [enabled, check])

  const acknowledge = useCallback(() => {
    setPendingChange(null)
  }, [])

  return { pendingChange, acknowledge, refreshNow: check }
}
