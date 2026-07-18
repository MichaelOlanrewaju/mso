import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"
const SHIFT_TYPES = ["Morning (6am–2pm)", "Afternoon (2pm–10pm)", "Night (10pm–6am)"]

function getAPI(action, extra = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false })
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", action)
  url.searchParams.set("station", activeStation())
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
}

export default function ShiftsPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle("Shifts — MSO Limpid")
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [tab, setTab] = useState("list")
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    shiftType: SHIFT_TYPES[0],
    openTime: "", closeTime: "",
    openReading: "", closeReading: "", notes: "", status: "OPEN"
  })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getAPI("getShifts")
    if (res.ok) setShifts(res.shifts || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  const isSupervisor = auth.role === "supervisor" || auth.role === "cashier"

  const handleSave = async () => {
    setSaving(true); setFeedback(null)
    const res = await getAPI("saveShift", { ...form, openedBy: auth.username, username: auth.username })
    setSaving(false)
    if (res.ok) { setFeedback({ ok: true, text: "Shift saved." }); load(); setTab("list") }
    else setFeedback({ ok: false, text: res.error || "Save failed." })
  }

  const inputCls = "w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-cyan"

  return (
    <div className="min-h-screen bg-pagebg pb-16">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[200] border-b border-border bg-white shadow-sm" style={{ paddingTop: "max(var(--sat),52px)" }}>
        <div className="flex items-center gap-3 px-4 pb-2.5">
          <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">Shifts</div>
            <div className="text-[10px] text-ink-4">{isSupervisor ? "Shift management — MSO Limpid" : "Shift log — view only"}</div>
          </div>
        </div>
        {isSupervisor && (
          <div className="flex border-t border-border">
            {[["list","Shift Log"],["new","Open / Close Shift"]].map(([k,l]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`flex-1 py-2.5 text-[12.5px] font-bold ${tab===k?"border-b-2 border-navy text-navy":"text-ink-4"}`}>{l}</button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        {feedback && (
          <div className={`mb-4 flex items-center gap-2 rounded-[11px] border px-4 py-3 text-[13px] font-semibold ${feedback.ok ? "border-green/20 bg-green-light text-green" : "border-red/20 bg-red-light text-red"}`}>
            <i className={`bi ${feedback.ok ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />
            <span className="flex-1">{feedback.text}</span>
            <button type="button" onClick={() => setFeedback(null)}><i className="bi bi-x-lg text-[11px] opacity-40" /></button>
          </div>
        )}

        {tab === "list" && (
          <>
            {loading && <div className="flex justify-center py-12"><span className="h-6 w-6 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" /></div>}
            {!loading && shifts.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-[16px] bg-white py-14 text-center shadow-sm">
                <i className="bi bi-clock-history text-4xl text-ink-4" />
                <div className="text-[14px] font-bold text-ink">No shifts recorded yet</div>
              </div>
            )}
            <div className="space-y-3">
              {shifts.map((s, i) => (
                <div key={i} className="overflow-hidden rounded-[14px] bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-surface px-4 py-3">
                    <div>
                      <div className="text-[13.5px] font-bold text-ink">{s.ShiftType}</div>
                      <div className="text-[10.5px] text-ink-4">{s.Date} · {s.OpenedBy}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${s.Status==="CLOSED"?"bg-surface text-ink-4":"bg-green-light text-green"}`}>
                      {s.Status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-px bg-border">
                    {[["Open Time",s.OpenTime||"—"],["Close Time",s.CloseTime||"—"],["Pump Reading",s.CloseReading?`${s.OpenReading}→${s.CloseReading}`:"—"]].map(([l,v])=>(
                      <div key={l} className="bg-white px-3 py-2">
                        <div className="text-[9px] font-bold text-ink-4">{l}</div>
                        <div className="text-[12.5px] font-bold text-ink">{v}</div>
                      </div>
                    ))}
                  </div>
                  {s.Notes && <div className="border-t border-surface px-4 py-2 text-[11px] text-ink-4">{s.Notes}</div>}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "new" && isSupervisor && (
          <div className="rounded-[16px] bg-white p-5 shadow-sm space-y-3">
            <div className="text-[13.5px] font-bold text-ink mb-1">Log a Shift</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Date</span>
                <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Status</span>
                <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))} className={inputCls}>
                  <option value="OPEN">Opening shift</option>
                  <option value="CLOSED">Closing shift</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Shift Type</span>
              <select value={form.shiftType} onChange={e => setForm(f=>({...f,shiftType:e.target.value}))} className={inputCls}>
                {SHIFT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Open Time</span>
                <input type="time" value={form.openTime} onChange={e => setForm(f=>({...f,openTime:e.target.value}))} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Close Time</span>
                <input type="time" value={form.closeTime} onChange={e => setForm(f=>({...f,closeTime:e.target.value}))} className={inputCls} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Opening Reading</span>
                <input type="number" inputMode="decimal" placeholder="0" value={form.openReading} onChange={e => setForm(f=>({...f,openReading:e.target.value}))} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Closing Reading</span>
                <input type="number" inputMode="decimal" placeholder="0" value={form.closeReading} onChange={e => setForm(f=>({...f,closeReading:e.target.value}))} className={inputCls} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Handover Notes</span>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes for the next shift…" className={inputCls+" resize-none"} />
            </label>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 text-[14px] font-bold text-white shadow-lift disabled:opacity-60"
              style={{ background:"var(--brand-gradient-btn)" }}>
              {saving ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> : <><i className="bi bi-clock" /> Save Shift</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
