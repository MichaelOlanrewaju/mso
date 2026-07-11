import { useCallback, useEffect, useRef, useState } from "react"
import {
  initOneSignal,
  requestPushPermission,
  identifyPushUser,
  clearPushUser,
  getPushPermission,
} from "../utils/onesignal"

/* ═══════════════════════════════════════════════════════════
   usePushNotifications — thin, modular React wrapper around the
   OneSignal utility. Keeps components free of SDK details.

   - Initializes OneSignal once, AFTER mount (never blocks first paint).
   - Exposes current permission state for UI.
   - Keeps the OneSignal identity in sync with the logged-in user, so the
     backend can target a specific person/role.
   - Uses refs to avoid re-identifying on every render (no wasted work,
     no extra re-renders).
═══════════════════════════════════════════════════════════ */
export function usePushNotifications(user /* { username, role, station } | null */) {
  const [permission, setPermission] = useState(() => getPushPermission())
  const [ready, setReady] = useState(false)
  const identifiedFor = useRef(null)

  // Initialize the SDK once, after the component mounts.
  useEffect(() => {
    let alive = true
    initOneSignal().then((os) => {
      if (!alive) return
      setReady(Boolean(os))
      setPermission(getPushPermission())
    })
    return () => { alive = false }
  }, [])

  // Keep OneSignal identity in sync with the app's user. Guarded by a ref
  // so we only call the SDK when the username actually changes — not on
  // every render.
  useEffect(() => {
    if (!ready) return
    const uname = user?.username ? String(user.username).toLowerCase() : null

    if (uname && identifiedFor.current !== uname) {
      identifiedFor.current = uname
      identifyPushUser({ username: uname, role: user.role, station: user.station })
    } else if (!uname && identifiedFor.current) {
      identifiedFor.current = null
      clearPushUser()
    }
  }, [ready, user?.username, user?.role, user?.station])

  // Ask for permission — call from a user gesture. Updates local state.
  const enable = useCallback(async () => {
    const result = await requestPushPermission()
    setPermission(getPushPermission())
    // If they just granted, make sure identity is attached right away.
    if (result === "granted" && user?.username) {
      identifyPushUser({ username: user.username, role: user.role, station: user.station })
    }
    return result
  }, [user?.username, user?.role, user?.station])

  return {
    ready,          // SDK loaded & supported
    permission,     // "default" | "granted" | "denied" | "unsupported"
    enable,         // () => Promise<"granted"|"denied"|"dismissed"|"unsupported"|"error">
  }
}
