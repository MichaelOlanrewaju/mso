import { useCallback, useRef, useState } from "react"
import { activeStation } from "../utils/station"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

export function useAdminDayRecord() {
  const [status, setStatus] = useState("idle")
  const [record, setRecord] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback((date) => {
    if (!SCRIPT_URL || !date) return
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "adminGetDayRecord")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)
    url.searchParams.set("token", getToken())

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)

    fetch(url.toString(), { method: "GET", redirect: "follow", signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) {
          setStatus("error")
          setRecord(null)
          return
        }
        setRecord(d)
        setStatus("ready")
      })
      .catch(() => {
        setStatus("error")
        setRecord(null)
      })
      .finally(() => clearTimeout(timeoutId))
  }, [])

  const updateField = useCallback((date, field, value, username) => {
    setSaving(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "adminUpdateDailySalesField", station: activeStation(), token: getToken(), username, date, field, value }),
    })
      .then(r => r.json())
      .then(d => {
        setSaving(false)
        if (d.ok) load(date)
        return d
      })
      .catch(() => {
        setSaving(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [load])

  const deleteRow = useCallback((date, sheetName, rowIndex, username) => {
    setSaving(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "adminDeleteRow", station: activeStation(), token: getToken(), username, sheetName, rowIndex }),
    })
      .then(r => r.json())
      .then(d => {
        setSaving(false)
        if (d.ok) load(date)
        return d
      })
      .catch(() => {
        setSaving(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [load])

  return { status, record, saving, load, updateField, deleteRow }
}

/* Separate from useAdminDayRecord — the overview is a different shape
   entirely (a list of day summaries, not one day's full detail), and
   keeping it separate means switching between Overview and Day-Detail
   modes doesn't clobber either one's loading state. */
export function useAdminOverview() {
  const [status, setStatus] = useState("idle") // idle | loading | loadingMore | ready | error
  const [days, setDays] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const BATCH = 14

  const fetchBatch = useCallback((offset) => {
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "adminGetOverview")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("days", BATCH)
    url.searchParams.set("offset", offset)
    url.searchParams.set("token", getToken())

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)
    return fetch(url.toString(), { method: "GET", redirect: "follow", signal: controller.signal })
      .then(r => r.json())
      .finally(() => clearTimeout(timeoutId))
  }, [])

  /* Confirmed directly: the Admin overview should show every day that
     genuinely needs attention at once, not force a manual "Load More"
     click per batch. This walks every batch automatically on initial
     load, stopping the moment the backend says there's nothing further
     back — hasMore already reflects exactly that, so this just keeps
     asking until it turns false. MAX_BATCHES is a safety cap only
     (40 batches = up to 560 days), never expected to be hit given how
     recently this station started — it exists so a backend bug can
     never turn this into a runaway loop of requests. */
  const MAX_BATCHES = 40
  const load = useCallback(() => {
    if (!SCRIPT_URL) return
    setStatus("loading")

    const loadAll = (offset, accumulated, batchCount) => {
      fetchBatch(offset)
        .then(d => {
          if (!d.ok) { setStatus("error"); setDays(accumulated); return }
          const merged = [...accumulated, ...(d.days || [])]
          if (d.hasMore && batchCount < MAX_BATCHES) {
            setDays(merged) // keep the screen updated as more comes in
            loadAll(merged.length, merged, batchCount + 1)
          } else {
            setDays(merged)
            setHasMore(false)
            setStatus("ready")
          }
        })
        .catch(() => { setStatus("error"); setDays(accumulated) })
    }

    loadAll(0, [], 1)
  }, [fetchBatch])

  // Every day already fetched is skipped by the backend the moment it
  // walks past the earliest stored record, so loading more never needs
  // to know the exact total — it just keeps asking for the next batch
  // until the backend itself says there's nothing further back.
  const loadingRef = useRef(false)
  const loadMore = useCallback(() => {
    /* Confirmed directly, tracing a real duplicate-days bug: loadMore
       reads days.length at call time to compute the next offset — if
       it fires twice quickly (a fast double-tap, or a scroll listener
       firing more than once) before the first batch's setDays has
       actually applied, both calls read the same stale length and
       fetch the identical offset, then both results get appended.
       loadingRef blocks a second call from ever starting while one is
       still in flight; the date-based dedupe on append is a second,
       independent safeguard in case of any other overlap. */
    if (loadingRef.current) return
    loadingRef.current = true
    setStatus(prev => (prev === "ready" ? "loadingMore" : prev))
    fetchBatch(days.length)
      .then(d => {
        if (!d.ok) { setStatus("ready"); return } // keep what we have on a failed "more" request
        setDays(prevDays => {
          const seen = new Set(prevDays.map(x => x.date))
          const fresh = (d.days || []).filter(x => !seen.has(x.date))
          return [...prevDays, ...fresh]
        })
        setHasMore(!!d.hasMore)
        setStatus("ready")
      })
      .catch(() => setStatus("ready"))
      .finally(() => { loadingRef.current = false })
  }, [fetchBatch, days.length])

  return { status, days, hasMore, load, loadMore }
}
