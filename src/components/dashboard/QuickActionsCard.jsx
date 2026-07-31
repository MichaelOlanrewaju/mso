import React from "react"
import { activeStation } from "../../utils/station"
import { useNavigate } from "react-router-dom"
import { canViewBankDeposits } from "../../hooks/useBankDeposits"

const ACTIONS = [
  { icon: "bi-pencil-square",          iconBg: "var(--brand-accent-light)", iconColor: "var(--brand-accent)", label: "Record Sales",       href: `/sales/${activeStation()}`,    roles: ["supervisor","cashier"] },
  { icon: "bi-calculator",             iconBg: "#F0FDF4", iconColor: "#16A34A", label: "Cash Up",            href: `/cashup/${activeStation()}`,   roles: ["supervisor","cashier"] },
  { icon: "bi-truck",                  iconBg: "var(--brand-accent-light)", iconColor: "var(--brand-accent)", label: "Discharge",          href: `/discharge/${activeStation()}`,roles: ["ceo","owner","gm","supervisor"] },
  { icon: "bi-clock",                  iconBg: "#F5F3FF", iconColor: "#7C3AED", label: "Shifts",             href: `/shifts/${activeStation()}`,   roles: ["supervisor","cashier"] },
  { icon: "bi-person-fill-exclamation",iconBg: "#FEF2F2", iconColor: "#DC2626", label: "Debtors",            href: `/debtors/${activeStation()}`,  roles: ["ceo","owner","gm","supervisor"] },
  { icon: "bi-box-arrow-in-down",      iconBg: "var(--brand-accent-light)", iconColor: "var(--brand-accent)", label: "Orders",             href: `/orders/${activeStation()}`,   roles: ["ceo","owner","gm"] },
  { icon: "bi-wallet2",                iconBg: "#EEF0FB", iconColor: "var(--brand-primary)", label: "Payroll",            href: `/payroll/${activeStation()}`,  roles: ["ceo","owner","gm"] },
  { icon: "bi-bar-chart-line-fill",    iconBg: "#EDE9FE", iconColor: "#6D28D9", label: "P&L Report",        href: `/pnl/${activeStation()}`,      roles: ["ceo","owner","gm"] },
  { icon: "bi-graph-up-arrow",         iconBg: "var(--brand-accent-light)", iconColor: "#0891B2", label: "Variance",           href: `/variance/${activeStation()}`, roles: ["ceo","owner","gm"] },
  { icon: "bi-printer-fill",           iconBg: "#EEF0FB", iconColor: "var(--brand-primary)", label: "Summary",            href: `/summary/${activeStation()}`,  roles: ["ceo","owner","gm","supervisor"] },
  { icon: "bi-exclamation-triangle",   iconBg: "#FFF1F2", iconColor: "#DC2626", label: "Shortage",           href: `/shortage/${activeStation()}`, roles: ["ceo","owner","gm","supervisor","cashier"] },
  { icon: "bi-cash-coin",              iconBg: "#F0FDF4", iconColor: "#16A34A", label: "Excess",              href: `/excess/${activeStation()}`,   roles: ["ceo","owner","gm","supervisor","cashier"] },
  /* Attendants and Attendance are view-only for cashier — the pages
     themselves gate add/edit/mark to supervisor and above, so cashier can
     look (useful for checking a balance before accepting a repayment)
     without being able to change anything. Clear Shortage stays out of
     cashier's list entirely — deliberately kept with the supervisor, so
     the person handling the cash isn't also the one certifying it. */
  { icon: "bi-people",                 iconBg: "#F5F3FF", iconColor: "#7C3AED", label: "Attendants",         href: `/attendants/${activeStation()}`, roles: ["ceo","owner","gm","supervisor","cashier"] },
  { icon: "bi-calendar-check",         iconBg: "#F0FDF4", iconColor: "#16A34A", label: "Attendance",         href: `/attendance/${activeStation()}`, roles: ["ceo","owner","gm","supervisor","cashier"] },
  { icon: "bi-receipt",                iconBg: "#FEF3C7", iconColor: "#B45309", label: "Clear Shortage",     href: `/clear-shortage/${activeStation()}`, roles: ["ceo","owner","gm","supervisor"] },
  /* CEO/GM only — this aggregates every attendant at once (sales, litres,
     shortage) into one view, which needs a wider financial/oversight lens
     than a supervisor's day-to-day operational role. */
  { icon: "bi-bar-chart-line",         iconBg: "#EFF6FF", iconColor: "#2563EB", label: "Attendant Performance", href: `/attendant-performance/${activeStation()}`, roles: ["ceo","owner","gm"] },
  { icon: "bi-arrow-left-right",        iconBg: "#F5EBEF", iconColor: "#5f1f33", label: "Station Assign.",     href: "/station-assignments",          roles: ["ceo","owner","gm"] },
  { icon: "bi-tag",                     iconBg: "#FEF3C7", iconColor: "#B45309", label: "Correct Prices",      href: "/correct-prices",               roles: ["ceo","owner"] },
  /* Bank Deposits doesn't fit a plain role list — Joseph and Lanre need it
     regardless of their account role, and CEO/owner need it too (view-only).
     Handled with its own dynamic check below, not the static roles array. */
]

export default function QuickActionsCard({ role, username }) {
  const navigate = useNavigate()
  const filtered = ACTIONS.filter(a => a.roles.includes(role))
  if (canViewBankDeposits(username, role)) {
    filtered.push({
      icon: "bi-bank", iconBg: "var(--brand-accent-light)", iconColor: "var(--brand-accent)",
      label: "Bank Deposits", href: `/bank-deposits/${activeStation()}`,
    })
  }
  if (!filtered.length) return null

  return (
    <div className="rounded-panel border border-border bg-white p-4 shadow-card">
      <div className="mb-3.5 text-[13px] font-extrabold tracking-[-0.02em] text-ink">Quick actions</div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-3">
        {filtered.map(a => (
          <button key={a.href} type="button" onClick={() => navigate(a.href)}
            aria-label={a.label}
            className="group flex flex-col items-center gap-2 rounded-[14px] border border-surface p-3 text-center transition-all duration-200 hover:-translate-y-[2px] hover:border-cyan/30 hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan active:scale-95">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] transition-transform duration-200 group-hover:scale-110"
              style={{ background: a.iconBg }}>
              <i className={`bi ${a.icon} text-[17px]`} style={{ color: a.iconColor }} />
            </div>
            <span className="text-[10.5px] font-semibold leading-tight text-ink">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
