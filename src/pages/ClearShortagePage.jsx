import React, { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { activeStation } from "../utils/station"
import { getStation } from "../config/stations"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useAttendants } from "../hooks/useAttendants"
import { useShortageClearance } from "../hooks/useShortageClearance"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira } from "../utils/format"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"
import ConfirmSubmitModal from "../components/ui/ConfirmSubmitModal"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function ClearShortageInner() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const toast = useToast()
  usePageTitle(`Clear Shortage — ${getStation(activeStation()).name}`)

  const { attendants } = useAttendants(auth.username)
  const { uploading, uploadReceipt, receiptFileId, setReceiptFileId, saving, clearShortage } = useShortageClearance(auth.username)

  const [date, setDate] = useState(todayISO())
  const [attendantId, setAttendantId] = useState("")
  const [amountPaid, setAmountPaid] = useState("")
  const [notes, setNotes] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const fileInputRef = useRef(null)

  const canClear = ["ceo", "owner", "gm", "supervisor"].includes(auth.role)
  const selectedAttendant = attendants.find(a => a.attendantId === attendantId)

  if (!canClear) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-pagebg px-6 text-center">
        <i className="bi bi-lock text-[28px] text-ink-4" />
        <div className="text-[13px] font-semibold text-ink-3">Only supervisors and above can clear shortages.</div>
        <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="rounded-full bg-cyan px-4 py-2 text-[12.5px] font-bold text-white">
          Back
        </button>
      </div>
    )
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await uploadReceipt(file)
    if (!result.ok) {
      toast.showToast("Upload failed", result.error || "Please try again", "err")
    }
  }

  const handleSubmit = async () => {
    setConfirmOpen(false)
    const result = await clearShortage({ date, attendantId, amountPaid, notes })
    if (!result.ok) {
      toast.showToast("Could not save", result.error || "Please try again", "err")
      return
    }
    toast.showToast("Cleared", `₦${Number(amountPaid).toLocaleString()} recorded and added to Cash At Hand`, "ok")
    setAttendantId("")
    setAmountPaid("")
    setNotes("")
    if (fileInputRef.current) fileInputRef.current.value = ""
    setTimeout(() => navigate(dashboardPathFor({ role: auth.role, station: auth.station })), 1400)
  }

  const canSubmit = attendantId && Number(amountPaid) > 0 && receiptFileId && !saving && !uploading

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
            <div className="text-[16px] font-extrabold text-ink">Clear Shortage</div>
            <div className="text-[10px] text-ink-4">{getStation(activeStation()).name}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[520px] px-4 py-4">
        {/* What this actually does — the linked-transaction explanation, so
            whoever's submitting understands this isn't just a log entry. */}
        <div className="mb-4 rounded-card border border-cyan/20 bg-cyan-light px-3.5 py-3 text-[11.5px] leading-snug text-cyan-dark">
          <i className="bi bi-info-circle-fill mr-1" /> This reduces the attendant's outstanding shortage balance <strong>and</strong> adds this amount to Cash At Hand — that repaid money is real cash the cashier now holds.
        </div>

        <div className="rounded-card border border-border bg-white p-4 shadow-card">
          <div className="mb-3">
            <div className="mb-1 text-[11px] font-semibold text-ink-3">Date</div>
            <input
              type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)}
              className="w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-cyan focus:bg-white"
            />
          </div>

          <div className="mb-3">
            <div className="mb-1 text-[11px] font-semibold text-ink-3">Attendant</div>
            <select
              value={attendantId} onChange={e => setAttendantId(e.target.value)}
              className="w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-[14px] font-semibold text-ink outline-none focus:border-cyan focus:bg-white"
            >
              <option value="">Select attendant…</option>
              {attendants.map(a => (
                <option key={a.attendantId} value={a.attendantId}>{a.name}</option>
              ))}
            </select>
            {selectedAttendant && (
              <button
                type="button"
                onClick={() => navigate(`/attendant/${activeStation()}/${attendantId}`)}
                className="mt-1.5 text-[11px] font-semibold text-cyan-dark underline"
              >
                View {selectedAttendant.name}'s full balance
              </button>
            )}
          </div>

          <div className="mb-3">
            <div className="mb-1 text-[11px] font-semibold text-ink-3">Amount Paid (₦)</div>
            <input
              type="number" inputMode="decimal" min="0" step="1" value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              placeholder="0"
              className="w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-right font-mono text-[18px] font-extrabold text-ink outline-none focus:border-cyan focus:bg-white"
            />
          </div>

          <div className="mb-3">
            <div className="mb-1 text-[11px] font-semibold text-ink-3">Receipt Photo <span className="text-red">(required)</span></div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" id="receipt-upload" />
            <label
              htmlFor="receipt-upload"
              className={`flex h-[100px] w-full cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] border-dashed text-[12.5px] font-semibold ${
                receiptFileId ? "border-green/40 bg-green-light text-green" : "border-border bg-surface text-ink-3"
              }`}
            >
              {uploading ? (
                "Uploading…"
              ) : receiptFileId ? (
                <span className="flex items-center gap-1.5"><i className="bi bi-check-circle-fill" /> Receipt uploaded — tap to replace</span>
              ) : (
                <span className="flex items-center gap-1.5"><i className="bi bi-camera-fill" /> Tap to take/upload receipt photo</span>
              )}
            </label>
          </div>

          <div className="mb-4">
            <div className="mb-1 text-[11px] font-semibold text-ink-3">Notes (optional)</div>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any additional context"
              className="w-full resize-none rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-cyan focus:bg-white"
            />
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => setConfirmOpen(true)}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[13px] bg-green text-[14.5px] font-extrabold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Record Clearance"}
          </button>
        </div>
      </div>

      <ConfirmSubmitModal
        open={confirmOpen}
        title="Confirm Shortage Clearance"
        subtitle={`Review before saving — ${date}`}
        rows={[
          { label: "Attendant", value: selectedAttendant?.name || "—" },
          { label: "Amount Paid", value: naira(Number(amountPaid) || 0) },
          { label: "⚠ This will do", value: "Reduce balance + add to Cash At Hand", warn: true },
        ]}
        onConfirm={handleSubmit}
        onCancel={() => setConfirmOpen(false)}
        confirming={saving}
      />
    </div>
  )
}

export default function ClearShortagePage() {
  return (
    <ToastProvider>
      <ClearShortageInner />
    </ToastProvider>
  )
}
