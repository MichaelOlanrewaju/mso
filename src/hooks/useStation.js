import { useEffect, useMemo } from "react"
import { getStation, themeFor } from "../config/stations"

/**
 * Which station am I looking at, and what does it look like?
 *
 * The station used to come from VITE_activeStation() — a BUILD-time constant baked
 * into the bundle. That meant one deployment could only ever serve one station,
 * so moving a supervisor from MSO to M&M did nothing: they'd land on a page
 * that still read MSO's spreadsheet.
 *
 * Now it comes from the signed-in user's Staff record. Owners and anyone marked
 * `both` pick at /select; everyone else lands on their own station and can't
 * reach the other one's data.
 *
 * The theme is applied by writing CSS custom properties onto <html>, so a
 * single stylesheet serves both brands and nothing has to re-render to change
 * colour.
 */
export function useStation(auth) {
  /* The station the user is actually working in:
       - a single-station user has it fixed on their Staff row
       - an owner / `both` user picks one, and it's remembered in the session   */
  const key = useMemo(() => {
    const picked = typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("mso.activeStation")
      : null
    const own = auth?.station
    if (own && own !== "both") return own          // fixed to their own station
    if (picked) return picked                      // owner's choice this session
    return "mso"                                   // sensible default
  }, [auth?.station])

  const station = getStation(key)
  const theme = themeFor(key)

  /* Paint the theme onto the document. Every component reads these variables
     rather than a hardcoded hex, so M&M's wine-and-gold and MSO's navy-and-cyan
     come from the same stylesheet. */
  useEffect(() => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    Object.entries(theme).forEach(([k, v]) => {
      root.style.setProperty(`--brand-${k.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}`, v)
    })
    root.setAttribute("data-station", key)
    /* The PWA's status bar and task-switcher colour should match the station
       too — otherwise an M&M user sees MSO navy behind their own app. */
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute("content", theme.primary)
  }, [key, theme])

  return { key, station, theme, name: station.name, short: station.short }
}

/* Set the active station for this session. Only meaningful for owners and
   `both` users — a supervisor assigned to one station cannot switch. */
export function setActiveStation(key) {
  try { sessionStorage.setItem("mso.activeStation", String(key).toLowerCase()) } catch { /* private mode */ }
}

export function getActiveStation(auth) {
  const own = auth?.station
  if (own && own !== "both") return own
  try { return sessionStorage.getItem("mso.activeStation") || "mso" } catch { return "mso" }
}

export default useStation
