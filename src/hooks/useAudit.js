import { useCallback, useEffect, useRef, useState } from "react"
import { getToken } from "../utils/session"
import { activeStation } from "../utils/station"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

/* Read-only data audit for GM/CEO. Newest request wins, so switching the
   date range quickly can't let a slow earlier response overwrite a newer one. */
export function useAudit(from, to, username) {
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")
  const [data, setData] = useState(null)
  const req = useRef(0)

  const load = useCallback(() => {
    if (!SCRIPT_URL) { setStatus("idle"); return }
    const mine = ++req.current
    setStatus("loading"); setError("")
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getAudit")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("from", from)
    url.searchParams.set("to", to)
    url.searchParams.set("token", getToken())
    if (username) url.searchParams.set("username", username)
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (mine !== req.current) return
        if (d.ok) { setData(d); setStatus("ready") }
        else { setError(d.error || "Could not load the audit."); setStatus("error") }
      })
      .catch(() => { if (mine === req.current) { setError("Network problem — try again."); setStatus("error") } })
  }, [from, to, username])

  useEffect(() => { load() }, [load])
  return { status, error, data, refresh: load }
}
