import { useState, useCallback, useEffect } from "react"
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
 * Loads the price bands a given day actually has, and corrects one.
 *
 * "Bands" are read from SalesLog — every individual sale carries its own price,
 * so the bands are what genuinely happened at the pump rather than a stored
 * summary. A correction rewrites those sale rows, which is why the fix flows
 * through to the tiers, the revenue, and the daily headline from one edit.
 */
export function usePriceCorrection(username, date) {
  const [bands, setBands] = useState([])
  const [status, setStatus] = useState("idle")
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    if (!SCRIPT_URL || !username || !date) return
    setStatus("loading")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getDayPriceBands")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)
    url.searchParams.set("username", username)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        setBands(d.ok ? d.bands || [] : [])
        setStatus(d.ok ? "ready" : "error")
      })
      .catch(() => setStatus("error"))
  }, [username, date])

  useEffect(() => { load() }, [load])

  const correct = useCallback(async ({ product, oldPrice, newPrice }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSaving(true)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        redirect: "follow",
        body: JSON.stringify({
          action: "correctPriceBand",
          station: activeStation(),
          username,
          token: getToken(),
          date, product, oldPrice, newPrice,
        }),
      })
      const d = await res.json()
      if (d.ok) load()
      return d
    } catch (e) {
      return { ok: false, error: "Network error: " + (e.message || String(e)) }
    } finally {
      setSaving(false)
    }
  }, [username, date, load])

  /* Retroactively split a day that ran on one price but should have had two.
     Needs the metre reading at the moment the price changed — see the backend
     note; that number was never recorded, so the CEO supplies it. */
  const splitDay = useCallback(async ({ product, oldPrice, newPrice, splits }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSaving(true)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        redirect: "follow",
        body: JSON.stringify({
          action: "splitDayByPrice",
          station: activeStation(),
          username, token: getToken(),
          date, product, oldPrice, newPrice, splits,
        }),
      })
      const d = await res.json()
      if (d.ok) load()
      return d
    } catch (e) {
      return { ok: false, error: "Network error: " + (e.message || String(e)) }
    } finally {
      setSaving(false)
    }
  }, [username, date, load])

  return { bands, status, saving, correct, splitDay, refresh: load }
}

export default usePriceCorrection
