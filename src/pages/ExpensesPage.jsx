import React, { useState } from "react"
import { activeStation } from "../utils/station"
import { getStation } from "../config/stations"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useExpensesData } from "../hooks/useExpensesData"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira } from "../utils/format"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function ExpensesInner() {
  const auth = useAuth({ requireAuth: true })
  const toast = useToast()
  const navigate = useNavigate()
  usePageTitle(`Expenses — ${getStation(activeStation()).name}`)

  const [searchParams] = useSearchParams()
  const [date, setDate] = useState(searchParams.get("date") || todayISO())
  const {
    status, items, total, refresh, desc, setDesc, amt, setAmt, addExpense, saving,
    expenseUnlocked, editExpense, removeExpense, requestEditForExpense, requestingEdit,
  } = useExpensesData(auth.username, date)
  const [editingRow, setEditingRow] = useState(null) // { rowIndex, description, amount }
  const [confirmDeleteRow, setConfirmDeleteRow] = useState(null)

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

  const handleRequestEdit = async () => {
    const res = await requestEditForExpense(`Correct an expense on ${date}`)
    if (res.ok) {
      toast.showToast("Request sent", "GM/CEO will be notified for approval.", "ok")
    } else {
      toast.showToast("Could not send request", res.error || "Please try again", "err")
    }
  }

  const handleSaveEdit = async () => {
    if (!editingRow) return
    const res = await editExpense(editingRow.rowIndex, editingRow.description, editingRow.amount)
    if (res.ok) {
      toast.showToast("Saved", "Expense corrected", "ok")
      setEditingRow(null)
    } else {
      toast.showToast("Could not save", res.error || "Please try again", "err")
    }
  }

  const handleDelete = async (rowIndex) => {
    const res = await removeExpense(rowIndex)
    if (res.ok) {
      toast.showToast("Deleted", "Expense removed", "ok")
      setConfirmDeleteRow(null)
    } else {
      toast.showToast("Could not delete", res.error || "Please try again", "err")
    }
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
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={todayISO()}
            className="border-none bg-transparent p-0 text-[10px] text-ink-4 outline-none"
          />
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
              <div className="text-[10px] text-ink-4">{date === todayISO() ? "Deducted from today's cash to bank" : `Deducted from ${date}'s cash to bank`}</div>
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
          <div className="text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">{date === todayISO() ? "Today's" : date} Expenses</div>
          <div className="mono text-[12px] font-bold text-red">{items.length ? naira(total) : "—"}</div>
        </div>

        {/* This day is past today's own live entry — correcting or removing
            an expense here needs GM/CEO approval first, same as dip/pump.
            Only worth showing once there's actually something to correct. */}
        {items.length > 0 && !expenseUnlocked && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-card border border-amber/25 bg-amber-light px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-[11.5px] text-amber">
              <i className="bi bi-lock-fill" />
              <span>Locked — request approval to correct or remove an entry</span>
            </div>
            <button
              type="button" onClick={handleRequestEdit} disabled={requestingEdit}
              className="flex-shrink-0 rounded-[8px] bg-amber px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
            >
              {requestingEdit ? "Sending…" : "Request Edit"}
            </button>
          </div>
        )}
        {items.length > 0 && expenseUnlocked && (
          <div className="mb-2 flex items-center gap-2 rounded-card border border-green/25 bg-green-light px-3.5 py-2.5 text-[11.5px] text-green">
            <i className="bi bi-unlock-fill" />
            <span>Unlocked — you can correct or remove an entry now. This closes again after one change.</span>
          </div>
        )}

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
              <div className="text-[12.5px]">No expenses recorded {date === todayISO() ? "today" : "for this date"}</div>
            </div>
          )}
          {status === "ready" &&
            items.map((e, i) => (
              <div key={i} className="border-b border-surface px-4 py-3 last:border-none">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{e.description || "—"}</span>
                  <span className="mono flex-shrink-0 text-[13.5px] font-bold text-ink">{naira(e.amount)}</span>
                  {expenseUnlocked && (
                    <div className="flex flex-shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingRow({ rowIndex: e.rowIndex, description: e.description, amount: String(e.amount) })}
                        className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-border text-ink-3"
                      >
                        <i className="bi bi-pencil text-[11px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRow(e.rowIndex)}
                        className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-red/25 bg-red-light text-red"
                      >
                        <i className="bi bi-trash3 text-[11px]" />
                      </button>
                    </div>
                  )}
                </div>

                {editingRow?.rowIndex === e.rowIndex && (
                  <div className="mt-2.5 rounded-[10px] border border-cyan/25 bg-cyan-light p-3">
                    <input
                      type="text" value={editingRow.description}
                      onChange={ev => setEditingRow(r => ({ ...r, description: ev.target.value }))}
                      className="mb-2 w-full rounded-[8px] border border-border bg-white px-2.5 py-2 text-[13px] text-ink outline-none"
                    />
                    <input
                      type="number" inputMode="decimal" value={editingRow.amount}
                      onChange={ev => setEditingRow(r => ({ ...r, amount: ev.target.value }))}
                      className="mono mb-2 w-full rounded-[8px] border border-border bg-white px-2.5 py-2 text-right text-[14px] font-bold text-ink outline-none"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditingRow(null)} className="flex-1 rounded-[8px] border border-border py-2 text-[11.5px] font-semibold text-ink-3">
                        Cancel
                      </button>
                      <button type="button" onClick={handleSaveEdit} disabled={saving} className="flex-1 rounded-[8px] bg-cyan py-2 text-[11.5px] font-bold text-white disabled:opacity-50">
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}

                {confirmDeleteRow === e.rowIndex && (
                  <div className="mt-2.5 rounded-[10px] border border-red/25 bg-red-light p-3">
                    <div className="mb-2 text-[12px] font-semibold text-red">Delete this expense? This can't be undone.</div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmDeleteRow(null)} className="flex-1 rounded-[8px] border border-border bg-white py-2 text-[11.5px] font-semibold text-ink-3">
                        Cancel
                      </button>
                      <button type="button" onClick={() => handleDelete(e.rowIndex)} disabled={saving} className="flex-1 rounded-[8px] bg-red py-2 text-[11.5px] font-bold text-white disabled:opacity-50">
                        {saving ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
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
