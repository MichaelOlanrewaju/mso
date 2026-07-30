import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { activeStation } from "../utils/station"
import { getStation, pumpsFor } from "../config/stations"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useAttendants, useAttendance } from "../hooks/useAttendants"
import { usePageTitle } from "../hooks/usePageTitle"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function AttendanceInner() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const toast = useToast()
  usePageTitle(`Attendance — ${getStation(activeStation()).name}`)

  const [date, setDate] = useState(todayISO())
  const { status: attStatus, attendants } = useAttendants(auth.username)
  const { status: recStatus, records, saving, markAttendance, refresh } = useAttendance(auth.username, date)
  const pumps = pumpsFor(activeStation()).filter(p => p.product !== "LPG")

  // Local marks, seeded from whatever's already on record for this date —
  // defaults everyone to Present, since that's the common case; the
  // supervisor only needs to tap the exceptions.
  const [marks, setMarks] = useState({})
  const [pumpAllocations, setPumpAllocations] = useState({}) // { attendantId: ["P1","P2"] }
  useEffect(() => {
    if (recStatus !== "ready" || attStatus !== "ready") return
    const seeded = {}
    const seededPumps = {}
    attendants.forEach(a => {
      const existing = records.find(r => r.attendantId === a.attendantId)
      seeded[a.attendantId] = existing ? existing.status : "Present"
      seededPumps[a.attendantId] = existing?.pumps || []
    })
    setMarks(seeded)
    setPumpAllocations(seededPumps)
  }, [recStatus, attStatus, records, attendants])

  const toggle = (attendantId) => {
    setMarks(prev => ({ ...prev, [attendantId]: prev[attendantId] === "Present" ? "Absent" : "Present" }))
  }

  const togglePump = (attendantId, pumpId) => {
    setPumpAllocations(prev => {
      const current = prev[attendantId] || []
      if (current.includes(pumpId)) {
        return { ...prev, [attendantId]: current.filter(p => p !== pumpId) }
      }
      // One attendant working more than two pumps at once isn't realistic —
      // caught here, not just assumed, so a mis-tap doesn't quietly spread
      // one person's tracked litres/sales across too many pumps.
      if (current.length >= 2) return prev
      return { ...prev, [attendantId]: [...current, pumpId] }
    })
  }

  // Same pump picked by two different present attendants the same day —
  // not blocked (a shift handover mid-day is real), but worth flagging so
  // it's a deliberate choice, not an accidental double-tap.
  const pumpConflicts = {}
  Object.keys(pumpAllocations).forEach(aid => {
    if (marks[aid] !== "Present") return
    ;(pumpAllocations[aid] || []).forEach(p => {
      pumpConflicts[p] = (pumpConflicts[p] || 0) + 1
    })
  })

  const handleSubmit = async () => {
    const marksArray = Object.keys(marks).map(attendantId => ({
      attendantId, status: marks[attendantId], pumps: pumpAllocations[attendantId] || [],
    }))
    const result = await markAttendance(marksArray)
    if (!result.ok) {
      toast.showToast("Could not save", result.error || "Please try again", "err")
      return
    }
    toast.showToast("Saved", `Attendance recorded for ${date}`, "ok")
    refresh()
  }

  const presentCount = Object.values(marks).filter(s => s === "Present").length
  const absentCount = Object.values(marks).filter(s => s === "Absent").length

  return (
    <div className="min-h-screen bg-pagebg pb-28">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[100] border-b border-border bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingTop: "max(var(--sat), 12px)" }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-3">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">Attendance</div>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              max={todayISO()}
              className="border-none bg-transparent p-0 text-[10px] text-ink-4 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[540px] px-4 py-4">
        {(attStatus === "loading" || recStatus === "loading") && (
          <div className="py-16 text-center text-[13px] text-ink-4">Loading…</div>
        )}

        {attStatus === "ready" && attendants.length === 0 && (
          <div className="rounded-card border border-dashed border-border bg-white px-4 py-10 text-center">
            <i className="bi bi-people mb-2 block text-[28px] text-ink-4" />
            <div className="text-[13px] font-semibold text-ink-3">No attendants to mark yet</div>
            <button type="button" onClick={() => navigate(`/attendants/${activeStation()}`)}
              className="mt-3 rounded-full bg-cyan px-4 py-2 text-[12.5px] font-bold text-white">
              Add attendants first
            </button>
          </div>
        )}

        {attStatus === "ready" && attendants.length > 0 && (
          <>
            <div className="mb-3 flex gap-2.5">
              <div className="flex-1 rounded-card border border-green/20 bg-green-light px-3.5 py-2.5 text-center">
                <div className="text-[18px] font-black text-green">{presentCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-green">Present</div>
              </div>
              <div className="flex-1 rounded-card border border-red/20 bg-red-light px-3.5 py-2.5 text-center">
                <div className="text-[18px] font-black text-red">{absentCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-red">Absent</div>
              </div>
            </div>

            <div className="space-y-2">
              {attendants.map(a => {
                const isPresent = marks[a.attendantId] !== "Absent"
                const allocated = pumpAllocations[a.attendantId] || []
                return (
                  <div
                    key={a.attendantId}
                    className={`rounded-card border p-3.5 transition-colors ${
                      isPresent ? "border-green/20 bg-white" : "border-red/25 bg-red-light"
                    }`}
                  >
                    <button type="button" onClick={() => toggle(a.attendantId)} className="flex w-full items-center gap-3 text-left">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="truncate text-[14px] font-bold text-ink">{a.name}</div>
                          {a.type === "Trainee" && (
                            <span className="flex-shrink-0 rounded-full bg-amber-light px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-[0.3px] text-amber">
                              Trainee
                            </span>
                          )}
                        </div>
                        {isPresent && allocated.length > 0 && (
                          <div className="mt-0.5 text-[10.5px] text-ink-4">On {allocated.join(", ")}</div>
                        )}
                      </div>
                      <span
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold ${
                          isPresent ? "bg-green text-white" : "bg-red text-white"
                        }`}
                      >
                        <i className={`bi ${isPresent ? "bi-check-circle-fill" : "bi-x-circle-fill"}`} />
                        {isPresent ? "Present" : "Absent"}
                      </span>
                    </button>

                    {/* Pump allocation — only shown for Present attendants.
                        This is what makes litres/sales on their profile
                        derived from a real roster assignment. */}
                    {isPresent && (
                      <div className="mt-3 border-t border-surface pt-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-ink-4">Pump(s) allocated</div>
                          <div className="text-[10px] text-ink-4">{allocated.length}/2</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {pumps.map(p => {
                            const isChecked = allocated.includes(p.id)
                            const hasConflict = pumpConflicts[p.id] > 1
                            const atCap = !isChecked && allocated.length >= 2
                            return (
                              <button
                                key={p.id} type="button"
                                disabled={atCap}
                                onClick={() => togglePump(a.attendantId, p.id)}
                                className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                                  isChecked
                                    ? hasConflict ? "border-amber bg-amber-light text-amber" : "border-cyan bg-cyan-light text-cyan-dark"
                                    : atCap ? "border-border bg-surface text-ink-4/50" : "border-border bg-surface text-ink-3"
                                }`}
                              >
                                {p.id}
                                {isChecked && hasConflict && <i className="bi bi-exclamation-triangle-fill ml-1" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {attStatus === "ready" && attendants.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-white px-4 py-3" style={{ paddingBottom: "max(var(--sab), 12px)" }}>
          <div className="mx-auto max-w-[540px]">
            <button
              type="button" onClick={handleSubmit} disabled={saving}
              className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[13px] bg-green text-[14.5px] font-extrabold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Attendance"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AttendancePage() {
  return (
    <ToastProvider>
      <AttendanceInner />
    </ToastProvider>
  )
}
