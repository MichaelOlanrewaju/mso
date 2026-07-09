import React from "react"
import { useNavigate } from "react-router-dom"

const ACTIONS = [
  { icon: "bi-pencil-square",          iconBg: "#EAF6FC", iconColor: "#179DD0", label: "Record Sales",       href: "/sales-mso",    roles: ["supervisor","cashier"] },
  { icon: "bi-calculator",             iconBg: "#F0FDF4", iconColor: "#16A34A", label: "Cash Up",            href: "/cashup-mso",   roles: ["supervisor","cashier"] },
  { icon: "bi-truck",                  iconBg: "#FEF9EC", iconColor: "#D97706", label: "Discharge",          href: "/discharge-mso",roles: ["owner","gm","supervisor"] },
  { icon: "bi-clock",                  iconBg: "#F5F3FF", iconColor: "#7C3AED", label: "Shifts",             href: "/shifts-mso",   roles: ["supervisor","cashier"] },
  { icon: "bi-person-fill-exclamation",iconBg: "#FEF2F2", iconColor: "#DC2626", label: "Debtors",            href: "/debtors-mso",  roles: ["owner","gm","supervisor"] },
  { icon: "bi-box-arrow-in-down",      iconBg: "#FEF9EC", iconColor: "#D97706", label: "Orders",             href: "/orders-mso",   roles: ["owner","gm"] },
  { icon: "bi-wallet2",                iconBg: "#EEF0FB", iconColor: "#130656", label: "Payroll",            href: "/payroll-mso",  roles: ["owner","gm"] },
  { icon: "bi-bar-chart-line-fill",    iconBg: "#EDE9FE", iconColor: "#6D28D9", label: "P&L Report",        href: "/pnl-mso",      roles: ["owner","gm"] },
  { icon: "bi-graph-up-arrow",         iconBg: "#EAF6FC", iconColor: "#0891B2", label: "Variance",           href: "/variance-mso", roles: ["owner","gm"] },
  { icon: "bi-printer-fill",           iconBg: "#EEF0FB", iconColor: "#130656", label: "Summary",            href: "/summary-mso",  roles: ["owner","gm","supervisor"] },
  { icon: "bi-exclamation-triangle",   iconBg: "#FFF1F2", iconColor: "#DC2626", label: "Shortage",           href: "/shortage-mso", roles: ["owner","gm","supervisor","cashier"] },
]

export default function QuickActionsCard({ role }) {
  const navigate = useNavigate()
  const filtered = ACTIONS.filter(a => a.roles.includes(role))
  if (!filtered.length) return null

  return (
    <div className="rounded-card border border-border bg-white p-4 shadow-card">
      <div className="mb-3 text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">Quick Actions</div>
      <div className="grid grid-cols-3 gap-2.5">
        {filtered.map(a => (
          <button key={a.href} type="button" onClick={() => navigate(a.href)}
            className="flex flex-col items-center gap-2 rounded-[12px] border border-surface p-3 text-center transition-colors active:bg-surface">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px]"
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
