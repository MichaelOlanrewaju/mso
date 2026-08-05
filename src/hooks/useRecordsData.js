import { useCallback, useEffect, useRef, useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"

export function useRecordsData(username, selectedDate) {
  const [status, setStatus] = useState("loading")
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const load = useCallback(
    date => {
      if (!SCRIPT_URL) {
        setStatus("idle")
        return
      }
      setStatus("loading")
      setError(null)

      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "getDailyReport")
      url.searchParams.set("station", activeStation())
      url.searchParams.set("date", date)
      url.searchParams.set("username", username || "")

      /* This used to have no timeout at all — a slow or hanging request
         left the page stuck on "loading" indefinitely, with nothing ever
         rejecting and nothing to show in the console. That's exactly the
         same class of bug fixed earlier this session on pump/dip/cashup
         submission, just on the READ side here instead of the write side.
         25 seconds is generous for a normal request but short enough that
         a genuinely stuck connection surfaces as a real, actionable
         "error" state instead of spinning forever. */
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 25000)

      fetch(url.toString(), { method: "GET", redirect: "follow", signal: controller.signal })
        .then(res => res.json())
        .then(d => {
          if (!isMounted.current) return
          if (!d.ok) {
            // getDailyReport returns ok:false with a 'No report found
            // for <date>' message when the DailySales sheet has no row
            // for that date — this is a real, expected empty state, not
            // a network/parse failure, so it's handled as its own status.
            setStatus("no-data")
            setReport(null)
            setError(d.error || null)
            return
          }
          setStatus("ready")
          setReport(d.report)
        })
        .catch(() => {
          if (!isMounted.current) return
          setStatus("error")
          setReport(null)
        })
        .finally(() => clearTimeout(timeoutId))
    },
    [username]
  )

  useEffect(() => {
    if (selectedDate) load(selectedDate)
  }, [selectedDate, load])

  return {
    status,
    report,
    error,
    refresh: () => load(selectedDate),
    configured: Boolean(SCRIPT_URL),
  }
}
