import React, { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import Sidebar from "../components/layout/Sidebar"
import Topbar from "../components/layout/Topbar"
import BottomNav from "../components/layout/BottomNav"
import { useToast } from "../components/layout/ToastProvider"
import ProofPhotoViewer from "../components/cashup/ProofPhotoViewer"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { useBankDeposits, canLogBankDeposit } from "../hooks/useBankDeposits"
import { getStation } from "../config/stations"
import { activeStation } from "../utils/station"
import { STATION_KEYS } from "../config/stations"
import { naira, initials, roleLabel } from "../utils/format"

function sanitiseNumeric(raw) {
  const cleaned = String(raw).replace(/[^\d.]/g, "")
  const parts = cleaned.split(".")
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned
}

export default function BankDepositPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const toast = useToast()

  /* Which station THIS PAGE is viewing/logging for — local to this page only.
     Joseph, Lanre, and any GM need to work across both MSO and M&M regardless
     of which single station their account is actually assigned to. Changing
     this does NOT touch their global session station, so every other page
     (Dip Entry, Sales, Cash Reconciliation, etc.) keeps behaving exactly as
     normal for their own assigned station — only this page's view switches. */
  const [station, setStation] = useState(
    auth.station && auth.station !== "both" ? auth.station : "mso"
  )
  usePageTitle(`Bank Deposits — ${getStation(station).name}`)

  const { cashAtHand, totalContributed, totalDeposited, lastDepositDate, deposits, loading, submitting, submitDeposit } = useBankDeposits(station)

  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const inputRef = useRef(null)

  const allowed = canLogBankDeposit(auth.username, auth.role)

  // Not one of the two people who do the bank run — this page has nothing
  // for them. Redirect rather than show a locked/empty screen.
  if (!auth.loading && !allowed) {
    navigate(dashboardPathFor({ role: auth.role, station: auth.station }), { replace: true })
    return null
  }

  const handlePhoto = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) { toast.showToast("Enter an amount", "How much was deposited?", "err"); return }
    if (!photoFile) { toast.showToast("Add a photo", "A photo of the deposit slip is required.", "err"); return }
    const res = await submitDeposit({ amount: amt, photoFile, notes })
    if (res.ok) {
      toast.showToast("Deposit logged", `${naira(amt)} recorded — Cash At Hand updated.`, "ok")
      setAmount(""); setNotes(""); setPhotoFile(null); setPhotoPreview(null)
    } else {
      toast.showToast("Couldn't log deposit", res.error || "Please try again", "err")
    }
  }

  const homePath = dashboardPathFor({ role: auth.role, station: auth.station })

  if (!allowed) return null   // avoids a flash of content before the redirect above fires

  return (
    <div className="flex min-h-screen bg-pagebg">
      <Sidebar
        isOwner={false} isGM={auth.role === "gm"}
        name={auth.name || auth.username} role={roleLabel(auth.role)}
        avatarInitials={initials(auth.name || auth.username)}
        mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
        onLogout={auth.logout} homePath={homePath}
      />
      <div className="flex min-w-0 flex-1 flex-col lg:ml-sidebar">
        <Topbar
          sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(o => !o)}
          loading={loading} onRefresh={() => {}} title="Bank Deposits"
        />

        <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-4">
          {/* Station toggle — local to this page. Defaults to their assigned
              station but lets them check/log for either one. */}
          <div className="mb-3 flex gap-2 rounded-[12px] bg-white p-1.5 shadow-card">
            {STATION_KEYS.map(key => (
              <button
                key={key} type="button" onClick={() => setStation(key)}
                className="flex-1 rounded-[9px] py-2.5 text-[13px] font-bold transition-colors"
                style={station === key
                  ? { background: getStation(key).theme.primary, color: "#fff" }
                  : { background: "transparent", color: "var(--text-muted)" }}
              >
                {getStation(key).short || getStation(key).name}
              </button>
            ))}
          </div>

          {/* Running balance — the number that should match what's physically in the safe */}
          <div className="overflow-hidden rounded-card text-white shadow-card" style={{ background: getStation(station).theme.gradient }}>
            <div className="p-5">
              <div className="text-[10px] font-bold uppercase tracking-[1px] text-white/60">Cash At Hand</div>
              <div className="mono mt-1 text-[34px] font-black tracking-tight">
                {loading ? "…" : naira(cashAtHand || 0)}
              </div>
              <div className="mt-1.5 text-[11.5px] text-white/70">
                What should be physically at the station right now — ask the cashier to count it against this.
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-white/15 border-t border-white/15 bg-black/10">
              <div className="p-3.5">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.6px] text-white/50">Total Collected</div>
                <div className="mono mt-0.5 text-[14px] font-bold">{naira(totalContributed)}</div>
              </div>
              <div className="p-3.5">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.6px] text-white/50">Total Deposited</div>
                <div className="mono mt-0.5 text-[14px] font-bold">{naira(totalDeposited)}</div>
              </div>
            </div>
          </div>
          {lastDepositDate && (
            <div className="mt-2 text-center text-[11px] text-ink-4">Last deposit: {lastDepositDate}</div>
          )}

          {/* Log a new deposit */}
          <div className="mt-5 rounded-card border border-border bg-white p-4 shadow-card">
            <div className="mb-3 text-[13px] font-extrabold text-ink">Log a bank deposit</div>

            <label className="mb-1 block text-[11px] font-bold text-ink-3">Amount deposited</label>
            <input
              type="text" inputMode="decimal" value={amount}
              onChange={e => setAmount(sanitiseNumeric(e.target.value))}
              placeholder="Enter amount"
              className="mb-3 w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[15px] font-bold text-ink outline-none focus:border-[var(--brand-accent)]"
            />

            <label className="mb-1 block text-[11px] font-bold text-ink-3">Deposit slip / bank alert photo</label>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            {photoPreview ? (
              <button type="button" onClick={() => inputRef.current?.click()} className="mb-3 block w-full overflow-hidden rounded-[10px] border border-border">
                <img src={photoPreview} alt="Deposit slip" className="max-h-48 w-full object-contain bg-surface" />
              </button>
            ) : (
              <button type="button" onClick={() => inputRef.current?.click()}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-border bg-surface py-6 text-[13px] font-semibold text-ink-3">
                <i className="bi bi-camera text-[16px]" /> Add photo
              </button>
            )}

            <label className="mb-1 block text-[11px] font-bold text-ink-3">Notes (optional)</label>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. which days this covers"
              className="mb-4 w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-[var(--brand-accent)]"
            />

            <button
              type="button" onClick={handleSubmit} disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-[11px] py-3 text-[14px] font-bold text-white disabled:opacity-60"
              style={{ background: getStation(station).theme.gradientBtn }}
            >
              {submitting ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> : <i className="bi bi-check-lg" />}
              {submitting ? "Saving…" : "Log Deposit"}
            </button>
          </div>

          {/* History */}
          <div className="mt-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.7px] text-ink-4">Deposit History</div>
            {deposits.length === 0 && !loading && (
              <div className="rounded-card border border-border bg-white p-6 text-center text-[13px] text-ink-4">No deposits logged yet.</div>
            )}
            <div className="space-y-2">
              {deposits.map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-card border border-border bg-white p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="mono text-[15px] font-extrabold text-ink">{naira(d.amount)}</div>
                    <div className="text-[11px] text-ink-4">{d.date} · {d.submittedBy}</div>
                    {d.notes && <div className="mt-0.5 text-[11px] text-ink-3">{d.notes}</div>}
                  </div>
                  <ProofPhotoViewer label="View slip" fileId={d.proofFileId} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <BottomNav homePath={homePath} />
      </div>
    </div>
  )
}
