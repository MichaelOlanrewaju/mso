import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useAdminDayRecord, useAdminOverview } from "../hooks/useAdminDayRecord"
import { usePageTitle } from "../hooks/usePageTitle"
import { useToast } from "../components/layout/ToastProvider"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { getStation } from "../config/stations"
import { activeStation } from "../utils/station"
import { naira, litres } from "../utils/format"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

/* Every field an admin can directly correct, grouped for a sensible
   editing flow — dip readings first, then payment channels, then
   expenses/totals. Read-only fields (grand total, litres/revenue) are
   shown for context but not directly editable here, since they're
   derived from PumpMetres/SalesLog — correcting the underlying pump
   data is what the Discharge and Records tools are for; this admin
   panel corrects the DailySales-level figures directly. */
const EDITABLE_FIELDS = [
  { group: "Tank Dips", fields: [
    ["TK1_OPEN", "TK1 Opening"], ["TK1_CLOSE", "TK1 Closing"],
    ["TK2_OPEN", "TK2 Opening"], ["TK2_CLOSE", "TK2 Closing"],
    ["TK3_OPEN", "TK3 Opening"], ["TK3_CLOSE", "TK3 Closing"],
    ["TK4_OPEN", "TK4 Opening"], ["TK4_CLOSE", "TK4 Closing"],
  ]},
  { group: "Payment Channels", fields: [
    ["POS_MP", "POS (M.P)"], ["POS_ZM", "POS (Z.B)"],
    ["TRF_MP", "Transfer (M.P)"], ["TRF_ZB", "Amelia Fuel (Z.B)"],
    ["TRF_TRUCK", "Diesel to Truck (FCMB)"], ["TRF_MD", "Cash to MD (Z.B)"],
    ["CASH", "Cash"],
  ]},
  { group: "Expenses & Totals", fields: [
    ["TOTAL_EXPENSES", "Total Expenses"], ["TO_BANK", "To Bank (auto-recalculates from Cash/Expenses)"],
  ]},
]

