import { useCallback, useEffect, useRef, useState } from "react"
import { getCached, setCached } from "../utils/fetchCache"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

export function useDashboardData(username) {
  const [status, setStatus] = useState("idle")
  const [data, setData] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const cacheKey = `dashboard:${STATION_KEY}:${username || "owner"}`

  const load = useCallback(
    (opts = {}) => {
      const { skipCache = false } = opts
      if (!SCRIPT_URL) {
        setStatus("idle")
        return
      }

      // Serve a cached response instantly if we have one and it's fresh —
      // this is what makes Dashboard -> Dip -> back to Dashboard feel
      // instant instead of re-waiting on a slow Apps Script round-trip.
      // We still kick off a real fetch right after, so the screen quietly
      // updates if anything actually changed — this is a head start, not
      // a substitute for fresh data.
      if (!skipCache) {
        const cached = getCached(cacheKey)
        if (cached) {
          applyPayload(cached, { silent: true })
        }
      }

      setStatus(prev => (prev === "ready" && !skipCache ? prev : "loading"))

      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "getDashboard")
      url.searchParams.set("station", STATION_KEY)
      url.searchParams.set("username", username || "owner")

      fetch(url.toString(), { method: "GET", redirect: "follow" })
        .then(res => res.json())
        .then(payload => {
          if (!isMounted.current) return
          if (payload.ok) setCached(cacheKey, payload)
          applyPayload(payload)
        })
        .catch(() => {
          if (!isMounted.current) return
          setStatus("error")
          setData(null)
        })

      function applyPayload(payload, { silent } = {}) {
        if (!payload.ok) {
          if (!silent) {
            setStatus("error")
            setData(null)
          }
          return
        }
        if (payload.noData) {
          setStatus("no-data")
          // Keep the payload (not null) — it still carries todayStatus,
          // which TodayStatusPills needs even when there's genuinely no
          // sales/dip data recorded yet today.
          setData(payload)
          setUpdatedAt(new Date())
          return
        }
        if (payload.openingOnly) {
          setStatus("opening")
          setData(payload)
          setUpdatedAt(new Date())
          return
        }
        setStatus("ready")
        setData(payload)
        setUpdatedAt(new Date())
      }
    },
    [username, cacheKey]
  )

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  return {
    status,
    data,
    updatedAt,
    loading: status === "loading",
    refresh: () => load({ skipCache: true }),
    configured: Boolean(SCRIPT_URL),
  }
}
