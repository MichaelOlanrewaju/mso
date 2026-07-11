import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

function getAPI(action, extra = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false })
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", action)
  url.searchParams.set("station", STATION_KEY)
  Object.entries(extra).forEach(([k, v]) => { if (v) url.searchParams.set(k, v) })
  return fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
}

// Actions get a small color/icon treatment so a long log is scannable —
// grouped loosely by what kind of thing happened, not exhaustive.
function actionStyle(action) {
  const a = action.toUpperCase()
  if (a.includes("LOGIN")) return { icon: "bi-box-arrow-in-right", color: "#64748B" }
  if (a.includes("APPROV") || a.includes("PRICED")) return { icon: "bi-check-circle", color: "#16A34A" }
  if (a.includes("REJECT") || a.includes("FAIL")) return { icon: "bi-x-circle", color: "#DC2626" }
  if (a.includes("EDIT_REQUEST")) return { icon: "bi-pencil-square", color: "#7C3AED" }
  if (a.includes("SHORTAGE")) return { icon: "bi-exclamation-triangle", color: "#179DD0" }
  if (a.includes("SAVE") || a.includes("UPDATE")) return { icon: "bi-cloud-check", color: "#179DD0" }
  return { icon: "bi-info-circle", color: "#64748B" }
}

function timeLabel(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const datePart = sameDay ? "Today" : d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })
  const timePart = d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true })
  return `${datePart} · ${timePart}`
}

export default function ActivityLogPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle("Activity Log — MSO Limpid")
  const [entries, setEntries] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState("")
  const [actionFilterSel, setActionFilterSel] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getAPI("getActivityLog", { date: dateFilter, actionFilter: actionFilterSel, username: auth.username, token: getToken() })
    if (res.ok) { setEntries(res.entries || []); setActions(res.actions || []) }
    setLoading(false)
  }, [dateFilter, actionFilterSel, auth.username])

  useEffect(() => { load() }, [load])

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  // Read-only audit tool — Owner/GM only, same boundary as everything else
  // that isn't a floor-operations task.
  const canView = auth.isOwner || auth.isGM || auth.role === "owner" || auth.role === "gm"
  if (!canView) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-pagebg px-6 text-center">
        <i className="bi bi-shield-lock text-4xl text-ink-4" />
        <div className="text-[14px] font-bold text-ink">Owner/GM only</div>
        <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="mt-2 rounded-[10px] bg-navy px-4 py-2 text-[12.5px] font-bold text-white">
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[200] border-b border-border bg-white shadow-sm" style={{ paddingTop: "max(var(--sat),52px)" }}>
        <div className="flex items-center gap-3 px-4 pb-2.5">
          <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">Activity Log</div>
            <div className="text-[10px] text-ink-4">Who did what, when — most recent first</div>
          </div>
          <button type="button" onClick={load} className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2">
            <i className={`bi bi-arrow-clockwise ${loading ? "animate-spin-fast" : ""}`} />
          </button>
        </div>
        <div className="flex gap-2 border-t border-border px-4 py-2.5">
          <input
            type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="flex-1 rounded-[9px] border border-border bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-cyan [color-scheme:light]"
          />
          <select
            value={actionFilterSel} onChange={e => setActionFilterSel(e.target.value)}
            className="flex-1 rounded-[9px] border border-border bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-cyan"
          >
            <option value="">All actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {(dateFilter || actionFilterSel) && (
            <button type="button" onClick={() => { setDateFilter(""); setActionFilterSel("") }}
              className="rounded-[9px] border border-border bg-white px-2.5 text-[11px] font-bold text-ink-3">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        {loading && (
          <div className="flex justify-center py-14"><span className="h-6 w-6 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" /></div>
        )}
        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-[16px] bg-white py-14 text-center shadow-sm">
            <i className="bi bi-journal-text text-4xl text-ink-4" />
            <div className="text-[14px] font-bold text-ink">No activity found</div>
            <div className="text-[12px] text-ink-4">Try clearing the filters above</div>
          </div>
        )}
        {!loading && entries.length > 0 && (
          <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-sm">
            {entries.map((e, i) => {
              const style = actionStyle(e.action)
              return (
                <div key={i} className="flex items-start gap-3 border-b border-surface px-4 py-3 last:border-b-0">
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${style.color}18` }}>
                    <i className={`bi ${style.icon} text-[12px]`} style={{ color: style.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-extrabold text-ink">{e.action}</span>
                      <span className="flex-shrink-0 text-[10px] text-ink-4">{timeLabel(e.timestamp)}</span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-3">{e.username || "—"}</div>
                    {e.detail && <div className="mt-1 break-words text-[11.5px] text-ink-4">{e.detail}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {!loading && entries.length >= 200 && (
          <div className="mt-3 text-center text-[11px] text-ink-4">Showing the most recent 200 — narrow with a date or action filter to see more.</div>
        )}
      </div>
    </div>
  )
}