function AdminInner() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const toast = useToast()
  usePageTitle(`Admin Dashboard — ${getStation(activeStation()).name}`)

  const [date, setDate] = useState(todayISO())
  const { status, record, saving, load, updateField, deleteRow } = useAdminDayRecord()
  /* Opens on the Overview by default — the whole point of this feature
     is seeing every recent day's status at a glance instead of opening
     each one individually. Tapping a day switches into the existing
     single-day detail view; a "Back to Overview" link returns. */
  const [viewMode, setViewMode] = useState("overview") // "overview" | "detail"
  const { status: overviewStatus, days: overviewDays, load: loadOverview } = useAdminOverview()
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(null) // { sheetName, rowIndex, label }
  const [expandedSection, setExpandedSection] = useState(null)

  useEffect(() => {
    if (viewMode === "overview") loadOverview(14)
  }, [viewMode, loadOverview])

  useEffect(() => {
    if (viewMode === "detail" && date) load(date)
  }, [viewMode, date, load])

  const openDay = (d) => {
    setDate(d)
    setViewMode("detail")
  }

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  const isAdmin = ["ceo", "owner"].includes(auth.role)
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-pagebg p-6 text-center">
        <i className="bi bi-shield-lock text-4xl text-ink-4" />
        <div className="text-[15px] font-bold text-ink">CEO/Owner Only</div>
        <div className="text-[13px] text-ink-4">This page isn't available for your role.</div>
        <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="mt-2 rounded-full bg-navy px-4 py-2 text-[13px] font-bold text-white">
          Back to Dashboard
        </button>
      </div>
    )
  }

  const dsField = (key) => record?.dailySales ? record.dailySales[key] : undefined

  const startEdit = (field, currentValue) => {
    setEditingField(field)
    setEditValue(currentValue === undefined || currentValue === "" ? "0" : String(currentValue))
  }

  const saveEdit = async () => {
    if (!editingField) return
    const res = await updateField(date, editingField, editValue, auth.username)
    if (res.ok) {
      toast.showToast("Saved", `${editingField} updated`, "ok")
      setEditingField(null)
    } else {
      toast.showToast("Couldn't save", res.error || "Please try again", "err")
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    const res = await deleteRow(date, confirmDelete.sheetName, confirmDelete.rowIndex, auth.username)
    if (res.ok) {
      toast.showToast("Deleted", confirmDelete.label, "ok")
      setConfirmDelete(null)
    } else {
      toast.showToast("Couldn't delete", res.error || "Please try again", "err")
    }
  }

  const checks = record?.checks
  const tankChecks = record?.tankChecks || []
  const hasMismatch = tankChecks.some(t => t.mismatch) || checks?.toBankMismatch || (checks && Math.abs(checks.variance) > 1)

  const lineItemSections = [
    { key: "expenses", label: "Expenses", sheetName: "Expenses", icon: "bi-receipt", nameField: "Description", amountField: "Amount" },
    { key: "discharge", label: "Discharge", sheetName: "Discharge", icon: "bi-fuel-pump-fill", nameField: "Product", amountField: "Actual Received" },
    { key: "bankDeposits", label: "Bank Deposits", sheetName: "BankDeposits", icon: "bi-bank", nameField: "SubmittedBy", amountField: "Amount" },
    { key: "excess", label: "Excess", sheetName: "Excess", icon: "bi-plus-circle", nameField: "Description", amountField: "Amount" },
    { key: "shortage", label: "Shortage", sheetName: "Shortage", icon: "bi-exclamation-triangle", nameField: "Description", amountField: "Amount" },
  ]

  return (
    <div className="min-h-screen bg-pagebg pb-16">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[200] border-b border-border bg-white shadow-sm" style={{ paddingTop: "max(var(--sat),52px)" }}>
        <div className="flex items-center gap-3 px-4 pb-3">
          <button type="button" onClick={() => viewMode === "detail" ? setViewMode("overview") : navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">{viewMode === "overview" ? "Admin Dashboard" : "Day Detail"}</div>
            <div className="text-[10px] text-ink-4">{getStation(activeStation()).name} — direct data correction</div>
          </div>
          {viewMode === "detail" && (
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className="rounded-[9px] border border-border bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-ink outline-none"
            />
          )}
        </div>
      </div>

      {viewMode === "overview" && (
        <div className="mx-auto max-w-[640px] px-4 py-4">
          {overviewStatus === "loading" && (
            <div className="flex items-center justify-center py-16 text-[13px] text-ink-4">
              <span className="mr-2 h-4 w-4 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
              Loading last 14 days…
            </div>
          )}

          {overviewStatus === "error" && (
            <div className="flex flex-col items-center gap-2 rounded-[16px] bg-white py-14 text-center shadow-sm">
              <i className="bi bi-wifi-off text-3xl text-ink-4" />
              <div className="text-[14px] font-bold text-ink">Couldn't load the overview</div>
              <button type="button" onClick={() => loadOverview(14)} className="mt-2 rounded-full bg-navy px-4 py-2 text-[12.5px] font-bold text-white">
                <i className="bi bi-arrow-clockwise mr-1.5" /> Try again
              </button>
            </div>
          )}

          {overviewStatus === "ready" && (
            <div className="space-y-2">
              {overviewDays.map(d => {
                const hasIssues = d.exists && d.issues && d.issues.length > 0
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => openDay(d.date)}
                    className="flex w-full items-center gap-3 rounded-[14px] bg-white p-3.5 text-left shadow-sm"
                  >
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] ${
                      !d.exists ? "bg-surface text-ink-4" : hasIssues ? "bg-red-light text-red" : "bg-green-light text-green"
                    }`}>
                      <i className={`bi ${!d.exists ? "bi-dash-circle" : hasIssues ? "bi-exclamation-triangle-fill" : "bi-check-circle-fill"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-ink">
                        {new Date(d.date + "T00:00:00").toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}
                      </div>
                      {!d.exists ? (
                        <div className="text-[11.5px] text-ink-4">No record yet</div>
                      ) : hasIssues ? (
                        <div className="truncate text-[11.5px] text-red">{d.issues.join(" · ")}</div>
                      ) : (
                        <div className="text-[11.5px] text-green">Clean — no issues found</div>
                      )}
                    </div>
                    <i className="bi bi-chevron-right text-ink-4" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === "detail" && (
      <div className="mx-auto max-w-[640px] px-4 py-4">
        {status === "loading" && (
          <div className="flex items-center justify-center py-16 text-[13px] text-ink-4">
            <span className="mr-2 h-4 w-4 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
            Loading…
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-2 rounded-[16px] bg-white py-14 text-center shadow-sm">
            <i className="bi bi-wifi-off text-3xl text-ink-4" />
            <div className="text-[14px] font-bold text-ink">Couldn't load this day</div>
            <button type="button" onClick={() => load(date)} className="mt-2 rounded-full bg-navy px-4 py-2 text-[12.5px] font-bold text-white">
              <i className="bi bi-arrow-clockwise mr-1.5" /> Try again
            </button>
          </div>
        )}

        {status === "ready" && (
          <>
            {/* ── Consistency summary — the same checks done by hand all
                session, now automatic every time a day loads. ── */}
            {checks && (
              <div className={`mb-4 rounded-[16px] border-2 p-4 ${hasMismatch ? "border-red/30 bg-red-light" : "border-green/30 bg-green-light"}`}>
                <div className="mb-2 flex items-center gap-2">
                  <i className={`bi ${hasMismatch ? "bi-exclamation-triangle-fill text-red" : "bi-check-circle-fill text-green"}`} />
                  <span className={`text-[13px] font-extrabold ${hasMismatch ? "text-red" : "text-green"}`}>
                    {hasMismatch ? "Issues found" : "Clean — everything checks out"}
                  </span>
                </div>
                <div className="mono text-[20px] font-black text-ink">
                  {naira(checks.variance)} <span className="text-[12px] font-bold text-ink-4">variance</span>
                </div>
                {checks.toBankMismatch && (
                  <div className="mt-1.5 text-[11.5px] text-red">
                    To Bank mismatch — Cash − Expenses should be {naira(checks.expectedToBank)}
                  </div>
                )}
                {tankChecks.filter(t => t.mismatch).map(t => (
                  <div key={t.tank} className="mt-1.5 text-[11.5px] text-red">
                    {t.tank} diff mismatch — stored {t.storedDiff}, real {t.realDiff}
                  </div>
                ))}
              </div>
            )}

            {!record?.dailySales && (
              <div className="mb-4 flex items-center gap-2 rounded-[12px] border border-amber/25 bg-amber-light px-4 py-3 text-[12.5px] text-amber">
                <i className="bi bi-info-circle" /> No DailySales row exists for this date yet — editing any field below will create one.
              </div>
            )}

            {/* ── Direct field editor ── */}
            {EDITABLE_FIELDS.map(group => (
              <div key={group.group} className="mb-4 overflow-hidden rounded-[14px] bg-white shadow-sm">
                <div className="border-b border-surface px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-ink-4">{group.group}</div>
                <div className="divide-y divide-surface">
                  {group.fields.map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-[12.5px] font-semibold text-ink-2">{label}</span>
                      {editingField === key ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" inputMode="decimal" autoFocus value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="mono w-28 rounded-[7px] border-2 border-cyan bg-surface px-2 py-1 text-right text-[13px] font-bold text-ink outline-none"
                          />
                          <button type="button" onClick={saveEdit} disabled={saving} className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-green text-white disabled:opacity-50">
                            <i className="bi bi-check2 text-[13px]" />
                          </button>
                          <button type="button" onClick={() => setEditingField(null)} className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-border text-ink-3">
                            <i className="bi bi-x text-[13px]" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => key !== "TO_BANK" && startEdit(key, dsField(key))}
                          disabled={key === "TO_BANK"}
                          className={`mono flex items-center gap-1.5 text-[13px] font-bold ${key === "TO_BANK" ? "text-ink-4" : "text-ink hover:text-cyan-dark"}`}
                        >
                          {key.includes("OPEN") || key.includes("CLOSE") ? litres(dsField(key) || 0) : naira(dsField(key) || 0)}
                          {key !== "TO_BANK" && <i className="bi bi-pencil text-[10px] opacity-50" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* ── Line items — expenses, discharge, deposits, excess, shortage ── */}
            {lineItemSections.map(section => {
              const items = record[section.key] || []
              if (items.length === 0) return null
              const isExpanded = expandedSection === section.key
              return (
                <div key={section.key} className="mb-4 overflow-hidden rounded-[14px] bg-white shadow-sm">
                  <button type="button" onClick={() => setExpandedSection(isExpanded ? null : section.key)}
                    className="flex w-full items-center gap-2.5 px-4 py-3">
                    <i className={`bi ${section.icon} text-[14px] text-ink-4`} />
                    <span className="flex-1 text-left text-[13px] font-bold text-ink">{section.label}</span>
                    <span className="text-[11px] font-bold text-ink-4">{items.length}</span>
                    <i className={`bi bi-chevron-${isExpanded ? "up" : "down"} text-[11px] text-ink-4`} />
                  </button>
                  {isExpanded && (
                    <div className="divide-y divide-surface border-t border-surface">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-semibold text-ink-2">{item[section.nameField] || "—"}</div>
                            {item[section.amountField] !== undefined && (
                              <div className="mono text-[12.5px] font-bold text-ink">{naira(item[section.amountField])}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ sheetName: section.sheetName, rowIndex: item.rowIndex, label: item[section.nameField] || section.label })}
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] border border-red/25 bg-red-light text-red"
                          >
                            <i className="bi bi-trash3 text-[11px]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-[400px] rounded-t-[20px] bg-white p-5 sm:rounded-[20px]" onClick={e => e.stopPropagation()}>
            <div className="mb-1 text-[15px] font-extrabold text-ink">Delete this entry?</div>
            <div className="mb-4 text-[12.5px] text-ink-3">"{confirmDelete.label}" — this can't be undone.</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 rounded-[10px] border border-border py-2.5 text-[13px] font-semibold text-ink-3">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={saving} className="flex-1 rounded-[10px] bg-red py-2.5 text-[13px] font-bold text-white disabled:opacity-50">
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminDashboardPage() {
  return <AdminInner />
}
