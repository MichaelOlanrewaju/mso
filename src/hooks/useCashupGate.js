import { useEffect, useState } from "react"
import { getToken } from "../utils/session"
import { activeStation } from "../utils/station"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

/* Asks the backend whether the previous trading day's cash-up is still unapproved.
   Only a cashier can be blocked; anyone else always gets { blocked:false }.
   A network failure never blocks anyone — the server enforces the rule on save anyway. */
export function useCashupGate(date, username) {
  const [gate, setGate] = useState({ blocked: false })
  useEffect(() => {
    if (!SCRIPT_URL || !date) return
    let live = true
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getCashupGate")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)
    url.searchParams.set("token", getToken())
    if (username) url.searchParams.set("username", username)
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => { if (live && d && d.ok) setGate(d.blocked ? d : { blocked: false }) })
      .catch(() => {})
    return () => { live = false }
  }, [date, username])
  return gate
}
