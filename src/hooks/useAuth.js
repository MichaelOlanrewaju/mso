import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { activeStation, hasChosenStation, setActiveStation, clearActiveStation } from "../utils/station"

const SESSION_KEY = "mso_session"
const LEGACY_KEY = "mso_u"
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days, matches mso-auth.js

export function dashboardPathFor(sessionUser) {
  const role = sessionUser.role
  const username = sessionUser.u || sessionUser.username
  let station = sessionUser.station

  /* A "both"-station account (owner, CEO, some GMs) deliberately never gets
     one fixed station on the login record — that's what lets them switch.
     But that meant every single app reopen sent them back to the picker,
     even after they'd already chosen a station and been using it for days
     — confirmed directly. hasChosenStation() checks for a genuine PAST
     choice specifically, not activeStation()'s own "mso" fallback — a
     brand-new multi-station login with nothing chosen yet still correctly
     lands on the picker, same as always. */
  if (!station || station === "both" || station === "null") {
    if (hasChosenStation()) {
      station = activeStation()
    } else {
      return "/select"
    }
  }

  if (role === "supervisor") return `/dashboard-supervisor/${station}`
  if (role === "gm") return `/dashboard-gm/${station}`
  if (role === "cashier") return `/dashboard-cashier/${station}`
  // owner (by role or username) or unknown → general dashboard
  return `/dashboard/${station}`
}

function readSession() {
  if (typeof window === "undefined") return null

  // Migrate any pre-existing old-style sessionStorage session first,
  // exactly like mso-auth.js's require() does on every page load.
  try {
    const oldRaw = window.sessionStorage.getItem(LEGACY_KEY)
    if (oldRaw) {
      const oldUser = JSON.parse(oldRaw)
      if (oldUser) {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify({ user: oldUser, savedAt: Date.now() }))
        window.sessionStorage.removeItem(LEGACY_KEY)
      }
    }
  } catch (e) {
    // ignore malformed legacy session
  }

  let raw = null
  try {
    raw = window.localStorage.getItem(SESSION_KEY) || window.sessionStorage.getItem(SESSION_KEY)
  } catch (e) {
    return null
  }
  if (!raw) return null

  try {
    const record = JSON.parse(raw)
    if (!record || !record.user) return null

    // 30-day rolling expiry — matches mso-auth.js get()
    if (Date.now() - record.savedAt > EXPIRY_MS) {
      clearSession()
      return null
    }

    // NOTE: earlier this force-cleared any session without a token, to
    // push everyone through a one-time re-login. That's no longer needed —
    // the backend now accepts a verified username as a fallback when a
    // token is missing/stale (hybrid auth), so a tokenless session keeps
    // working and simply gains a token on the user's next natural login.
    // Force-clearing here is what made legitimate users hit "session
    // expired" unexpectedly, so we let the session stand.

    // Roll the expiry forward on every read, keeping active users signed in
    record.savedAt = Date.now()
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(record))
    } catch (e2) {
      // ignore write failure (private mode, full storage, etc.)
    }

    return record.user
  } catch (e) {
    clearSession()
    return null
  }
}

function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY)
    window.sessionStorage.removeItem(SESSION_KEY)
    window.sessionStorage.removeItem(LEGACY_KEY)
  } catch (e) {
    // ignore
  }
}

