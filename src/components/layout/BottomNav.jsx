import React from "react"
import { NavLink } from "react-router-dom"

const BASE =
  "flex flex-1 flex-col items-center gap-[3px] rounded-[10px] border border-transparent px-2.5 py-[6px] text-[10px] font-semibold transition-all duration-150 [&_i]:text-xl [&_i]:leading-none"

function itemClass({ isActive }) {
  return `${BASE} ${isActive ? "border-cyan/25 bg-white/10 text-cyan" : "text-white/40 active:text-white/70"}`
}

// NOTE: BottomNav is only ever rendered for owner/gm (supervisor and
// cashier have their own dedicated bottom nav built into their dashboard
// pages) — so nothing here should be a floor-operations task like Record
// Sales, Tank Dip, or Expenses entry. Those belong to supervisor/cashier only.
export default function BottomNav({ homePath = "/dashboard-mso" }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-[500] flex px-1 py-1.5 shadow-[0_-4px_20px_rgba(19,6,86,.35)] lg:hidden"
      style={{ paddingBottom: "calc(6px + var(--sab))", background: "linear-gradient(180deg, #130656 0%, #0D1226 100%)" }}
    >
      <div className="flex w-full justify-around">
        <NavLink to={homePath} end className={itemClass}>
          <i className="bi bi-grid-1x2-fill" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/discharge-mso" className={itemClass}>
          <i className="bi bi-truck" />
          <span>Discharge</span>
        </NavLink>
        <NavLink to="/summary-mso" className={itemClass}>
          <i className="bi bi-printer" />
          <span>Summary</span>
        </NavLink>
        <NavLink to="/payroll-mso" className={itemClass}>
          <i className="bi bi-wallet2" />
          <span>Payroll</span>
        </NavLink>
        <NavLink to="/chat-mso" className={itemClass}>
          <i className="bi bi-chat-dots-fill" />
          <span>Chat</span>
        </NavLink>
      </div>
    </nav>
  )
}
