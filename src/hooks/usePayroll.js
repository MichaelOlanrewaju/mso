import { useCallback, useEffect, useRef, useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

/* ── useStaff ─────────────────────────────────────────────── */
export function useStaff() {
  const [status, setStatus] = useState("loading")
  const [staff, setStaff] = useState([])
  const [saving, setSaving] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL) { setStatus("idle"); return }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getStaff")
    url.searchParams.set("station", STATION_KEY)
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setStaff(d.ok ? (d.staff || []) : [])
        setStatus("ready")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [])

  useEffect(() => { load() }, [load])

  const saveStaffMember = useCallback(async ({ username, name, role, phone, basicSalary, status: empStatus }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSaving(true)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "saveStaff", station: STATION_KEY, username, name, role, phone, basicSalary, status: empStatus || "active" }),
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
  }, [load])

  const inviteStaff = useCallback(async ({ username, name, role, phone, basicSalary, email }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSaving(true)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "inviteStaff", station: STATION_KEY, username, name, role, phone, basicSalary, email }),
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
  }, [load])

  return { status, staff, saving, saveStaffMember, inviteStaff, refresh: load }
}

/* ── usePayroll ───────────────────────────────────────────── */
export function usePayroll(month) {
  const [status, setStatus] = useState("loading")
  const [lines, setLines] = useState([])
  const [saving, setSaving] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback((targetMonth) => {
    if (!SCRIPT_URL || !targetMonth) { setStatus("idle"); return }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getPayroll")
    url.searchParams.set("station", STATION_KEY)
    url.searchParams.set("month", targetMonth)
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setLines(d.ok ? (d.payroll || []) : [])
        setStatus("ready")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [])

  useEffect(() => { load(month) }, [month, load])

  /* Save via GET to avoid POST/redirect issues with Apps Script */
  const savePayrollRun = useCallback(async ({ month: targetMonth, lines: payLines, username }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Script URL not configured." }
    if (!payLines || payLines.length === 0) return { ok: false, error: "No staff lines to save — add staff first." }
    setSaving(true)
    try {
      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "savePayrollGET")
      url.searchParams.set("station", STATION_KEY)
      url.searchParams.set("month", targetMonth)
      url.searchParams.set("username", username || "")
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
    url.searchParams.set("station", STATION_KEY)
    url.searchParams.set("month", targetMonth)
    url.searchParams.set("decision", decision)
    url.searchParams.set("username", username || "")
    try {
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" })
      const d = await res.json()
      if (d.ok) load(targetMonth)
      return d
    } catch (e) {
      return { ok: false, error: "Network error: " + (e.message || String(e)) }
    }
  }, [load])

  return { status, lines, saving, savePayrollRun, approvePayrollRun, refresh: () => load(month) }
}

/* ── usePendingPayroll — Owner dashboard ──────────────────── */
export function usePendingPayroll() {
  const [pending, setPending] = useState([])
  const [status, setStatus] = useState("loading")
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL) { setStatus("idle"); return }
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getPendingPayroll")
    url.searchParams.set("station", STATION_KEY)
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        setPending(d.ok ? (d.pending || []) : [])
        setStatus("ready")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [])

  useEffect(() => { load() }, [load])

  const approve = useCallback(async ({ month, decision, username }) => {
    if (!SCRIPT_URL) return { ok: false }
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "approvePayroll")
    url.searchParams.set("station", STATION_KEY)
    url.searchParams.set("month", month)
    url.searchParams.set("decision", decision)
    url.searchParams.set("username", username || "")
    try {
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" })
      const d = await res.json()
      if (d.ok) load()
      return d
    } catch { return { ok: false, error: "Network error" } }
  }, [load])

  return { status, pending, approve, refresh: load }
}
