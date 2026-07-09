import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

const SESSION_KEY = "mso_session"
const LEGACY_KEY = "mso_u"
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days, matches mso-auth.js

export function dashboardPathFor(sessionUser) {
  const station = sessionUser.station
  const role = sessionUser.role
  const username = sessionUser.u || sessionUser.username
  // Owner or multi-station user with no station selected yet → station picker
  if (!station || station === "both" || station === "null") return "/select"
  if (role === "supervisor") return `/dashboard-supervisor-${station}`
  if (role === "gm") return `/dashboard-gm-${station}`
  if (role === "cashier") return `/dashboard-cashier-${station}`
  // owner (by role or username) or unknown → general dashboard
  return `/dashboard-${station}`
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
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const session = readSession()
    setUser(session)
    setLoading(false)

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

  const login = useCallback(
    sessionUser => {
      try {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify({ user: sessionUser, savedAt: Date.now() }))
      } catch (e) {
        // localStorage may be unavailable — fall back to sessionStorage
        try {
          window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: sessionUser, savedAt: Date.now() }))
        } catch (e2) {}
      }
      setUser(sessionUser)

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
    isOwner: user ? (user.role === "owner" || user.u === "owner") : false,
    isGM: user ? user.role === "gm" : false,
  }
}
