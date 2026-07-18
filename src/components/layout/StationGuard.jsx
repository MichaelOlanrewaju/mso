import React, { useEffect } from "react"
import { useParams, Navigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { activeStation, setActiveStation } from "../../utils/station"
import { STATION_KEYS } from "../../config/stations"

/**
 * Keeps the URL, the session, and the API in agreement about which station
 * you're looking at.
 *
 * This is the piece that makes one deployment safe to serve two stations. Every
 * route now carries the station (/dashboard-mrs, /dip-mso), and every hook reads
 * activeStation() to decide which spreadsheet to write to. If those two ever
 * disagree — you're on /dip-mrs but activeStation() still says "mso" — then M&M's
 * tank readings land in MSO's sheet. Silently. And nobody would notice for weeks.
 *
 * So the URL is treated as the source of truth: landing on a station route syncs
 * the session to match, before any child hook fires.
 *
 * It also enforces the boundary. A supervisor assigned to MSO cannot reach M&M's
 * data by typing a URL — they get bounced back to their own station. The server
 * would reject the write anyway (requireRole checks their real record), but there
 * is no reason to show them a page they have no business seeing.
 */
export default function StationGuard({ children }) {
  const { station } = useParams()
  const auth = useAuth({ requireAuth: true })

  const requested = String(station || "").toLowerCase()
  const valid = STATION_KEYS.includes(requested)

  /* Sync BEFORE paint, not in an effect — a child hook firing on its first
     render would otherwise read the previous station and hit the wrong sheet. */
  if (valid && activeStation() !== requested) {
    setActiveStation(requested)
  }

  useEffect(() => {
    if (valid && activeStation() !== requested) setActiveStation(requested)
  }, [valid, requested])

  if (auth.loading) return <div className="min-h-screen bg-pagebg" />
  if (!auth.user) return null

  /* An unknown station in the URL — send them somewhere real rather than
     rendering a page against a spreadsheet that doesn't exist. */
  if (!valid) {
    const own = auth.station && auth.station !== "both" ? auth.station : "mso"
    return <Navigate to={`/dashboard/${own}`} replace />
  }

  /* Someone assigned to one station asking for the other's data. */
  const own = auth.station
  if (own && own !== "both" && own !== requested) {
    return <Navigate to={`/dashboard/${own}`} replace />
  }

  return children
}
