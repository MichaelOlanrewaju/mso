import React from "react"
import { useNavigate } from "react-router-dom"
import { activeStation } from "../../utils/station"

function buildCashupAlerts(pendingCashups, onApprove, onReject, onView) {
  if (!pendingCashups || !pendingCashups.length) return []
  return pendingCashups.map(c => ({
    key: `cashup-${c.date}`,
    icon: "bi-cash-stack",
    iconBg: "var(--brand-accent-light)",
    iconColor: "var(--brand-accent)",
    title: `Cash Reconciliation — ${c.date}`,
    text: `${c.submittedBy || "Cashier"}: Expected ₦${Math.round(c.grandTotal).toLocaleString("en-NG")} · To Bank ₦${Math.round(c.toBank).toLocaleString("en-NG")}${c.remarks ? ` — "${c.remarks}"` : ""}`,
    /* View comes FIRST and is the neutral option. Approving money without
       seeing the underlying figures is exactly the habit this app should not
       encourage — the summary shows the full breakdown for that day. */
    actions: onApprove
      ? [
          { label: "View", onClick: () => onView(c.date), tone: "neutral" },
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

function buildEditAlerts(editRequests, onApprove, onReject, onView) {
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
          { label: "View", onClick: () => onView(r.date), tone: "neutral" },
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
      iconColor: "var(--brand-primary)",
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

  /* "Dismiss all" hides the list when it's long and you just want the page
     decluttered — it does NOT resolve anything. These alerts are live: a pending
     cash-up still needs approval whether or not it's on screen. So dismissed
     items come back on the next refresh if they're still unresolved. Bulk-
     approving or bulk-rejecting from one button would be dangerous (it's money
     and edit permissions), so dismiss only hides — the real decision still gets
     made per item. */
  const [dismissed, setDismissed] = React.useState(false)

  /* Open the full record for a date so the approver can actually read it
     before deciding. */
  const handleViewDate = date => {
    navigate(`/summary/${activeStation()}?date=${date}`)
  }

  const handlePayrollNavigate = month => {
    navigate(`/payroll/${activeStation()}?month=${month}`)
  }

  const alerts = [
    ...buildPayrollAlerts(pendingPayroll, payrollReadOnly ? null : handlePayrollNavigate),
    ...buildCashupAlerts(pendingCashups, onApproveCashup, onRejectCashup, handleViewDate),
    ...buildShortageAlerts(shortages, onReviewShortage),
    ...buildEditAlerts(editRequests, onApproveEdit, onRejectEdit, handleViewDate),
    ...buildTankAlerts(tankLevels),
  ]

  const count = alerts.length
  const hasAlerts = count > 0

  /* A signature of the current alert set. When new alerts arrive (or the set
     otherwise changes), un-dismiss — a freshly submitted cash-up should surface
     even if you dismissed the previous batch. */
  const alertSig = alerts.map(a => a.key).join("|")
  React.useEffect(() => { setDismissed(false) }, [alertSig])

  const showList = hasAlerts && !dismissed

  return (
    /* This card carries every decision the owner has to make — approvals,
       shortages, low tanks. It used to be styled exactly like the reporting
       cards around it, which buried it. Now it announces itself when there's
       something to act on, and recedes to a quiet "all clear" when there
       isn't — so a glance at the page tells you whether you're needed. */
    <div
      className={`overflow-hidden rounded-panel border bg-white transition-shadow duration-300 ${
        hasAlerts ? "border-[#FECACA] shadow-urgent" : "border-border shadow-card"
      }`}
    >
      <div
        className="flex items-center justify-between px-[18px] py-4"
        style={
          hasAlerts
            ? { background: "linear-gradient(135deg,#FEF2F2 0%,#FFF7ED 100%)" }
            : undefined
        }
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${
              hasAlerts ? "animate-pulse-ring" : ""
            }`}
            style={{
              background: hasAlerts ? "#EF4444" : "#F0FDF4",
              color: hasAlerts ? "#fff" : "#16A34A",
            }}
          >
            <i className={`bi ${hasAlerts ? "bi-exclamation-lg" : "bi-check-lg"} text-[15px]`} />
          </span>
          <div>
            <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">
              {hasAlerts ? "Needs your attention" : "All clear"}
            </div>
            <div className="text-[10.5px] font-medium text-ink-4">
              {hasAlerts
                ? `${count} item${count === 1 ? "" : "s"} waiting on you`
                : "Nothing waiting on you right now"}
            </div>
          </div>
        </div>
        {hasAlerts && (
          <div className="flex items-center gap-2">
            {/* Only worth offering when there's a pile of them. One or two, you
                just act on them. */}
            {count >= 3 && !dismissed && (
              <button type="button" onClick={() => setDismissed(true)}
                className="rounded-full border border-red/25 bg-white/70 px-2.5 py-1 text-[11px] font-bold text-red transition-colors hover:bg-white">
                Dismiss all
              </button>
            )}
            <span
              className="flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-[12px] font-extrabold tabular-nums text-white"
              style={{ background: "#EF4444", boxShadow: "0 2px 8px rgba(239,68,68,.35)" }}
            >
              {count}
            </span>
          </div>
        )}
      </div>

      <div className={hasAlerts ? "border-t border-[#FECACA]/60" : ""}>
        {!hasAlerts ? (
          <div className="px-[18px] pb-6 pt-2 text-center">
            <p className="text-[12px] leading-relaxed text-ink-4">
              Approvals, shortages and low-tank warnings appear here.
            </p>
          </div>
        ) : !showList ? (
          <div className="flex items-center justify-between gap-3 px-[18px] py-4">
            <p className="text-[12px] text-ink-4">
              {count} item{count === 1 ? "" : "s"} hidden — still waiting on you.
            </p>
            <button type="button" onClick={() => setDismissed(false)}
              className="rounded-[9px] border border-border px-3 py-1.5 text-[11px] font-bold text-ink-3 hover:bg-surface">
              Show
            </button>
          </div>
        ) : (
          alerts.map((a, i) => (
            <div
              key={a.key}
              className="enter flex items-start gap-3 border-b border-surface px-[18px] py-3.5 transition-colors last:border-none hover:bg-surface/60"
              style={{ animationDelay: `${Math.min(i * 45, 270)}ms` }}
            >
              <div
                className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-[11px] text-base"
                style={{ background: a.iconBg }}
              >
                <i className={`bi ${a.icon}`} style={{ color: a.iconColor }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-[12.5px] font-bold text-ink">{a.title}</div>
                <div className="text-[11.5px] leading-relaxed text-ink-2">{a.text}</div>
                {a.actions && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {a.actions.map(act => (
                      <button
                        key={act.label}
                        type="button"
                        onClick={act.onClick}
                        className={`rounded-[9px] px-3.5 py-1.5 text-[11px] font-bold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 ${
                          act.tone === "green"
                            ? "text-white hover:brightness-110 focus-visible:outline-green"
                            : act.tone === "neutral"
                            ? "border border-border bg-white text-ink-2 hover:bg-surface focus-visible:outline-ink-3"
                            : "border border-[#FECACA] bg-white text-red hover:bg-red-light focus-visible:outline-red"
                        }`}
                        style={
                          act.tone === "green"
                            ? {
                                background: "linear-gradient(135deg,#16A34A,#22C55E)",
                                boxShadow: "0 2px 8px rgba(22,163,74,.28)",
                              }
                            : undefined
                        }
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
