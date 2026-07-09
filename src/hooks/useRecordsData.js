import { useCallback, useEffect, useRef, useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

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
      url.searchParams.set("station", STATION_KEY)
      url.searchParams.set("date", date)
      url.searchParams.set("username", username || "")

      fetch(url.toString(), { method: "GET", redirect: "follow" })
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
