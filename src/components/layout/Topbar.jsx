import React from "react"
import { useNavigate } from "react-router-dom"
import { getStation } from "../../config/stations"
import { activeStation } from "../../utils/station"
import { useClock } from "../../hooks/useClock"

export default function Topbar({ sidebarOpen, onToggleSidebar, loading, onRefresh, title = "Dashboard" }) {
  const { time, date } = useClock()
  const navigate = useNavigate()
  const station = getStation(activeStation())

  let canSwitchStation = false
  try {
    const raw = localStorage.getItem("mso_session")
    if (raw) {
      const u = JSON.parse(raw).user || {}
      const st = String(u.station || "").toLowerCase()
      const role = String(u.role || "").toLowerCase()
      canSwitchStation = st === "both" || role === "owner" || role === "ceo"
    }
  } catch {}

  return (
    <header className="sticky top-0 z-[900] border-b border-border bg-white px-3 pb-3 pt-[max(var(--sat),10px)] md:px-6 md:py-3">
      <div className="mx-auto flex min-h-[46px] max-w-[1480px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px] border border-border bg-surface text-ink-2 transition hover:border-cyan/30 hover:bg-cyan-light hover:text-cyan-dark lg:hidden"
          >
            <i className={`bi ${sidebarOpen ? "bi-x-lg" : "bi-list"} text-[17px]`} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-extrabold tracking-[-.025em] text-ink md:text-[17px]">{title}</h1>
              <span className="hidden rounded-full bg-surface px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[.12em] text-ink-4 sm:inline-flex">Operations</span>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[9.5px] font-semibold text-ink-4 md:text-[10px]">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green" />
              {canSwitchStation ? (
                <button
                  type="button"
                  onClick={() => navigate("/select")}
                  className="truncate rounded-md px-1 font-bold text-brand transition hover:bg-brand-accent-light"
                  aria-label={`Viewing ${station.name}. Tap to switch station.`}
                >
                  {station.name} <i className="bi bi-chevron-down ml-0.5 text-[8px]" />
                </button>
              ) : (
                <span className="truncate font-bold text-brand">{station.name}</span>
              )}
              <span className="text-border">•</span>
              <span className="hidden truncate sm:inline">{date}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5 md:gap-2">
          {loading && (
            <div className="hidden items-center gap-1.5 rounded-full bg-cyan-light px-2.5 py-1.5 text-[10px] font-bold text-cyan-dark sm:flex">
              <span className="h-2.5 w-2.5 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
              Syncing
            </div>
          )}

          <div className="hidden items-center gap-1.5 rounded-full border border-green/15 bg-green-light px-2.5 py-1.5 text-[10px] font-extrabold text-green sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" />
            LIVE
          </div>

          <div className="mono hidden rounded-[9px] border border-border bg-surface px-2.5 py-1.5 text-[10px] font-semibold text-ink-2 lg:block">
            {time}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            title="Refresh data"
            aria-label="Refresh data"
            className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-white text-ink-3 transition hover:border-cyan/30 hover:bg-cyan-light hover:text-cyan-dark"
          >
            <i className={`bi bi-arrow-clockwise text-[15px] ${loading ? "animate-spin-fast" : ""}`} />
          </button>

          <button
            type="button"
            title="Notifications"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-white text-ink-3 transition hover:border-cyan/30 hover:bg-cyan-light hover:text-cyan-dark"
          >
            <i className="bi bi-bell text-[15px]" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red ring-2 ring-white" />
          </button>
        </div>
      </div>
      <div className={`pulse-line absolute bottom-0 left-0 right-0 h-px transition-opacity duration-500 ${loading ? "opacity-100" : "opacity-0"}`} />
    </header>
  )
}
