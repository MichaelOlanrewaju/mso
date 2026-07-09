import { useCallback, useEffect, useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

export function useExpensesData(username) {
  const [status, setStatus] = useState("loading")
  const [items, setItems] = useState([])
  const [desc, setDesc] = useState("")
  const [amt, setAmt] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    if (!SCRIPT_URL) {
      setStatus("idle")
      return
    }
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getDailyReport")
    url.searchParams.set("station", STATION_KEY)
    url.searchParams.set("date", todayISO())
    url.searchParams.set("username", username || "")

    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (!d.ok) {
          // No DailySales row for today yet — treat as zero expenses
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
  }, [username])

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
        station: STATION_KEY,
        username,
        date: todayISO(),
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
          // Optimistically append rather than re-fetching the whole
          // report — saveExpense doesn't return the new row, and a
          // full getDailyReport round-trip just to show one new line
          // is unnecessary network cost for what the user already
          // knows they just typed.
          setItems(prev => [...prev, { description: desc.trim(), amount }])
        }
        return d
      })
      .catch(() => {
        setSaving(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [desc, amt, username])

  return {
    status, items, total, refresh: load,
    desc, setDesc, amt, setAmt, addExpense, saving,
    configured: Boolean(SCRIPT_URL),
  }
}
