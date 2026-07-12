import React, { useEffect } from "react"
import { useNavigate } from "react-router-dom"

// NOTE: MobileDrawer is only ever rendered for owner/gm (supervisor and
// cashier have their own dedicated mobile dashboard UIs) — so nothing here
// should be a floor-operations task like Record Sales, Tank Dip, Cash Up,
// or Expenses entry. Those belong to supervisor/cashier only.
const LINKS = [
  { href: "/discharge-mso",icon: "bi-truck",                  color: "#179DD0", text: "Discharge" },
  { href: "/shortage-mso", icon: "bi-exclamation-triangle",   color: "#F87171", text: "Shortage" },
  { href: "/debtors-mso",  icon: "bi-person-fill-exclamation",color: "#DC2626", text: "Debtors" },
  { href: "/orders-mso",   icon: "bi-box-arrow-in-down",      color: "#179DD0", text: "Orders" },
  { href: "/variance-mso", icon: "bi-graph-up-arrow",         color: "#0891B2", text: "Variance" },
  { href: "/pnl-mso",      icon: "bi-bar-chart-line-fill",    color: "#06091A", text: "P&L" },
  { href: "/summary-mso",  icon: "bi-printer",                color: "#06091A", text: "Summary" },
  { href: "/records-mso",  icon: "bi-journal-text",           color: "#06091A", text: "Records" },
  { href: "/activity-mso", icon: "bi-journal-check",          color: "#06091A", text: "Activity Log" },
  { href: "/payroll-mso",  icon: "bi-wallet2",                color: "#130656", text: "Payroll" },
  { href: "/add-staff-mso",icon: "bi-person-plus",            color: "#130656", text: "Add Staff" },
  { href: "/chat-mso",     icon: "bi-chat-dots",              color: "#7C3AED", text: "Staff Chat" },
  { href: "/profile",      icon: "bi-person-circle",          color: "#64748B", text: "My Profile" },
]

export default function MobileDrawer({ open, onClose, onLogout }) {
  const navigate = useNavigate()

  // Escape closes the drawer, matching the app's other overlays.
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === "Escape") onClose?.() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const go = href => { onClose(); navigate(href) }

  return (
    <>
      <div className="animate-backdrop-in fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="animate-drawer-in fixed inset-y-0 right-0 z-[301] flex w-[80vw] max-w-[320px] flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4"
          style={{ paddingTop: "max(16px,var(--sat))" }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-navy">
              <span className="text-[10px] font-extrabold text-white">MSO</span>
            </div>
            <span className="text-[14px] font-extrabold text-ink">Menu</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-4 transition-colors hover:bg-surface hover:text-ink-2">
            <i className="bi bi-x-lg text-[13px]" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Quick links">
          <div className="grid grid-cols-3 gap-2">
            {LINKS.map(l => (
              <button key={l.href} type="button" onClick={() => go(l.href)}
                className="flex min-h-[66px] flex-col items-center justify-center gap-1.5 rounded-[12px] border border-surface bg-surface px-2 py-3 text-center transition-colors hover:border-cyan/25 hover:bg-cyan-light/50 active:bg-border">
                <i className={`bi ${l.icon} text-[20px]`} style={{ color: l.color }} />
                <span className="text-[10.5px] font-semibold leading-tight text-ink">{l.text}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="border-t border-surface px-4 pb-[max(16px,var(--sab))] pt-3">
          <button type="button" onClick={() => { onClose(); onLogout() }}
            className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-[10px] border border-red/20 bg-red-light py-3 text-[13px] font-bold text-red transition-colors hover:bg-red/10">
            <i className="bi bi-box-arrow-right" /> Sign Out
          </button>
        </div>
      </div>
    </>
  )
}
