import { useCallback, useEffect, useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

export function useExpensesData(username, date) {
  const [status, setStatus] = useState("loading")
  const [items, setItems] = useState([])
  const [desc, setDesc] = useState("")
  const [amt, setAmt] = useState("")
  const [saving, setSaving] = useState(false)
  /* Same edit-request gate as dip/pump — an already-submitted day's
     expenses can't be silently corrected or removed. This tracks whether
     GM/CEO has approved a not-yet-used edit for this specific date. */
  const [expenseUnlocked, setExpenseUnlocked] = useState(false)
  const [requestingEdit, setRequestingEdit] = useState(false)

  const load = useCallback(() => {
    if (!SCRIPT_URL || !date) {
      setStatus("idle")
      return
    }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getDailyReport")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)
    url.searchParams.set("username", username || "")

    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (!d.ok) {
          // No DailySales row for this date yet — treat as zero expenses
          // logged so far, not an error; the page is still fully usable
          // for adding the day's first expense before any dip exists.
          setItems([])
          setStatus("ready")
          return
        }
        setItems(d.report?.expense_items || [])
        setStatus("ready")
      })
      .catch(() => setStatus("error"))

    // Separate call, since lock status isn't part of getDailyReport's
    // payload — same endpoint the Dip page already uses for this.
    const lockUrl = new URL(SCRIPT_URL)
    lockUrl.searchParams.set("action", "getEditLockStatus")
    lockUrl.searchParams.set("station", activeStation())
    lockUrl.searchParams.set("date", date)
    fetch(lockUrl.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => setExpenseUnlocked(d.ok ? !!d.expenseUnlocked : false))
      .catch(() => setExpenseUnlocked(false))
  }, [username, date])

  useEffect(() => {
    load()
  }, [load])

  const total = items.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const addExpense = useCallback(() => {
    const amount = Number(amt) || 0
    if (!desc.trim() || amount <= 0) {
      return Promise.resolve({ ok: false, error: "Enter a description and amount" })
    }
    setSaving(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "saveExpense",
        station: activeStation(),
        username,
        date,
        description: desc.trim(),
        amount,
      }),
      redirect: "follow",
    })
      .then(res => res.json())
      .then(d => {
        setSaving(false)
        if (d.ok) {
          setDesc("")
          setAmt("")
          // Refreshing rather than optimistically appending — saveExpense
          // doesn't return the new row's index, and without it the freshly
          // added expense couldn't be edited or deleted until some other
          // refresh happened to come along and backfill it.
          load()
        }
        return d
      })
      .catch(() => {
        setSaving(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [desc, amt, username, date, load])

  const editExpense = useCallback((rowIndex, description, amount) => {
    if (!description.trim() || !(Number(amount) > 0)) {
      return Promise.resolve({ ok: false, error: "Enter a description and amount" })
    }
    setSaving(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "updateExpense", station: activeStation(), username, date, rowIndex, description: description.trim(), amount: Number(amount) }),
      redirect: "follow",
    })
      .then(res => res.json())
      .then(d => {
        setSaving(false)
        if (d.ok) load()
        return d
      })
      .catch(() => {
        setSaving(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [username, date, load])

  const removeExpense = useCallback((rowIndex) => {
    setSaving(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "deleteExpense", station: activeStation(), username, date, rowIndex }),
      redirect: "follow",
    })
      .then(res => res.json())
      .then(d => {
        setSaving(false)
        if (d.ok) load()
        return d
      })
      .catch(() => {
        setSaving(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [username, date, load])

  const requestEditForExpense = useCallback((message) => {
    setRequestingEdit(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "saveEditRequest", station: activeStation(), username, date, type: "expense", message: message || "Correct an expense entry" }),
      redirect: "follow",
    })
      .then(res => res.json())
      .then(d => {
        setRequestingEdit(false)
        return d
      })
      .catch(() => {
        setRequestingEdit(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [username, date])

  return {
    status, items, total, refresh: load,
    desc, setDesc, amt, setAmt, addExpense, saving,
    expenseUnlocked, editExpense, removeExpense,
    requestEditForExpense, requestingEdit,
    configured: Boolean(SCRIPT_URL),
  }
}
