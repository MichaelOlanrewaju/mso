import { useCallback, useEffect, useRef, useState } from "react"
import { getToken } from "../utils/session"
import { activeStation } from "../utils/station"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

/* Attendants are tracked people, not app users — no login, no role. Just a
   directory supervisors/GM manage, matching the explicit decision from the
   M&M meeting notes. */
export function useAttendants(actingUsername) {
  const [status, setStatus] = useState("loading")
  const [attendants, setAttendants] = useState([])
  const [saving, setSaving] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL || !actingUsername) { setStatus("idle"); return }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getAttendants")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("username", actingUsername)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setAttendants(d.ok ? (d.attendants || []) : [])
        setStatus("ready")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [actingUsername])

  useEffect(() => { load() }, [load])

  const saveAttendant = useCallback((attendant) => {
    setSaving(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "saveAttendant",
        station: activeStation(),
        token: getToken(),
        username: actingUsername,
        attendantId: attendant.attendantId || "",
        name: attendant.name,
        phone: attendant.phone || "",
        status: attendant.status || "active",
      }),
      redirect: "follow",
    })
      .then(r => r.json())
      .then(d => {
        setSaving(false)
        if (d.ok) load()
        return d
      })
      .catch(() => {
        setSaving(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [actingUsername, load])

  return { status, attendants, saving, refresh: load, saveAttendant }
}

/* ── useAttendance ────────────────────────────────────────── */
export function useAttendance(actingUsername, date) {
  const [status, setStatus] = useState("loading")
  const [records, setRecords] = useState([])
  const [saving, setSaving] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL || !actingUsername || !date) { setStatus("idle"); return }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getAttendance")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)
    url.searchParams.set("username", actingUsername)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setRecords(d.ok ? (d.attendance || []) : [])
        setStatus("ready")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [actingUsername, date])

  useEffect(() => { load() }, [load])

  const markAttendance = useCallback((marks) => {
    setSaving(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "markAttendance",
        station: activeStation(),
        token: getToken(),
        username: actingUsername,
        date,
        marks,
      }),
      redirect: "follow",
    })
      .then(r => r.json())
      .then(d => {
        setSaving(false)
        if (d.ok) load()
        return d
      })
      .catch(() => {
        setSaving(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [actingUsername, date, load])

  return { status, records, saving, refresh: load, markAttendance }
}

/* ── useAttendantProfile ──────────────────────────────────── */
export function useAttendantProfile(actingUsername, attendantId) {
  const [status, setStatus] = useState("loading")
  const [data, setData] = useState(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL || !actingUsername || !attendantId) { setStatus("idle"); return }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getAttendantProfile")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("attendantId", attendantId)
    url.searchParams.set("username", actingUsername)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        if (d.ok) {
          setData(d)
          setStatus("ready")
        } else {
          setStatus("error")
        }
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [actingUsername, attendantId])

  useEffect(() => { load() }, [load])

  return { status, data, refresh: load }
}

/* ── useAttendantsPerformance ─────────────────────────────── */
export function useAttendantsPerformance(actingUsername, period) {
  const [status, setStatus] = useState("loading")
  const [attendants, setAttendants] = useState([])
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL || !actingUsername) { setStatus("idle"); return }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getAttendantsPerformance")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("period", period)
    url.searchParams.set("username", actingUsername)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setAttendants(d.ok ? (d.attendants || []) : [])
        setStatus(d.ok ? "ready" : "error")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [actingUsername, period])

  useEffect(() => { load() }, [load])

  return { status, attendants, refresh: load }
}
