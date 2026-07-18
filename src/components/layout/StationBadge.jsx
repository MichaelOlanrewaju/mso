import React from "react"
import { useNavigate } from "react-router-dom"
import { getStation } from "../../config/stations"
import { activeStation } from "../../utils/station"

/**
 * Which station am I looking at?
 *
 * This exists because the two stations now render in the same app, and the most
 * dangerous confusion in the whole system is an owner entering M&M's figures
 * while looking at MSO's dashboard. The brand colours make them distinguishable
 * at a glance — navy/cyan vs wine/gold — but colour alone is not enough when
 * someone is tired at 6am, so the station is also named, always, in the header.
 *
 * For owners and `both` users it's a button back to the station picker. For
 * everyone else it's just a label: they only have one station, and there is
 * nothing to switch to.
 */
export default function StationBadge({ canSwitch = false, compact = false }) {
  const navigate = useNavigate()
  const key = activeStation()
  const station = getStation(key)

  const body = (
    <>
      <span
        aria-hidden
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{ background: "var(--brand-accent)" }}
      />
      <span className="truncate font-bold">{compact ? station.short : station.name}</span>
      {canSwitch && <i className="bi bi-chevron-expand ml-0.5 text-[10px] opacity-60" />}
    </>
  )

  const cls =
    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] transition-colors"

  if (!canSwitch) {
    return (
      <span
        className={`${cls} border-white/15 bg-white/10 text-white/80`}
        title={station.legalName}
      >
        {body}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => navigate("/select")}
      aria-label={`Currently viewing ${station.name}. Tap to switch station.`}
      className={`${cls} border-white/20 bg-white/10 text-white/90 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 active:scale-95`}
      title="Switch station"
    >
      {body}
    </button>
  )
}
