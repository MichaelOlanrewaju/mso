import React from "react"
import { useNavigate } from "react-router-dom"

function buildCashupAlerts(pendingCashups, onApprove, onReject) {
  if (!pendingCashups || !pendingCashups.length) return []
  return pendingCashups.map(c => ({
    key: `cashup-${c.date}`,
    icon: "bi-cash-stack",
    iconBg: "#EAF6FC",
    iconColor: "#179DD0",
    title: `Cash Reconciliation — ${c.date}`,
    text: `${c.submittedBy || "Cashier"}: Expected ₦${Math.round(c.grandTotal).toLocaleString("en-NG")} · To Bank ₦${Math.round(c.toBank).toLocaleString("en-NG")}${c.remarks ? ` — "${c.remarks}"` : ""}`,
    actions: onApprove
      ? [
          { label: "Approve", onClick: () => onApprove(c.date), tone: "green" },
          { label: "Reject", onClick: () => onReject(c.date), tone: "red" },
        ]
      : null,
  }))
}

function buildTankAlerts(tankLevels) {
  if (!tankLevels || !tankLevels.length) return []
  return tankLevels
    .filter(t => t.cap > 0 && t.vol > 0 && Math.round((t.vol / t.cap) * 100) <= 20)
    .map(t => ({
      key: `tank-${t.id}`,
      icon: "bi-exclamation-triangle-fill",
      iconBg: "#FEF2F2",
      iconColor: "#DC2626",
      title: `${t.id} Critically Low`,
      text: `Only ${Math.round(t.vol).toLocaleString("en-NG")}L remaining (${Math.round((t.vol / t.cap) * 100)}%) — arrange discharge.`,
    }))
}

function typeLabel(type) {
  if (type === "dip_opening") return "Opening Dip"
  if (type === "dip_closing") return "Closing Dip"
  if (type && type.indexOf("pump_open_") === 0) return `Pump ${type.slice(10)} (Opening)`
  if (type && type.indexOf("pump_close_") === 0) return `Pump ${type.slice(11)} (Closing)`
  if (type && type.indexOf("pump_") === 0) return `Pump ${type.slice(5)}`
  return "a record"
}

function buildEditAlerts(editRequests, onApprove, onReject) {
  if (!editRequests || !editRequests.length) return []
  return editRequests.map(r => ({
    key: `edit-${r.rowIndex}`,
    icon: "bi-pencil-square",
    iconBg: "#F5F3FF",
    iconColor: "#7C3AED",
    title: `Edit Request — ${typeLabel(r.type)} · ${r.date}`,
    text: `${r.name || r.requestedBy}: ${r.message || "Requesting permission to edit a submitted entry."}`,
    actions: onApprove
      ? [
          { label: "Approve", onClick: () => onApprove(r.rowIndex), tone: "green" },
          { label: "Reject", onClick: () => onReject(r.rowIndex), tone: "red" },
        ]
      : null,
  }))
}

function buildShortageAlerts(shortages, onReview) {
  if (!shortages || !shortages.length) return []
  return shortages.map(s => ({
    key: `shortage-${s.rowIndex}`,
    icon: "bi-cash-coin",
    iconBg: "#FEF2F2",
    iconColor: "#DC2626",
    title: `Shortage — ₦${Math.round(s.amount).toLocaleString("en-NG")} (${s.category})`,
    text: `${s.reportedBy || "Staff"} on ${s.date}: ${s.description}`,
    actions: onReview
      ? [{ label: "Mark Reviewed", onClick: () => onReview(s.rowIndex, "reviewed"), tone: "green" }]
      : null,
  }))
}

function buildPayrollAlerts(pendingPayroll, onNavigate) {
  if (!pendingPayroll || !pendingPayroll.length) return []
  return pendingPayroll.map(p => {
    const [y, m] = (p.month || "").split("-")
    const label = y && m
      ? new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-NG", { month: "long", year: "numeric" })
      : p.month
    return {
      key: `payroll-${p.month}`,
      icon: "bi-wallet2",
      iconBg: "#EEF0FB",
      iconColor: "#130656",
      title: `Payroll — ${label}`,
      text: onNavigate
        ? `${p.staffCount} staff · ₦${Math.round(p.totalNet).toLocaleString("en-NG")} net total · Prepared by ${p.preparedBy || "GM"} — awaiting your approval.`
        : `${p.staffCount} staff · ₦${Math.round(p.totalNet).toLocaleString("en-NG")} net total · Submitted for owner approval.`,
      actions: onNavigate
        ? [{ label: "Review & Approve →", onClick: () => onNavigate(p.month), tone: "green" }]
        : null,
    }
  })
}

export default function AlertsCard({ tankLevels, editRequests, onApproveEdit, onRejectEdit, shortages, onReviewShortage, pendingPayroll, payrollReadOnly, pendingCashups, onApproveCashup, onRejectCashup }) {
  const navigate = useNavigate()

  const handlePayrollNavigate = month => {
    navigate(`/payroll-mso?month=${month}`)
  }

  const alerts = [
    ...buildPayrollAlerts(pendingPayroll, payrollReadOnly ? null : handlePayrollNavigate),
    ...buildCashupAlerts(pendingCashups, onApproveCashup, onRejectCashup),
    ...buildShortageAlerts(shortages, onReviewShortage),
    ...buildEditAlerts(editRequests, onApproveEdit, onRejectEdit),
    ...buildTankAlerts(tankLevels),
  ]

  return (
    <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-surface px-[18px] py-3.5">
        <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">Alerts</div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-px text-[10.5px] font-bold ${
            alerts.length ? "border-[#FECACA] bg-red-light text-red" : "border-border bg-surface text-ink-4"
          }`}
        >
          {alerts.length}
        </span>
      </div>
      <div>
        {alerts.length === 0 ? (
          <div className="px-[18px] py-6 text-center text-[12px] text-ink-4">No active alerts</div>
        ) : (
          alerts.map(a => (
            <div key={a.key} className="flex items-start gap-[11px] border-b border-surface px-[18px] py-3 last:border-none">
              <div
                className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] text-base"
                style={{ background: a.iconBg }}
              >
                <i className={`bi ${a.icon}`} style={{ color: a.iconColor }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-[12.5px] font-bold text-ink">{a.title}</div>
                <div className="text-[11.5px] leading-relaxed text-ink-2">{a.text}</div>
                {a.actions && (
                  <div className="mt-2 flex gap-2">
                    {a.actions.map(act => (
                      <button
                        key={act.label}
                        type="button"
                        onClick={act.onClick}
                        className={`rounded-[7px] px-3 py-1 text-[11px] font-bold ${
                          act.tone === "green" ? "bg-green-light text-green" : "bg-red-light text-red"
                        }`}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
