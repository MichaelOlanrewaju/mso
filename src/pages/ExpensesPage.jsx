import React from "react"
import { useNavigate } from "react-router-dom"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useExpensesData } from "../hooks/useExpensesData"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira } from "../utils/format"

function ExpensesInner() {
  const auth = useAuth({ requireAuth: true })
  const toast = useToast()
  const navigate = useNavigate()
  usePageTitle("Expenses — MSO Limpid")

  const { status, items, total, refresh, desc, setDesc, amt, setAmt, addExpense, saving } = useExpensesData(auth.username)

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }

  const handleAdd = async () => {
    const result = await addExpense()
    if (!result.ok) {
      toast.showToast("Could not save", result.error || "Please try again", "err")
      return
    }
    toast.showToast("Added", "Expense logged successfully", "ok")
  }

  return (
    <div className="min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[200] flex items-center gap-3 border-b border-border bg-white px-4 pb-2.5 shadow-[0_1px_4px_rgba(0,0,0,.04)]" style={{ paddingTop: "max(var(--sat), 52px)" }}>
        <button
          type="button"
          onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2"
        >
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-extrabold text-ink">Expenses</div>
          <div className="text-[10px] text-ink-4">{new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        <button type="button" onClick={refresh} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-3">
          <i className={`bi bi-arrow-clockwise ${status === "loading" ? "animate-spin-fast" : ""}`} />
        </button>
      </div>

      <div className="mx-auto max-w-[600px] px-4 py-4">
        <div className="mb-5 overflow-hidden rounded-card border border-border bg-white shadow-card">
          <div className="flex items-center gap-2.5 border-b border-surface bg-surface px-4 py-3">
            <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-red-light">
              <i className="bi bi-receipt-cutoff text-red" />
            </div>
            <div>
              <div className="text-[13px] font-extrabold text-ink">Log New Expense</div>
              <div className="text-[10px] text-ink-4">Deducted from today's cash to bank</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 p-4">
            <div>
              <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Description</div>
              <input
                type="text"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="e.g. Logistics to bank, fuel for generator"
                className="w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-3 text-[13.5px] font-medium text-ink outline-none focus:border-cyan focus:bg-white"
              />
            </div>
            <div>
              <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Amount (₦)</div>
              <input
                type="number"
                inputMode="decimal"
                value={amt}
                onChange={e => setAmt(e.target.value)}
                placeholder="0"
                min="0"
                step="1"
                className="mono w-full rounded-[10px] border-2 border-border bg-surface px-3.5 py-3 text-right text-[17px] font-extrabold text-ink outline-none focus:border-cyan focus:bg-white"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="mt-1 flex h-[46px] items-center justify-center gap-2 rounded-[11px] bg-cyan text-[14px] font-extrabold text-white disabled:opacity-60"
            >
              {saving ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> : <i className="bi bi-plus-circle" />}
              {saving ? "Saving…" : "Add Expense"}
            </button>
          </div>
        </div>

        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Today's Expenses</div>
          <div className="mono text-[12px] font-bold text-red">{items.length ? naira(total) : "—"}</div>
        </div>
        <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
          {status === "loading" && (
            <div className="flex items-center justify-center py-10 text-[13px] text-ink-4">
              <span className="mr-2 h-4 w-4 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
              Loading…
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <i className="bi bi-exclamation-triangle text-2xl text-red" />
              <div className="text-[12.5px] text-red">Could not load expenses</div>
            </div>
          )}
          {status === "ready" && items.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center text-ink-4">
              <i className="bi bi-check-circle text-2xl opacity-30" />
              <div className="text-[12.5px]">No expenses recorded today</div>
            </div>
          )}
          {status === "ready" &&
            items.map((e, i) => (
              <div key={i} className="flex items-center justify-between border-b border-surface px-4 py-3 last:border-none">
                <span className="text-[13px] text-ink-2">{e.description || "—"}</span>
                <span className="mono text-[13.5px] font-bold text-ink">{naira(e.amount)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export default function ExpensesPage() {
  return (
    <ToastProvider>
      <ExpensesInner />
    </ToastProvider>
  )
}
