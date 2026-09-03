import { useCallback, useEffect, useRef, useState } from "react"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"

/* ── useStaff ─────────────────────────────────────────────── */
// actingUsername = the currently logged-in caller (auth.username), used
// server-side to verify THIS person actually has permission to view/edit
// the roster — the backend looks up their real role rather than trusting
// anything the client claims, so this must always be the real, logged-in
// user's own username, never the username of the staff record being
// viewed or edited.
/* viewStation is an OPTIONAL override for reading the staff list only — used
   by Chat's station toggle so CEO/GM/Lanre can see the OTHER station's
   people to message, without affecting anything else. Every write action
   below (save/invite/delete) still uses the real session station always —
   staff management should never accidentally act on a station someone was
   just glancing at. */
export function useStaff(actingUsername, viewStation) {
  const [status, setStatus] = useState("loading")
  const [staff, setStaff] = useState([])
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
    url.searchParams.set("action", "getStaff")
    url.searchParams.set("station", viewStation || activeStation())
    url.searchParams.set("username", actingUsername)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setStaff(d.ok ? (d.staff || []) : [])
        setStatus("ready")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [actingUsername, viewStation])

  useEffect(() => { load() }, [load])

  const saveStaffMember = useCallback(async ({ username, name, role, phone, basicSalary, status: empStatus }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSaving(true)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "saveStaff", station: activeStation(), token: getToken(), username: actingUsername, targetUsername: username, name, role, phone, basicSalary, status: empStatus || "active" }),
      })
      const text = await res.text()
      const d = JSON.parse(text)
      if (d.ok) load()
      return d
    } catch (e) {
      return { ok: false, error: String(e.message || e) }
    } finally {
      if (isMounted.current) setSaving(false)
    }
  }, [load, actingUsername])

  const inviteStaff = useCallback(async ({ username, name, role, phone, basicSalary, email }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSaving(true)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "inviteStaff", station: activeStation(), token: getToken(), username: actingUsername, username_new: username, name, role, phone, basicSalary, email }),
      })
      const text = await res.text()
      const d = JSON.parse(text)
      if (d.ok) load()
      return d
    } catch (e) {
      return { ok: false, error: String(e.message || e) }
    } finally {
      if (isMounted.current) setSaving(false)
    }
  }, [load, actingUsername])

  /* For adding someone to the payroll list who doesn't need — or isn't
     getting — a login account at all. Confirmed directly: not every
     Attendant or Supervisor needs app access, just to be paid. */
  const addPayrollOnly = useCallback(async ({ name, role, phone, basicSalary }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSaving(true)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "addPayrollOnlyStaff", station: activeStation(), token: getToken(), username: actingUsername, name, role, phone, basicSalary }),
      })
      const text = await res.text()
      const d = JSON.parse(text)
      if (d.ok) load()
      return d
    } catch (e) {
      return { ok: false, error: String(e.message || e) }
    } finally {
      if (isMounted.current) setSaving(false)
    }
  }, [load, actingUsername])

  /* Brings every ACTIVE tracked Attendant (from the Attendance/pump-
     allocation system) onto the payroll roster as a payroll-only
     entry, so GM can assign each one a salary — confirmed directly
     this was the actual need, not just viewing them. Existing Staff
     entries are never touched or duplicated. */
  const syncAttendants = useCallback(async () => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSaving(true)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "syncAttendantsToPayroll", station: activeStation(), token: getToken(), username: actingUsername }),
      })
      const text = await res.text()
      const d = JSON.parse(text)
      if (d.ok) load()
      return d
    } catch (e) {
      return { ok: false, error: String(e.message || e) }
    } finally {
      if (isMounted.current) setSaving(false)
    }
  }, [load, actingUsername])

  /* Confirmed directly: GM/CEO needed a real way to remove a mistaken
     entry themselves, in-app, without a one-off script every time. */
  const deleteStaff = useCallback(async (targetUsername) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSaving(true)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "deleteStaffMember", station: activeStation(), token: getToken(), username: actingUsername, targetUsername }),
      })
      const text = await res.text()
      const d = JSON.parse(text)
      if (d.ok) load()
      return d
    } catch (e) {
      return { ok: false, error: String(e.message || e) }
    } finally {
      if (isMounted.current) setSaving(false)
    }
  }, [load, actingUsername])

  return { status, staff, saving, saveStaffMember, inviteStaff, addPayrollOnly, syncAttendants, deleteStaff, refresh: load }
}

