import { useState, useCallback } from "react"
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
 * Performs a mid-day price cutover for one product.
 *
 * The supervisor enters each pump's current reading once. The server closes the
 * running session at the OLD price using that number, then opens the next
 * session at the NEW price starting from the same number — because a pump's
 * closing metre and the next session's opening metre are physically the same
 * continuous counter. Typing it twice would invite a typo that silently creates
 * or loses litres at the boundary.
 */
export function usePriceCutover(username) {
  const [saving, setSaving] = useState(false)

  const runCutover = useCallback(async ({ date, product, newPrice, readings }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSaving(true)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        redirect: "follow",
        body: JSON.stringify({
          action: "pumpPriceCutover",
          station: activeStation(),
          username,
          token: getToken(),
          date,
          product,
          newPrice,
          readings,
        }),
      })
      return await res.json()
    } catch (e) {
      return { ok: false, error: "Network error: " + (e.message || String(e)) }
    } finally {
      setSaving(false)
    }
  }, [username])

  /* Different situation from a normal cutover: this pump's session is
     already fully closed, and the price then changed again afterward,
     with more fuel still to be sold. Starts a brand-new session from the
     existing closing reading — the already-closed session is never
     touched or re-logged. One call per pump, since each pump's already-
     closed state needs to be confirmed individually rather than assumed
     for a whole batch. */
  const reopenPump = useCallback(async ({ date, pumpId, newPrice }) => {
    if (!SCRIPT_URL) return { ok: false, error: "Not connected." }
    setSaving(true)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        redirect: "follow",
        body: JSON.stringify({
          action: "reopenPumpForNewPriceSession",
          station: activeStation(),
          username,
          token: getToken(),
          date,
          pumpId,
          newPrice,
        }),
      })
      return await res.json()
    } catch (e) {
      return { ok: false, error: "Network error: " + (e.message || String(e)) }
    } finally {
      setSaving(false)
    }
  }, [username])

  return { runCutover, reopenPump, saving }
}

export default usePriceCutover
