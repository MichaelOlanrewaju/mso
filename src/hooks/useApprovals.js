import { useCallback, useEffect, useState } from "react"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

// Previously duplicated verbatim in both GMDashboardPage.jsx and
// DashboardPage.jsx (Owner) — both now import from here instead, so a
// fix only ever needs to happen in one place.

export function useEditRequests(username) {
  const [requests, setRequests] = useState([])

  const load = useCallback(() => {
    if (!SCRIPT_URL || !username) return
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getEditRequests")
    url.searchParams.set("station", STATION_KEY)
    url.searchParams.set("username", username)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.requests) setRequests(d.requests)
      })
      .catch(() => {})
  }, [username])

  useEffect(() => {
    load()
  }, [load])

  const review = useCallback(
    (rowIndex, decision) => {
      // approveEditRequest only routes via doGet's switch — doPost has
      // no case for it. The approve/reject value is sent as "decision"
      // (not "action") since "action" is already consumed by the
      // ?action=approveEditRequest routing param itself.
      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "approveEditRequest")
      url.searchParams.set("station", STATION_KEY)
      url.searchParams.set("rowIndex", rowIndex)
      url.searchParams.set("decision", decision)
      url.searchParams.set("username", username || "")
      url.searchParams.set("token", getToken())

      return fetch(url.toString(), { method: "GET", redirect: "follow" })
        .then(r => r.json())
        .then(d => {
          if (d.ok) load()
          return d
        })
    },
    [username, load]
  )

  return { requests, refresh: load, review }
}

export function useCashupApprovals(username) {
  const [pending, setPending] = useState([])

  const load = useCallback(() => {
    if (!SCRIPT_URL || !username) return
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getPendingCashups")
    url.searchParams.set("station", STATION_KEY)
    url.searchParams.set("username", username)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.pending) setPending(d.pending)
      })
      .catch(() => {})
  }, [username])

  useEffect(() => {
    load()
  }, [load])

  const decide = useCallback(
    (date, decision) => {
      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", decision === "approve" ? "approveCashup" : "rejectCashup")
      url.searchParams.set("station", STATION_KEY)
      url.searchParams.set("date", date)
      url.searchParams.set("username", username || "")
      url.searchParams.set("token", getToken())
      return fetch(url.toString(), { method: "GET", redirect: "follow" })
        .then(r => r.json())
        .then(d => {
          if (d.ok) load()
          return d
        })
    },
    [username, load]
  )

  return { pending, refresh: load, decide }
}
