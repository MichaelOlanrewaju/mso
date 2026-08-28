import { useCallback, useState } from "react"
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
  const [status, setStatus] = useState("idle")
  const [days, setDays] = useState([])

  const load = useCallback((numDays = 14) => {
    if (!SCRIPT_URL) return
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "adminGetOverview")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("days", numDays)
    url.searchParams.set("token", getToken())

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)

    fetch(url.toString(), { method: "GET", redirect: "follow", signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) {
          setStatus("error")
          setDays([])
          return
        }
        setDays(d.days || [])
        setStatus("ready")
      })
      .catch(() => {
        setStatus("error")
        setDays([])
      })
      .finally(() => clearTimeout(timeoutId))
  }, [])

  return { status, days, load }
}
