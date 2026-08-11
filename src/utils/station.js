/**
 * The active station, for code that isn't a React component.
 *
 * Hooks read VITE_STATION_KEY at module scope — a BUILD-time constant. That was
 * the whole reason one deployment could only ever serve one station: a
 * supervisor moved to M&M would still hit MSO's spreadsheet, because the key was
 * baked into the bundle before they ever logged in.
 *
 * This reads it from the session instead, so the same build serves both.
 */

const KEY = "mso.activeStation"

export function activeStation() {
  try {
    const s = sessionStorage.getItem(KEY)
    if (s) return s.toLowerCase()
  } catch { /* private mode — fall through */ }
  return "mso"
}

export function setActiveStation(key) {
  try { sessionStorage.setItem(KEY, String(key).toLowerCase()) } catch { /* ignore */ }
}

export function clearActiveStation() {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}
