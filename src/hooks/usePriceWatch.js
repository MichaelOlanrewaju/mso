import { useCallback, useEffect, useRef, useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"
const POLL_MS = 30000 // check every 30s while the app is open

/* Same bug found and fixed on the Sales/Pump and Dip pages: this key used
   to be built once, at module load time, permanently tied to whichever
   station happened to be active the first time this file was ever
   loaded. Confirmed the same failure shape here — switching stations
   never actually switched which station's "last seen price" this hook
   was reading and writing, since a plain module-level const only ever
   runs that one time. Built as a function instead, called fresh on every
   read and write, so it always reflects whichever station is currently
   active. */
function lastSeenKey() {
  return `mso-price-watch-${activeStation()}`
}

function loadLastSeen() {
  try {
    const raw = localStorage.getItem(lastSeenKey())
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function saveLastSeen(v) {
  try {
    localStorage.setItem(lastSeenKey(), JSON.stringify(v))
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
  /* No longer initialized once via useRef's lazy initializer — that only
     ever runs at first mount, which wouldn't correctly pick up a station
     switch if this component gets reused rather than remounted for the
     new route. loadLastSeen() is a cheap localStorage read, so it's
     called fresh inside check() itself instead, always reflecting
     whichever station is active at that exact moment. */
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
    url.searchParams.set("station", activeStation())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (!isMounted.current || !d.ok) return
        const seen = loadLastSeen()
        const fresh = { pms: Number(d.pmsPrice), ago: Number(d.agoPrice) }

        // First check ever on this device — just record current prices, nothing to alert about.
        if (!seen) {
          saveLastSeen(fresh)
          return
        }

        if (seen.pms !== fresh.pms) {
          setPendingChange({ product: "PMS", oldPrice: seen.pms, newPrice: fresh.pms, since: d.pmsSince })
        } else if (seen.ago !== fresh.ago) {
          setPendingChange({ product: "AGO", oldPrice: seen.ago, newPrice: fresh.ago, since: d.agoSince })
        }

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