/* ── usePayroll ───────────────────────────────────────────── */
export function usePayroll(month, username) {
  const [status, setStatus] = useState("loading")
  const [lines, setLines] = useState([])
  const [saving, setSaving] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback((targetMonth) => {
    if (!SCRIPT_URL || !targetMonth || !username) { setStatus("idle"); return }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getPayroll")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("month", targetMonth)
    url.searchParams.set("username", username)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setLines(d.ok ? (d.payroll || []) : [])
        setStatus("ready")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [username])

  useEffect(() => { load(month) }, [month, load])

  /* Save via GET to avoid POST/redirect issues with Apps Script */
  const savePayrollRun = useCallback(async ({ month: targetMonth, lines: payLines, username, remarks }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Script URL not configured." }
    if (!payLines || payLines.length === 0) return { ok: false, error: "No staff lines to save — add staff first." }
    setSaving(true)
    try {
      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "savePayrollGET")
      url.searchParams.set("station", activeStation())
      url.searchParams.set("month", targetMonth)
      url.searchParams.set("username", username || "")
      url.searchParams.set("token", getToken())
      url.searchParams.set("remarks", remarks || "")
      url.searchParams.set("lines", encodeURIComponent(JSON.stringify(payLines)))
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" })
      const text = await res.text()
      let d
      try { d = JSON.parse(text) }
      catch { return { ok: false, error: "Server error. Redeploy Code.gs and run setupAllSheets." } }
      if (d.ok) load(targetMonth)
      return d
    } catch (e) {
      return { ok: false, error: "Network error: " + (e.message || String(e)) }
    } finally {
      if (isMounted.current) setSaving(false)
    }
  }, [load])

  const approvePayrollRun = useCallback(async ({ month: targetMonth, decision, username }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "approvePayroll")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("month", targetMonth)
    url.searchParams.set("decision", decision)
    url.searchParams.set("username", username || "")
      url.searchParams.set("token", getToken())
    try {
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" })
      const d = await res.json()
      if (d.ok) load(targetMonth)
      return d
    } catch (e) {
      return { ok: false, error: "Network error: " + (e.message || String(e)) }
    }
  }, [load])

  const clearPayrollMonth = useCallback(async ({ month: targetMonth, username, force }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "clearPayrollMonth")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("month", targetMonth)
    url.searchParams.set("username", username || "")
    if (force) url.searchParams.set("force", "1")
    url.searchParams.set("token", getToken())
    try {
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" })
      const d = await res.json()
      if (d.ok) load(targetMonth)
      return d
    } catch (e) {
      return { ok: false, error: "Network error: " + (e.message || String(e)) }
    }
  }, [load])

  return { status, lines, saving, savePayrollRun, approvePayrollRun, clearPayrollMonth, refresh: () => load(month) }
}

/* ── usePendingPayroll — Owner dashboard ──────────────────── */
export function usePendingPayroll(username) {
  const [pending, setPending] = useState([])
  const [status, setStatus] = useState("loading")
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL || !username) { setStatus("idle"); return }
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getPendingPayroll")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("username", username)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setPending(d.ok ? (d.pending || []) : [])
        setStatus("ready")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [username])

  useEffect(() => { load() }, [load])

  const approve = useCallback(async ({ month, decision, username }) => {
    if (!SCRIPT_URL) return { ok: false }
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "approvePayroll")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("month", month)
    url.searchParams.set("decision", decision)
    url.searchParams.set("username", username || "")
      url.searchParams.set("token", getToken())
    try {
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" })
      const d = await res.json()
      if (d.ok) load()
      return d
    } catch { return { ok: false, error: "Network error" } }
  }, [load])

  return { status, pending, approve, refresh: load }
}
