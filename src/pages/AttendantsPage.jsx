import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { activeStation } from "../utils/station"
import { getStation } from "../config/stations"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useAttendants } from "../hooks/useAttendants"
import { usePageTitle } from "../hooks/usePageTitle"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"

const AVATAR_COLORS = ["var(--brand-accent)", "#06091A", "#16A34A", "#DC2626", "#7C3AED"]
function avatarBg(name) {
  return AVATAR_COLORS[(name || " ").charCodeAt(0) % AVATAR_COLORS.length]
}
function initials(name) {
  return (name || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
}

/* These are TRACKED categories for people in the Attendant system — not
   the same as actual Staff accounts with login access (which live in a
   completely separate part of the app). A "Supervisor" or "Cashier" here
   just means someone whose attendance/performance the business wants
   tracked this way, whether or not they also happen to have a real login
   elsewhere. */
const ATTENDANT_TYPES = ["Pump Attendant", "Trainee", "Supervisor", "Cashier", "Truck Driver", "Security", "Cleaner", "Other Staff"]

function AttendantForm({ editing, onSave, onCancel, saving }) {
  const [name, setName] = useState(editing?.name || "")
  const [phone, setPhone] = useState(editing?.phone || "")
  const [status, setStatus] = useState(editing?.status || "active")
  const [type, setType] = useState(editing?.type || "Pump Attendant")

  return (
    <div className="mb-4 rounded-card border border-border bg-white p-4 shadow-card">
      <div className="mb-3 text-[13px] font-extrabold text-ink">{editing ? "Edit Attendant" : "Add New Attendant"}</div>
      <div className="mb-3">
        <div className="mb-1 text-[11px] font-semibold text-ink-3">Full Name</div>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Baba Ibeji"
          className="w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-cyan focus:bg-white"
        />
      </div>
      <div className="mb-3">
        <div className="mb-1 text-[11px] font-semibold text-ink-3">Role</div>
        <select
          value={type} onChange={e => setType(e.target.value)}
          className="w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-[14px] font-semibold text-ink outline-none focus:border-cyan focus:bg-white"
        >
          {ATTENDANT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="mb-3">
        <div className="mb-1 text-[11px] font-semibold text-ink-3">Phone (optional)</div>
        <input
          type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="080..."
          className="w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-cyan focus:bg-white"
        />
      </div>
      {editing && (
        <div className="mb-3">
          <div className="mb-1 text-[11px] font-semibold text-ink-3">Status</div>
          <div className="flex gap-2">
            {["active", "inactive"].map(s => (
              <button
                key={s} type="button" onClick={() => setStatus(s)}
                className={`flex-1 rounded-[10px] border-[1.5px] py-2.5 text-[13px] font-bold capitalize transition-colors ${
                  status === s ? "border-cyan bg-cyan-light text-cyan-dark" : "border-border bg-surface text-ink-3"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-[10px] border border-border py-2.5 text-[13px] font-semibold text-ink-3">
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim() || saving}
          onClick={() => onSave({ attendantId: editing?.attendantId, name: name.trim(), phone: phone.trim(), status, type })}
          className="flex-1 rounded-[10px] bg-green py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : editing ? "Save Changes" : "Add Attendant"}
        </button>
      </div>
    </div>
  )
}

function AttendantsInner() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const toast = useToast()
  usePageTitle(`Attendants — ${getStation(activeStation()).name}`)

  const { status, attendants, saving, saveAttendant } = useAttendants(auth.username)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const canManage = ["ceo", "owner", "gm", "supervisor"].includes(auth.role)

  const handleSave = async (attendant) => {
    const result = await saveAttendant(attendant)
    if (!result.ok) {
      toast.showToast("Could not save", result.error || "Please try again", "err")
      return
    }
    toast.showToast("Saved", editing ? "Attendant updated" : "Attendant added", "ok")
    setShowForm(false)
    setEditing(null)
  }

  return (
    <div className="min-h-screen bg-pagebg pb-8">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[100] flex items-center gap-3 border-b border-border bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingTop: "max(var(--sat), 12px)" }}>
        <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-3">
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-extrabold text-ink">Attendants</div>
          <div className="text-[10px] text-ink-4">{getStation(activeStation()).name}</div>
        </div>
        {canManage && !showForm && (
          <button type="button" onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex h-9 items-center gap-1.5 rounded-full bg-cyan px-3.5 text-[12.5px] font-bold text-white">
            <i className="bi bi-plus-lg" /> Add
          </button>
        )}
      </div>

      <div className="mx-auto max-w-[540px] px-4 py-4">
        {showForm && (
          <AttendantForm
            editing={editing}
            saving={saving}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        )}

        {status === "loading" && (
          <div className="py-16 text-center text-[13px] text-ink-4">Loading attendants…</div>
        )}

        {status === "ready" && attendants.length === 0 && !showForm && (
          <div className="rounded-card border border-dashed border-border bg-white px-4 py-10 text-center">
            <i className="bi bi-people mb-2 block text-[28px] text-ink-4" />
            <div className="text-[13px] font-semibold text-ink-3">No attendants added yet</div>
            {canManage && <div className="mt-1 text-[11.5px] text-ink-4">Tap "Add" to create the first one</div>}
          </div>
        )}

        {status === "ready" && attendants.length > 0 && (
          <div className="space-y-2">
            {attendants.map(a => (
              <div
                key={a.attendantId}
                onClick={() => navigate(`/attendant/${activeStation()}/${a.attendantId}`)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-card border border-border bg-white p-3.5 text-left shadow-card"
              >
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: avatarBg(a.name) }}
                >
                  {initials(a.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[14px] font-bold text-ink">{a.name}</div>
                    {a.type === "Trainee" && (
                      <span className="flex-shrink-0 rounded-full bg-amber-light px-2 py-[1px] text-[9.5px] font-bold uppercase tracking-[0.3px] text-amber">
                        Trainee
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-4">{a.type || "Pump Attendant"} · {a.phone || "No phone"}</div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setEditing(a); setShowForm(true) }}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border text-ink-3"
                  >
                    <i className="bi bi-pencil text-[12px]" />
                  </button>
                )}
                <i className="bi bi-chevron-right text-ink-4" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AttendantsPage() {
  return (
    <ToastProvider>
      <AttendantsInner />
    </ToastProvider>
  )
}
