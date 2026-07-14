import React, { useState } from "react"
import { Link, useLocation } from "react-router-dom"

// NOTE: Sidebar is only ever rendered for owner/gm (supervisor and cashier
// have their own dedicated dashboard UIs) — so nothing here should be a
// floor-operations task like Record Sales, Tank Dip, Cash Reconciliation,
// or Expenses entry. Those belong to supervisor/cashier only.
const SECTIONS = [
  {
    label: "Discharge & Issues",
    links: [
      { href: "/discharge-mso",icon: "bi-truck",                text: "Discharge" },
      { href: "/shortage-mso", icon: "bi-exclamation-triangle", text: "Shortage" },
    ],
  },
  {
    label: "Reports",
    links: [
      { href: "/summary-mso",  icon: "bi-printer",              text: "Daily Summary" },
      { href: "/records-mso",  icon: "bi-journal-text",         text: "Records" },
      { href: "/variance-mso", icon: "bi-graph-up-arrow",       text: "Stock Variance" },
      { href: "/pnl-mso",      icon: "bi-bar-chart-line-fill",  text: "P&L Report" },
      { href: "/price-mso",    icon: "bi-tag",                  text: "Pump Prices" },
      { href: "/lubricant-mso", icon: "bi-droplet-fill",        text: "Oil" },
      { href: "/activity-mso", icon: "bi-journal-check",        text: "Activity Log" },
    ],
  },
  {
    label: "Stock & Credit",
    links: [
      { href: "/debtors-mso",  icon: "bi-person-fill-exclamation", text: "Debtors" },
      { href: "/orders-mso",   icon: "bi-box-arrow-in-down",    text: "Stock Orders" },
    ],
  },
  {
    label: "HR & Finance",
    links: [
      { href: "/payroll-mso",   icon: "bi-wallet2",             text: "Payroll" },
      { href: "/add-staff-mso", icon: "bi-person-plus",         text: "Add Staff" },
    ],
  },
  {
    label: "Communication",
    links: [{ href: "/chat-mso", icon: "bi-chat-dots",          text: "Staff Chat" }],
  },
  {
    label: "Account",
    links: [{ href: "/profile",  icon: "bi-person-circle",      text: "My Profile" }],
  },
  {
    label: "Station",
    links: [{ href: "/select",   icon: "bi-arrow-left-right",   text: "Switch Station" }],
    pickOnly: true,
  },
]

function NavLinkItem({ href, icon, text }) {
  const loc = useLocation()
  const active = loc.pathname === href
  return (
    <Link to={href}
      className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold transition-colors ${
        active ? "bg-cyan-light text-navy" : "text-ink-2 hover:bg-surface"}`}>
      <i className={`bi ${icon} text-[15px] ${active ? "text-cyan-dark" : "text-ink-4"}`} />
      {text}
    </Link>
  )
}

export default function Sidebar({ isGM, isOwner, canPickStation, homePath, onLogout, mobileOpen, onClose, name, role, avatarInitials }) {
  const ownerOrGm = isOwner || isGM
  return (
    <>
      {/* Mobile overlay — sits behind the menu panel (z-199) at z-198, with
          a real click-to-close handler. Several pages previously added
          their own separate backdrop at z-[1049] to get a dismiss-on-tap
          behavior, which placed it ABOVE the menu panel instead of behind
          it — visually covering the sidebar it was meant to sit under. */}
      {mobileOpen && <div className="fixed inset-0 z-[198] bg-black/45 backdrop-blur-[2px] lg:hidden" onClick={onClose} />}
      
      <aside className={`fixed inset-y-0 left-0 z-[199] flex h-full w-sidebar flex-col overflow-y-auto border-r border-border bg-white px-3 py-4 transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ paddingTop: "max(16px,var(--sat))" }}>
        {/* Logo + user */}
        <div className="mb-5 px-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-navy">
              <span className="text-[11px] font-extrabold text-white">MSO</span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-bold text-ink">{name || "MSO Limpid"}</div>
              <div className="text-[10px] capitalize text-ink-4">{role || ""}</div>
            </div>
          </div>
        </div>

        {/* Dashboard link */}
        {homePath && (
          <div className="mb-2">
            <NavLinkItem href={homePath} icon="bi-grid-1x2-fill" text="Dashboard" />
          </div>
        )}

        {/* Sections */}
        {SECTIONS.map(section => {
          if (section.ownerOrGm && !ownerOrGm) return null
          if (section.pickOnly && !canPickStation) return null
          return (
            <div key={section.label} className="mb-4">
              <div className="mb-1 px-3 text-[9.5px] font-bold uppercase tracking-[1px] text-ink-4">
                {section.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.links.map(l => (
                  <NavLinkItem key={l.href} href={l.href} icon={l.icon} text={l.text} />
                ))}
              </div>
            </div>
          )
        })}

        {/* Logout */}
        <div className="mt-auto border-t border-surface pt-4">
          <button type="button" onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-red hover:bg-red-light">
            <i className="bi bi-box-arrow-right text-[15px]" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
