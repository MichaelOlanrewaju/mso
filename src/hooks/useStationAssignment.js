import { useState, useEffect, useCallback, useRef } from "react"
import { activeStation } from "../utils/station"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

function getToken() {
  try {
    const raw = localStorage.getItem("mso_session") || sessionStorage.getItem("mso_session")
    return raw ? JSON.parse(raw).user?.token || "" : ""
  } catch {
    return ""
  }
}

/**
 * Powers the station-assignment page.
 *
 * Loads every reassignable staff member (supervisors and cashiers) across BOTH
 * stations, and moves a person from one station to the other. The move is a real
 * relocation of their Staff row between the two workbooks — handled server-side
 * — not a field edit, so their login keeps working and simply lands them on the
 * other station next time.
 */
export function useStationAssignment(username) {
  const [staff, setStaff] = useState([])
  const [status, setStatus] = useState("loading")
  const [savingUser, setSavingUser] = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL || !username) { setStatus("idle"); return }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getReassignableStaff")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("username", username)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setStaff(d.ok ? (d.staff || []) : [])
        setStatus(d.ok ? "ready" : "error")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [username])

  useEffect(() => { load() }, [load])

  const reassign = useCallback(async (targetUsername, toStation) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSavingUser(targetUsername)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        redirect: "follow",
        body: JSON.stringify({
          action: "reassignStation",
          username,
          token: getToken(),
          targetUsername,
          toStation,
        }),
      })
      const d = await res.json()
      if (d.ok) load()
      return d
    } catch (e) {
      return { ok: false, error: "Network error: " + (e.message || String(e)) }
    } finally {
      if (isMounted.current) setSavingUser(null)
    }
  }, [username, load])

  return { staff, status, savingUser, reassign, refresh: load }
}

export default useStationAssignment