export function useAuth({ requireAuth = false, stationFilter = null } = {}) {
  const [user, setUser] = useState(null)
  const syncRef = useRef(null)   // lets callers (e.g. a "Sync now" button) trigger the same check on demand
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const session = readSession()
    setUser(session)
    setLoading(false)

    /* Keep sessionStorage's active station in step with the signed-in user.
       A single-station user (e.g. an M&M supervisor) never picks at /select, so
       nothing used to write their station here — activeStation() fell back to
       its "mso" default and the whole app, including brand colours, stayed MSO
       even though they'd logged into M&M. Their own station is authoritative. */
    if (session && session.station && session.station !== "both") {
      setActiveStation(session.station)
    }

    if (requireAuth && !session) {
      navigate("/", { replace: true })
      return
    }

    // Station guard — a single-station user landing on the wrong
    // station's page gets redirected home, matching mso-auth.js
    // require(stationFilter). Multi-station users (pick:true, e.g.
    // the owner) are exempt and can view either station.
    if (session && stationFilter && session.station && session.station !== stationFilter && !session.pick) {
      navigate(dashboardPathFor(session), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Re-check role and station against the server, so an admin change reaches
     the user without a manual logout. Runs once on mount and whenever the tab
     regains focus — the moments a stale session actually matters. If the person
     was reassigned, we update the stored session, repoint the active station
     (which repaints the brand colours), and if their role changed, route them to
     the correct dashboard. If the account was removed or deactivated, we sign
     them out cleanly rather than leaving them in a broken state. */
  useEffect(() => {
    const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
    if (!SCRIPT_URL) return

    const sync = () => {
      const current = readSession()
      if (!current || !current.username) return

      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "refreshSession")
      url.searchParams.set("username", current.username)
      url.searchParams.set("token", current.token || "")

      fetch(url.toString(), { method: "GET", redirect: "follow" })
        .then(r => r.json())
        .then(d => {
          if (!d) return
          if (d.accountGone || d.inactive) { clearSession(); setUser(null); navigate("/", { replace: true }); return }
          if (!d.ok || !d.user) return

          const roleChanged = String(d.user.role || "") !== String(current.role || "")
          const stationChanged = String(d.user.station || "") !== String(current.station || "")
          if (!roleChanged && !stationChanged) return

          /* Persist the server's version and apply it live. */
          const merged = { ...current, role: d.user.role, station: d.user.station, name: d.user.name || current.name }
          try {
            const raw = window.localStorage.getItem(SESSION_KEY) || window.sessionStorage.getItem(SESSION_KEY)
            const rec = raw ? JSON.parse(raw) : { savedAt: Date.now() }
            rec.user = merged; rec.savedAt = Date.now()
            const store = window.localStorage.getItem(SESSION_KEY) ? window.localStorage : window.sessionStorage
            store.setItem(SESSION_KEY, JSON.stringify(rec))
          } catch (e) { /* storage unavailable */ }

          if (merged.station && merged.station !== "both") setActiveStation(merged.station)
          setUser(merged)

          /* A role or station change usually means a different dashboard. Send
             them there so they're not sitting on a page they can no longer use. */
          if (roleChanged || stationChanged) {
            navigate(dashboardPathFor(merged), { replace: true })
            /* Repaint brand colours immediately — the station theme is applied
               from auth on next render, and the reassign may need a clean slate. */
            if (stationChanged) {
              /* One reload only — a sessionStorage flag stops a detected change
                 from reloading again on the fresh page load. */
              const flag = "mso.stationSynced"
              if (!sessionStorage.getItem(flag)) {
                sessionStorage.setItem(flag, merged.station)
                window.location.reload()
              }
            }
          }
        })
        .catch(() => { /* offline — keep the existing session */ })
    }

    sync()
    syncRef.current = sync
    const onFocus = () => { if (document.visibilityState === "visible") sync() }
    document.addEventListener("visibilitychange", onFocus)
    /* Also poll periodically while the app is open. A supervisor who leaves
       the app open on one dashboard all shift would otherwise never trigger
       the load/focus checks and could keep seeing their OLD station until they
       happen to background the tab. Every 2 minutes is frequent enough that a
       reassignment reaches them within a coffee break, not by accident. */
    const interval = setInterval(() => { if (document.visibilityState === "visible") sync() }, 120000)
    return () => { document.removeEventListener("visibilitychange", onFocus); clearInterval(interval) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(
    sessionUser => {
      try {
        sessionStorage.removeItem("mso.stationSynced")
        window.localStorage.setItem(SESSION_KEY, JSON.stringify({ user: sessionUser, savedAt: Date.now() }))
      } catch (e) {
        // localStorage may be unavailable — fall back to sessionStorage
        try {
          window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: sessionUser, savedAt: Date.now() }))
        } catch (e2) {}
      }
      setUser(sessionUser)

      /* Sync the active station on fresh login too, so the first painted screen
         is already in the right brand. */
      if (sessionUser.station && sessionUser.station !== "both") {
        setActiveStation(sessionUser.station)
      } else {
        clearActiveStation()
      }

      // Route exactly like mso-auth.js route(): multi-station users
      // (pick:true) or users with no fixed station go to /select;
      // everyone else goes straight to their station's dashboard.
      if (sessionUser.pick || !sessionUser.station) {
        navigate("/select", { replace: true })
      } else {
        navigate(dashboardPathFor(sessionUser), { replace: true })
      }
    },
    [navigate]
  )

  const logout = useCallback(() => {
      clearActiveStation()
    // Revoke the server-side session token too (fire-and-forget — local
    // logout must never be blocked by a slow/failed network call).
    try {
      const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
      const raw = window.localStorage.getItem(SESSION_KEY)
      const token = raw ? (JSON.parse(raw)?.user?.token || "") : ""
      if (SCRIPT_URL && token) {
        fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "logout", token }) }).catch(() => {})
      }
    } catch { /* never block logout */ }
    clearSession()
    setUser(null)
    navigate("/", { replace: true })
  }, [navigate])

  return {
    user,
    loading,
    login,
    logout,
    role: user ? (user.role || (user.u === "owner" ? "owner" : "")) : "",
    name: user ? user.name : "",
    username: user ? user.u : "",
    station: user ? user.station : null,
    canPickStation: user ? Boolean(user.pick) : false,
    // isOwner accepts BOTH 'ceo' and legacy 'owner' during/after the
    // rename, so a CEO-role account has full top-level access whether the
    // Staff sheet says 'ceo' or still says 'owner'. isCeo is an alias for
    // the same thing, for readability in newer code.
    isOwner: user ? (user.role === "ceo" || user.role === "owner" || user.u === "owner") : false,
    isCeo: user ? (user.role === "ceo" || user.role === "owner" || user.u === "owner") : false,
    isGM: user ? user.role === "gm" : false,
    syncNow: () => syncRef.current && syncRef.current(),
  }
}
