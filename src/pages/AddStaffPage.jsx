import React, { useState } from "react"
import { activeStation } from "../utils/station"
import { getStation } from "../config/stations"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useStaff } from "../hooks/usePayroll"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira } from "../utils/format"

const ROLES = [
  { value: "supervisor", label: "Supervisor" },
  { value: "cashier",    label: "Cashier" },
  { value: "attendant",  label: "Attendant" },
  { value: "gm",         label: "General Manager" },
]

const ROLE_LABELS = { ceo: "CEO", owner: "CEO", gm: "GM", supervisor: "Supervisor", cashier: "Cashier", attendant: "Attendant" }

const AVATAR_COLORS = ["var(--brand-accent)","#06091A","#16A34A","var(--brand-accent)","#DC2626","#7C3AED"]
function avatarBg(name) {
  return AVATAR_COLORS[(name || " ").charCodeAt(0) % AVATAR_COLORS.length]
}
function initials(name) {
  return (name || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold text-ink-3">{label}</span>
        {hint && <span className="text-[10px] text-ink-4">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export default function AddStaffPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const { staff, saving, saveStaffMember, inviteStaff, addPayrollOnly, deleteStaff } = useStaff(auth.username)
  usePageTitle(`Add Staff — ${getStation(activeStation()).name}`)

  /* Two distinct ways to add someone, confirmed directly as separate
     needs: "invite" creates a real login account and emails
     credentials — for staff who'll actually use the app. "payrollOnly"
     just adds a name/role/salary to the payroll list, no account, no
     email — for an Attendant or anyone else who needs to be paid but
     doesn't need app access. Username/email fields only make sense
     for "invite"; payrollOnly generates its own username internally. */
  const [addMode, setAddMode] = useState("invite") // "invite" | "payrollOnly"
  const [username, setUsername]       = useState("")
  const [name, setName]               = useState("")
  const [email, setEmail]             = useState("")
  const [role, setRole]               = useState("supervisor")
  const [basicSalary, setBasicSalary] = useState("")
  const [phone, setPhone]             = useState("")
  const [feedback, setFeedback]       = useState(null)
  const [confirmDeleteStaff, setConfirmDeleteStaff] = useState(null) // the staff object pending delete confirmation
  const [deleting, setDeleting] = useState(false)

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  if (!auth.isGM && !auth.isOwner) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-pagebg px-6 text-center">
        <i className="bi bi-lock text-3xl text-ink-4" />
        <div className="text-[14px] font-bold text-ink">Access restricted</div>
        <div className="text-[12.5px] text-ink-4">Only GM and Owner can add staff.</div>
        <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="mt-2 rounded-[9px] border border-border bg-white px-4 py-2 text-[12.5px] font-bold text-ink-2">
          Back to Dashboard
        </button>
      </div>
    )
  }

  const isExisting = staff.some(s => s.username === username.trim().toLowerCase())

  const handleConfirmDelete = async () => {
    if (!confirmDeleteStaff) return
    setDeleting(true)
    const res = await deleteStaff(confirmDeleteStaff.username)
    setDeleting(false)
    setConfirmDeleteStaff(null)
    setFeedback({ type: res.ok ? "success" : "error", text: res.ok ? res.message : (res.error || "Couldn't remove.") })
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setFeedback(null)
    const n = name.trim()
    if (!n) { setFeedback({ type: "error", text: "Full name is required." }); return }

    if (addMode === "payrollOnly") {
      // If username is already in state, this is an existing
      // payroll-only entry being edited (tapped from the roster below)
      // — update it in place with saveStaffMember, the same function
      // "invite" mode's existing-staff path already uses. Only create
      // a brand new entry via addPayrollOnly when there's genuinely no
      // username yet.
      const existingUsername = username.trim().toLowerCase()
      const res = existingUsername
        ? await saveStaffMember({ username: existingUsername, name: n, role, phone, basicSalary: Number(basicSalary) || 0 })
        : await addPayrollOnly({ name: n, role, phone, basicSalary: Number(basicSalary) || 0 })
      if (res.ok) {
        setFeedback({ type: "success", text: existingUsername ? `${n}'s record has been updated.` : `${n} added to payroll. No login account was created.` })
        setUsername(""); setName(""); setEmail(""); setBasicSalary(""); setPhone("")
      } else {
        setFeedback({ type: "error", text: res.error || "Couldn't save." })
      }
      return
    }

    const u = username.trim().toLowerCase()
    const em = email.trim().toLowerCase()
    if (!u) { setFeedback({ type: "error", text: "Username is required." }); return }
    if (!isExisting && !em) { setFeedback({ type: "error", text: "Email is required to invite a new staff member — they'll receive their login credentials there." }); return }

    let res
    if (isExisting) {
      res = await saveStaffMember({ username: u, name: n, role, phone, basicSalary: Number(basicSalary) || 0 })
      if (res.ok) {
        setFeedback({ type: "success", text: `${n}'s record has been updated.` })
        setUsername(""); setName(""); setEmail(""); setBasicSalary(""); setPhone("")
      } else {
        setFeedback({ type: "error", text: res.error || "Couldn't update staff member." })
      }
    } else {
      res = await inviteStaff({ username: u, name: n, email: em, role, phone, basicSalary: Number(basicSalary) || 0 })
      if (res.ok) {
        setFeedback({ type: "success", text: `${n} has been invited! Login credentials sent to ${em}.` })
        setUsername(""); setName(""); setEmail(""); setBasicSalary(""); setPhone("")
      } else {
        setFeedback({ type: "error", text: res.error || "Couldn't send invite." })
      }
    }
  }

  const inputCls = "w-full rounded-[10px] border border-border px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-cyan focus:ring-0"

  return (
    <div className="min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />

      <div className="sticky top-0 z-[200] flex items-center gap-3 border-b border-border bg-white px-4 pb-2.5 shadow-[0_1px_4px_rgba(0,0,0,.04)]"
        style={{ paddingTop: "max(var(--sat), 52px)" }}>
        <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2">
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-extrabold text-ink">Add Staff</div>
          <div className="text-[10px] text-ink-4">{getStation(activeStation()).legalName}</div>
        </div>
      </div>

      <div className="mx-auto max-w-[520px] px-4 py-5">

        {/* Live preview card */}
        {(name || username) && (
          <div className="mb-5 flex items-center gap-3 rounded-[14px] border border-border bg-white px-4 py-3.5 shadow-sm">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white text-[14px] font-extrabold"
              style={{ background: avatarBg(name) }}>
              {initials(name || username)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold text-ink">{name || "—"}</div>
              <div className="text-[11px] text-ink-4">
                {addMode === "payrollOnly" ? "" : `@${username || "—"} · `}{ROLE_LABELS[role] || role}
                {basicSalary ? ` · ₦${Number(basicSalary).toLocaleString("en-NG")}` : ""}
              </div>
            </div>
            {isExisting && (
              <span className="rounded-full bg-amber-light px-2.5 py-1 text-[10.5px] font-bold text-amber">Existing</span>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-[14px] border border-border bg-white p-5 shadow-sm">

          {/* Mode toggle — confirmed directly these are two genuinely
              separate needs, not variations of the same form. Switching
              modes doesn't touch Name/Role/Salary/Phone, only whether
              Username/Email show at all. */}
          <div className="mb-4 flex gap-2">
            {[["invite", "Invite (App Login)"], ["payrollOnly", "Add to Payroll Only"]].map(([m, l]) => (
              <button key={m} type="button" onClick={() => { setAddMode(m); setUsername(""); setFeedback(null) }}
                className={`flex-1 rounded-[9px] py-2.5 text-[12px] font-bold transition ${
                  addMode === m ? "bg-navy text-white" : "border border-border bg-white text-ink-3"
                }`}>
                {l}
              </button>
            ))}
          </div>

          <div className="mb-4 text-[13px] font-bold text-ink">
            {addMode === "payrollOnly"
              ? (username ? "Update payroll-only entry" : "Add someone to the payroll list — no app access")
              : isExisting ? "Update existing staff member" : "Invite a new staff member"}
          </div>

          {addMode === "payrollOnly" ? (
            <Field label="Full Name">
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Tobi Adewale" className={inputCls} />
            </Field>
          ) : (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <Field label="Username" hint="lowercase, no spaces">
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. tobi" className={inputCls} />
              </Field>
              <Field label="Full Name">
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Tobi Adewale" className={inputCls} />
              </Field>
            </div>
          )}

          {addMode === "invite" && !isExisting && (
            <Field label="Email address" hint="required for new staff">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tobi@example.com" className={inputCls} />
              <div className="mt-1 text-[10.5px] text-ink-4">
                Login credentials will be emailed automatically.
              </div>
            </Field>
          )}

          <div className="mb-3 grid grid-cols-2 gap-3">
            <Field label="Role">
              <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Basic Salary (₦)">
              <input type="number" inputMode="decimal" min="0" step="1"
                value={basicSalary} onChange={e => setBasicSalary(e.target.value)}
                placeholder="0" className={inputCls + " font-bold"} />
            </Field>
          </div>

          <Field label="Phone number" hint="optional">
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="08012345678" className={inputCls} />
          </Field>

          {feedback && (
            <div className={`mb-4 flex items-start gap-2 rounded-[10px] px-3.5 py-3 text-[12.5px] font-semibold ${
              feedback.type === "success" ? "bg-green-light text-green" : "bg-red-light text-red"}`}>
              <i className={`bi mt-0.5 flex-shrink-0 ${feedback.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />
              {feedback.text}
            </div>
          )}

          <button type="submit" disabled={saving}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[11px] bg-navy text-[13.5px] font-bold text-white shadow-lift disabled:opacity-60">
            {saving
              ? <><span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> Saving…</>
              : addMode === "payrollOnly"
                ? (username
                    ? <><i className="bi bi-pencil-square" /> Update Payroll Entry</>
                    : <><i className="bi bi-person-plus" /> Add to Payroll</>)
                : isExisting
                  ? <><i className="bi bi-pencil-square" /> Update Staff Member</>
                  : <><i className="bi bi-envelope-plus" /> Send Invite</>
            }
          </button>
        </form>

        {/* Staff roster below form */}
        {staff.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[1px] text-ink-4">
              Current Staff ({staff.length})
            </div>
            <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-sm">
              {staff.map((s, idx) => (
                <div key={s.username}
                  className={`flex w-full items-center gap-3 px-4 py-3 ${idx < staff.length - 1 ? "border-b border-surface" : ""}`}>
                  <button type="button"
                    onClick={() => {
                      const staffHasLogin = s.hasLogin !== false
                      setAddMode(staffHasLogin ? "invite" : "payrollOnly")
                      // Username is kept in state either way — needed to
                      // update the right row — just not shown in the
                      // payrollOnly form, since there's nothing for GM to
                      // meaningfully edit there (it was auto-generated).
                      setUsername(s.username)
                      setName(s.name); setRole(s.role); setPhone(s.phone || "")
                      setBasicSalary(String(s.basicSalary || "")); setEmail(s.email || ""); setFeedback(null)
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                      style={{ background: avatarBg(s.name) }}>
                      {initials(s.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-ink">{s.name}</div>
                      <div className="text-[10.5px] capitalize text-ink-4">{ROLE_LABELS[s.role] || s.role}{s.email ? ` · ${s.email}` : ""}</div>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                      <div className="mono text-[12px] font-bold text-ink-2">{naira(s.basicSalary)}</div>
                      <div className="text-[9.5px] text-cyan-dark">tap to edit</div>
                    </div>
                  </button>
                  {/* Confirmed directly: GM/CEO needed a real way to remove
                      a mistaken entry themselves, in-app — a separate,
                      distinct action from tap-to-edit, with a confirmation
                      step since this can't be undone. */}
                  <button type="button" onClick={() => setConfirmDeleteStaff(s)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] border border-red/20 bg-red-light text-red">
                    <i className="bi bi-trash3 text-[12px]" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirmDeleteStaff && (
        <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setConfirmDeleteStaff(null)}>
          <div className="w-full max-w-[380px] rounded-t-[22px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[20px]"
            onClick={e => e.stopPropagation()}>
            <div className="mb-1 flex items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill text-[16px] text-red" />
              <div className="text-[15px] font-extrabold text-ink">Remove from Payroll?</div>
            </div>
            <div className="mb-4 text-[13px] leading-relaxed text-ink-3">
              {confirmDeleteStaff.name} will be removed from the payroll roster. This can't be undone — any Payroll rows already submitted under their name are left as-is.
            </div>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setConfirmDeleteStaff(null)} disabled={deleting}
                className="flex-1 rounded-[11px] border border-border py-3 text-[13px] font-bold text-ink-3">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmDelete} disabled={deleting}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-red py-3 text-[13px] font-bold text-white disabled:opacity-60">
                {deleting ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
