import React from "react"
import { useNavigate } from "react-router-dom"
import { getStation, STATION_KEYS } from "../../config/stations"
import { activeStation, setActiveStation } from "../../utils/station"

/**
 * Station switcher for people who oversee more than one site.
 *
 * The topbar already names the current station, but that's a label — easy to
 * miss and not obviously tappable. An owner moving between MSO and M&M several
 * times a day needs the switch to be unmissable, so this is a real control:
 * both stations shown side by side, the active one highlighted in its own brand
 * colour, one tap to move.
 *
 * Switching does a full reload rather than a client-side navigation. Every hook
 * reads the active station when it initialises, and the theme is painted onto
 * <html> — a soft navigation would leave stale data and the wrong colours until
 * something happened to re-render. A reload is a beat slower and unambiguously
 * correct, which is the right trade when the risk is showing one station's
 * figures under another's name.
 */
export default function StationSwitcherCard({ show = true }) {
  const navigate = useNavigate()
  if (!show) return null

  const current = activeStation()

  const switchTo = key => {
    if (key === current) return
    setActiveStation(key)
    try {
      const raw = localStorage.getItem("mso_session")
      if (raw) {
        const record = JSON.parse(raw)
        if (record.user) record.user.station = key
        localStorage.setItem("mso_session", JSON.stringify(record))
      }
    } catch { /* session unavailable — the sessionStorage set above still applies */ }
    window.location.href = `/dashboard/${key}`
  }

  return (
    <div className="mb-4 overflow-hidden rounded-panel border border-border bg-white shadow-card">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span className="text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Viewing station</span>
        <button
          type="button"
          onClick={() => navigate("/select")}
          className="text-[10.5px] font-bold text-ink-4 hover:text-ink-2"
        >
          All stations <i className="bi bi-chevron-right text-[8px]" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        {STATION_KEYS.map(key => {
          const st = getStation(key)
          const active = key === current
          const accent = key === "mso" ? "#179DD0" : "#eaaa18"
          const base = key === "mso" ? "#130656" : "#5f1f33"
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchTo(key)}
              aria-current={active ? "true" : undefined}
              className={`flex items-center gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition-all duration-150 ${
                active ? "text-white" : "border-border bg-white hover:bg-surface active:scale-[0.98]"
              }`}
              style={active ? { background: base, borderColor: base } : undefined}
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: active ? accent : "#CBD5E1" }}
              />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[12.5px] font-extrabold ${active ? "text-white" : "text-ink"}`}>
                  {st.short}
                </span>
                <span className={`block truncate text-[9.5px] ${active ? "text-white/60" : "text-ink-4"}`}>
                  {active ? "Currently viewing" : "Tap to switch"}
                </span>
              </span>
              {active && <i className="bi bi-check-lg flex-shrink-0 text-[13px] text-white/80" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
