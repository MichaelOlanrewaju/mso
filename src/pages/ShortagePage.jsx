import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useShortages, SHORTAGE_CATEGORIES } from "../hooks/useShortages"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, litres as fmtLitres } from "../utils/format"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function StatusPill({ status }) {
  const map = {
    PENDING: { bg: "bg-amber-light", text: "text-amber", label: "Pending" },
    REVIEWED: { bg: "bg-cyan-light", text: "text-cyan-dark", label: "Reviewed" },
    RESOLVED: { bg: "bg-green-light", text: "text-green", label: "Resolved" },
  }
  const m = map[status] || map.PENDING
  return <span className={`rounded-full px-2 py-[2px] text-[10px] font-bold ${m.bg} ${m.text}`}>{m.label}</span>
}

export default function ShortagePage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const canReport = auth.role === "supervisor" || auth.role === "cashier" || auth.isGM || auth.isOwner
  const canReview = auth.isGM || auth.isOwner
  const { status, shortages, saving, reportShortage, reviewShortage } = useShortages({ all: canReview })
  usePageTitle("Shortage — MSO Limpid")

  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [category, setCategory] = useState(SHORTAGE_CATEGORIES[0])
  const [litres, setLitres] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [feedback, setFeedback] = useState(null)

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }

  const resetForm = () => {
    setDate(todayISO())
    setCategory(SHORTAGE_CATEGORIES[0])
    setLitres("")
    setAmount("")
    setDescription("")
  }

  const handleSubmit = async e => {
    e.preventDefault()
    const amt = Number(amount)
    if (!description.trim()) {
      setFeedback({ type: "error", text: "Describe what happened." })
      return
    }
    if (!amt || amt <= 0) {
      setFeedback({ type: "error", text: "Enter the shortage amount in naira." })
      return
    }
    setFeedback(null)
    const res = await reportShortage({
      date, category, litres: Number(litres) || 0, amount: amt,
      description: description.trim(), username: auth.username,
    })
    if (res.ok) {
      setFeedback({ type: "success", text: "Shortage reported. GM has been notified." })
      resetForm()
      setShowForm(false)
    } else {
      setFeedback({ type: "error", text: res.error || "Couldn't save. Try again." })
    }
  }

  const handleReview = async (rowIndex, decision) => {
    await reviewShortage({ rowIndex, decision, username: auth.username })
  }

  return (
    <div className="min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />
      <div
        className="sticky top-0 z-[200] flex items-center gap-3 border-b border-border bg-white px-4 pb-2.5 shadow-[0_1px_4px_rgba(0,0,0,.04)]"
        style={{ paddingTop: "max(var(--sat), 52px)" }}
      >
        <button
          type="button"
          onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2"
        >
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-extrabold text-ink">Shortage</div>
          <div className="text-[10px] text-ink-4">MSO Station</div>
        </div>
        {canReport && (
          <button
            type="button"
            onClick={() => setShowForm(s => !s)}
            className="flex h-9 items-center gap-1.5 rounded-[9px] bg-red px-3 text-[12px] font-bold text-white"
          >
            <i className="bi bi-plus" /> Report
          </button>
        )}
      </div>

      <div className="mx-auto max-w-[520px] px-4 py-5">
        {canReport && showForm && (
          <form onSubmit={handleSubmit} className="mb-5 rounded-card border border-border bg-white p-4 shadow-card">
            <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.6px] text-ink-4">Report a Shortage</div>

            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] font-semibold text-ink-3">Date</span>
              <input
                type="date"
                value={date}
                max={todayISO()}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-[9px] border border-border px-3 py-2.5 text-[13px] text-ink outline-none focus:border-cyan"
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] font-semibold text-ink-3">Category</span>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full rounded-[9px] border border-border px-3 py-2.5 text-[13px] text-ink outline-none focus:border-cyan"
              >
                {SHORTAGE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <div className="mb-3 grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-ink-3">Litres (if fuel-related)</span>
                <input
                  type="number" inputMode="decimal" min="0" step="0.1" value={litres}
                  onChange={e => setLitres(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-[9px] border border-border px-3 py-2.5 text-[13px] font-bold text-ink outline-none focus:border-cyan"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-ink-3">Amount (₦)</span>
                <input
                  type="number" inputMode="decimal" min="0" step="1" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-[9px] border border-border px-3 py-2.5 text-[13px] font-bold text-ink outline-none focus:border-cyan"
                />
              </label>
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] font-semibold text-ink-3">What happened</span>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the shortage — what was expected, what was found, and any context"
                className="w-full resize-none rounded-[9px] border border-border px-3 py-2.5 text-[13px] text-ink outline-none focus:border-cyan"
              />
            </label>

            {feedback && (
              <div
                className={`mb-3 rounded-[9px] px-3 py-2 text-[12px] font-semibold ${
                  feedback.type === "success" ? "bg-green-light text-green" : "bg-red-light text-red"
                }`}
              >
                {feedback.text}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex h-[44px] w-full items-center justify-center rounded-[10px] bg-red text-[13.5px] font-bold text-white shadow-lift disabled:opacity-60"
            >
              {saving ? "Reporting…" : "Report Shortage"}
            </button>
          </form>
        )}

        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">
            {canReview ? "All Shortages" : "Pending Shortages"}
          </span>
          {status === "ready" && <span className="text-[10.5px] text-ink-4">{shortages.length} record{shortages.length === 1 ? "" : "s"}</span>}
        </div>

        {status === "loading" && (
          <div className="flex items-center justify-center py-12 text-[13px] text-ink-4">
            <span className="mr-2 h-4 w-4 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
            Loading…
          </div>
        )}

        {status === "ready" && shortages.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-white py-14 text-center shadow-card">
            <i className="bi bi-check-circle text-3xl text-green" />
            <div className="text-[13.5px] font-bold text-ink">No shortages reported</div>
            <div className="max-w-[260px] text-[12px] text-ink-4">Nothing pending right now — that's a good sign.</div>
          </div>
        )}

        {status === "ready" && shortages.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {shortages.map(s => (
              <div key={s.rowIndex} className="rounded-card border border-border bg-white p-4 shadow-card">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-bold text-ink">{s.category}</div>
                    <div className="text-[10.5px] text-ink-4">{s.date} · {s.time} · {s.reportedBy || "—"}</div>
                  </div>
                  <StatusPill status={s.status} />
                </div>
                <div className="mb-2.5 text-[12.5px] leading-snug text-ink-2">{s.description}</div>
                <div className="flex items-center gap-3 text-[12px]">
                  <span className="mono font-extrabold text-red">{naira(s.amount)}</span>
                  {s.litres > 0 && <span className="text-ink-4">{fmtLitres(s.litres)}</span>}
                </div>
                {s.status !== "PENDING" && s.reviewedBy && (
                  <div className="mt-2 border-t border-surface pt-2 text-[10.5px] text-ink-4">
                    {s.status === "RESOLVED" ? "Resolved" : "Reviewed"} by {s.reviewedBy}
                  </div>
                )}
                {canReview && s.status === "PENDING" && (
                  <div className="mt-3 flex gap-2 border-t border-surface pt-3">
                    <button
                      type="button"
                      onClick={() => handleReview(s.rowIndex, "reviewed")}
                      className="flex-1 rounded-[9px] border border-cyan/25 bg-cyan-light px-3 py-2 text-[11.5px] font-bold text-cyan-dark"
                    >
                      Mark Reviewed
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview(s.rowIndex, "resolved")}
                      className="flex-1 rounded-[9px] border border-green-light bg-green-light px-3 py-2 text-[11.5px] font-bold text-green"
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
