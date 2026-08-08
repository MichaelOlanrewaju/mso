/**
 * The active station, for code that isn't a React component.
 *
 * Hooks read VITE_STATION_KEY at module scope — a BUILD-time constant. That was
 * the whole reason one deployment could only ever serve one station: a
 * supervisor moved to M&M would still hit MSO's spreadsheet, because the key was
 * baked into the bundle before they ever logged in.
 *
 * This reads it from the session instead, so the same build serves both.
 *
 * Uses localStorage, not sessionStorage — confirmed directly: a CEO's chosen
 * station was being forgotten every time the app closed and reopened, sending
 * them back to the station picker instead of straight to their dashboard,
 * because sessionStorage clears on close while the login itself (which
 * correctly uses localStorage) stayed remembered. The mismatch was the bug.
 */

const KEY = "mso.activeStation"

export function activeStation() {
  try {
    const s = localStorage.getItem(KEY)
    if (s) return s.toLowerCase()
  } catch { /* private mode — fall through */ }
  return "mso"
}

/* Distinguishes a genuine past choice from activeStation()'s own built-in
   "mso" fallback — needed specifically for routing a multi-station user
   home. Without this, a brand-new multi-station login would read
   activeStation() as "mso" (the default, not a real choice) and skip the
   picker entirely, sending them to MSO's dashboard without ever having
   actually chosen it. */
export function hasChosenStation() {
  try {
    return !!localStorage.getItem(KEY)
  } catch {
    return false
  }
}

export function setActiveStation(key) {
  try { localStorage.setItem(KEY, String(key).toLowerCase()) } catch { /* ignore */ }
}

export function clearActiveStation() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
