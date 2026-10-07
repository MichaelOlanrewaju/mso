import React from "react"
import { activeStation } from "../../utils/station"
import { toLocalISO } from "../../utils/dateRange"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

/* Local calendar date, NOT d.toISOString() (UTC) — see utils/dateRange.js. This is what shifted the week and
   month ranges one day early for anyone ahead of UTC. */
export const toISO = toLocalISO

/* Same week/month/year range logic as the main P&L page — Sunday to
   Saturday for week, 1st to actual last day for month, Jan 1 to Dec
   31 for year. Kept identical on purpose, so switching between the
   two P&L pages feels consistent. */
export function rangeFor(mode, offset) {
  const today = new Date()
  if (mode === "week") {
    const ref = new Date(today)
    ref.setDate(ref.getDate() + offset * 7)
    const sun = new Date(ref)
    sun.setDate(sun.getDate() - sun.getDay())
    const sat = new Date(sun)
    sat.setDate(sat.getDate() + 6)
    return {
      from: toISO(sun), to: toISO(sat),
      label: `${sun.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${sat.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    }
  }
  if (mode === "month") {
    const ref = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1)
    const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
    return {
      from: toISO(first), to: toISO(last),
      label: ref.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    }
  }
  return null // "today" mode doesn't use a range
}

export function getAPI(action, extra = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false })
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", action)
  url.searchParams.set("station", activeStation())
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
}

export function postAPI(action, body = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false })
  return fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ action, station: activeStation(), ...body }),
  }).then(r => r.json())
}

export function Card({ children, className = "" }) {
  return <div className={`overflow-hidden rounded-[16px] bg-white shadow-sm ${className}`}>{children}</div>
}

export function Row({ label, value, tone, sub }) {
  const toneClass = tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-navy"
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-surface last:border-b-0">
      <div>
        <div className="text-[12.5px] font-bold text-ink">{label}</div>
        {sub && <div className="text-[10.5px] text-ink-4">{sub}</div>}
      </div>
      <div className={`mono text-[14px] font-extrabold ${toneClass}`}>{value}</div>
    </div>
  )
}
