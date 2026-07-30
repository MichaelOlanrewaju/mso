import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { activeStation } from "../utils/station"
import { getStation } from "../config/stations"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useAttendantsPerformance } from "../hooks/useAttendants"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, litres } from "../utils/format"

const PERIODS = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
]

const AVATAR_COLORS = ["var(--brand-accent)", "#06091A", "#16A34A", "#DC2626", "#7C3AED"]
function avatarBg(name) {
  return AVATAR_COLORS[(name || " ").charCodeAt(0) % AVATAR_COLORS.length]
}
function initials(name) {
  return (name || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
}

export default function AttendantPerformancePage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle(`Attendant Performance — ${getStation(activeStation()).name}`)

  const [period, setPeriod] = useState("day")
  const { status, attendants } = useAttendantsPerformance(auth.username, period)

  const totals = attendants.reduce((acc, a) => ({
    litres: acc.litres + a.litresSold,
    sales: acc.sales + a.salesGenerated,
    shortage: acc.shortage + a.shortageThisPeriod,
    outstanding: acc.outstanding + a.outstandingBalance,
  }), { litres: 0, sales: 0, shortage: 0, outstanding: 0 })

  return (
    <div className="min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[100] border-b border-border bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingTop: "max(var(--sat), 12px)" }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-3">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">Attendant Performance</div>
            <div className="text-[10px] text-ink-4">{getStation(activeStation()).name}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        {/* Period toggle */}
        <div className="mb-4 flex gap-1.5 rounded-card border border-border bg-white p-1.5 shadow-card">
          {PERIODS.map(p => (
            <button
              key={p.key} type="button"
              onClick={() => setPeriod(p.key)}
              className={`flex-1 rounded-[9px] py-2 text-[12px] font-bold transition-colors ${
                period === p.key ? "bg-cyan text-white" : "text-ink-3"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {status === "loading" && (
          <div className="py-16 text-center text-[13px] text-ink-4">Loading performance data…</div>
        )}

        {status === "ready" && attendants.length === 0 && (
          <div className="rounded-card border border-dashed border-border bg-white px-4 py-10 text-center">
            <i className="bi bi-bar-chart mb-2 block text-[28px] text-ink-4" />
            <div className="text-[13px] font-semibold text-ink-3">No attendants to show</div>
          </div>
        )}

        {status === "ready" && attendants.length > 0 && (
          <>
            {/* Station-wide totals for this period */}
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-card border border-border bg-white p-3.5 shadow-card">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Total Litres</div>
                <div className="mono mt-1 text-[17px] font-black text-cyan-dark">{litres(totals.litres)}</div>
              </div>
              <div className="rounded-card border border-border bg-white p-3.5 shadow-card">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Total Sales</div>
                <div className="mono mt-1 text-[17px] font-black text-ink">{naira(totals.sales)}</div>
              </div>
              <div className="rounded-card border border-border bg-white p-3.5 shadow-card">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Shortage ({PERIODS.find(p => p.key === period).label})</div>
                <div className="mono mt-1 text-[17px] font-black text-red">{naira(totals.shortage)}</div>
              </div>
              <div className="rounded-card border border-border bg-white p-3.5 shadow-card">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Outstanding (All-Time)</div>
                <div className="mono mt-1 text-[17px] font-black text-red">{naira(totals.outstanding)}</div>
              </div>
            </div>

            {/* Per-attendant leaderboard */}
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">
              By Attendant — ranked by sales
            </div>
            <div className="space-y-2">
              {attendants.map((a, idx) => (
                <button
                  key={a.attendantId}
                  type="button"
                  onClick={() => navigate(`/attendant/${activeStation()}/${a.attendantId}`)}
                  className="flex w-full items-center gap-3 rounded-card border border-border bg-white p-3.5 text-left shadow-card"
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface text-[10.5px] font-bold text-ink-3">
                    {idx + 1}
                  </div>
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                    style={{ background: avatarBg(a.name) }}
                  >
                    {initials(a.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold text-ink">{a.name}</div>
                    <div className="text-[10.5px] text-ink-4">{litres(a.litresSold)} · {a.salesCount} sale{a.salesCount !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="mono text-[13px] font-extrabold text-ink">{naira(a.salesGenerated)}</div>
                    {a.outstandingBalance > 0 && (
                      <div className="mono text-[10.5px] font-bold text-red">{naira(a.outstandingBalance)} owed</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
