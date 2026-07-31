import React, { useState } from "react"
import { activeStation } from "../utils/station"
import { getStation } from "../config/stations"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useExcess } from "../hooks/useExcess"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira } from "../utils/format"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function ExcessInner() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const toast = useToast()
  usePageTitle(`Excess — ${getStation(activeStation()).name}`)

  const { status, excess, saving, reportExcess } = useExcess(auth.username)
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")

  const resetForm = () => {
    setDate(todayISO())
    setAmount("")
    setDescription("")
  }

  const handleSubmit = async () => {
    const amt = Number(amount) || 0
    const res = await reportExcess({ date, amount: amt, description: description.trim() })
    if (!res.ok) {
      toast.showToast("Could not save", res.error || "Please try again", "err")
      return
    }
    toast.showToast("Recorded", `₦${amt.toLocaleString()} added to Cash At Hand`, "ok")
    resetForm()
    setShowForm(false)
  }

  const totalExcess = excess.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[100] flex items-center gap-3 border-b border-border bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingTop: "max(var(--sat), 12px)" }}>
        <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2">
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-extrabold text-ink">Excess</div>
          <div className="text-[10px] text-ink-4">{getStation(activeStation()).name}</div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(s => !s)}
          className="flex h-9 items-center gap-1.5 rounded-[9px] bg-green px-3 text-[12px] font-bold text-white"
        >
          <i className="bi bi-plus" /> Report
        </button>
      </div>

      <div className="mx-auto max-w-[520px] px-4 py-5">
        <div className="mb-4 rounded-card border border-cyan/20 bg-cyan-light px-3.5 py-3 text-[11.5px] leading-snug text-cyan-dark">
          <i className="bi bi-info-circle-fill mr-1" /> Extra cash found beyond what was expected — this <strong>directly increases Cash At Hand</strong> the moment it's recorded.
        </div>

        {showForm && (
          <div className="mb-4 rounded-card border border-border bg-white p-4 shadow-card">
            <div className="mb-3 text-[13px] font-extrabold text-ink">Report Excess</div>
            <div className="mb-3">
              <div className="mb-1 text-[11px] font-semibold text-ink-3">Date</div>
              <input
                type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)}
                className="w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-cyan focus:bg-white"
              />
            </div>
            <div className="mb-3">
              <div className="mb-1 text-[11px] font-semibold text-ink-3">Amount (₦)</div>
              <input
                type="number" inputMode="decimal" min="0" step="1" value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-right font-mono text-[18px] font-extrabold text-ink outline-none focus:border-cyan focus:bg-white"
              />
            </div>
            <div className="mb-4">
              <div className="mb-1 text-[11px] font-semibold text-ink-3">Where did it come from?</div>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="e.g. Extra cash found after bank payment reconciliation"
                className="w-full resize-none rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-cyan focus:bg-white"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                className="flex-1 rounded-[10px] border border-border py-2.5 text-[13px] font-semibold text-ink-3">
                Cancel
              </button>
              <button
                type="button" disabled={!amount || Number(amount) <= 0 || !description.trim() || saving}
                onClick={handleSubmit}
                className="flex-1 rounded-[10px] bg-green py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Record Excess"}
              </button>
            </div>
          </div>
        )}

        {status === "loading" && (
          <div className="py-16 text-center text-[13px] text-ink-4">Loading…</div>
        )}

        {status === "ready" && excess.length > 0 && (
          <div className="mb-3 rounded-card border border-green/20 bg-green-light px-3.5 py-2.5 text-center">
            <div className="text-[18px] font-black text-green">{naira(totalExcess)}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-green">Total excess on record</div>
          </div>
        )}

        {status === "ready" && excess.length === 0 && !showForm && (
          <div className="rounded-card border border-dashed border-border bg-white px-4 py-10 text-center">
            <i className="bi bi-cash-coin mb-2 block text-[28px] text-ink-4" />
            <div className="text-[13px] font-semibold text-ink-3">No excess recorded yet</div>
          </div>
        )}

        {status === "ready" && excess.length > 0 && (
          <div className="space-y-2">
            {excess.map(e => (
              <div key={e.rowIndex} className="rounded-card border border-border bg-white p-3.5 shadow-card">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-ink-3">{e.date} · {e.time} · {e.reportedBy || "—"}</span>
                  <span className="mono text-[14px] font-extrabold text-green">{naira(e.amount)}</span>
                </div>
                <div className="text-[12.5px] leading-snug text-ink-2">{e.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExcessPage() {
  return (
    <ToastProvider>
      <ExcessInner />
    </ToastProvider>
  )
}
