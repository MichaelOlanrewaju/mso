import React from "react"
import { activeStation } from "../../utils/station"
import { getStation } from "../../config/stations"
import { Link, useLocation } from "react-router-dom"

const buildSections = () => [
  {
    label: "Operations",
    links: [
      { href: `/discharge/${activeStation()}`, icon: "bi-truck", text: "Discharge" },
      { href: `/shortage/${activeStation()}`, icon: "bi-exclamation-triangle", text: "Shortage" },
    ],
  },
  {
    label: "Reports & Insights",
    links: [
      { href: `/summary/${activeStation()}`, icon: "bi-printer", text: "Daily Summary" },
      { href: `/records/${activeStation()}`, icon: "bi-journal-text", text: "Records" },
      { href: `/variance/${activeStation()}`, icon: "bi-graph-up-arrow", text: "Stock Variance" },
      { href: `/pnl/${activeStation()}`, icon: "bi-bar-chart-line-fill", text: "P&L Report" },
      { href: `/stock-pl/${activeStation()}`, icon: "bi-layers-fill", text: "Tank and Pump Analysis" },
      { href: `/price/${activeStation()}`, icon: "bi-tag", text: "Pump Prices" },
      { href: `/lubricant/${activeStation()}`, icon: "bi-droplet-fill", text: "Oil" },
      { href: `/activity/${activeStation()}`, icon: "bi-journal-check", text: "Activity Log" },
    ],
  },
  {
    label: "Stock & Credit",
    links: [
      { href: `/debtors/${activeStation()}`, icon: "bi-person-fill-exclamation", text: "Debtors" },
      { href: `/orders/${activeStation()}`, icon: "bi-box-arrow-in-down", text: "Stock Orders" },
    ],
  },
  {
    label: "People & Finance",
    links: [
      { href: `/payroll/${activeStation()}`, icon: "bi-wallet2", text: "Payroll" },
      { href: `/add-staff/${activeStation()}`, icon: "bi-person-plus", text: "Add Staff" },
      { href: `/station-assignments`, icon: "bi-arrow-left-right", text: "Station Assignments" },
      { href: `/correct-prices`, icon: "bi-tag", text: "Correct Prices" },
    ],
  },
  {
    label: "Workspace",
    links: [{ href: "/notes", icon: "bi-journal-text", text: "My Notes" }],
  },
  {
    label: "Communication",
    desktopOnly: true,
    links: [{ href: `/chat/${activeStation()}`, icon: "bi-chat-dots", text: "Staff Chat" }],
  },
  {
    label: "Account",
    links: [{ href: "/profile", icon: "bi-person-circle", text: "My Profile" }],
  },
  {
    label: "Station",
    links: [{ href: "/select", icon: "bi-arrow-left-right", text: "Switch Station" }],
    pickOnly: true,
  },
]

function NavLinkItem({ href, icon, text }) {
  const loc = useLocation()
  const active = loc.pathname === href
  return (
    <Link
      to={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-[10px] border px-3 py-[9px] text-[12px] font-semibold transition-all duration-150 ${
        active
          ? "border-cyan/15 bg-cyan-light text-navy shadow-[inset_3px_0_0_var(--brand-accent)]"
          : "border-transparent text-ink-2 hover:border-border hover:bg-surface hover:text-ink"
      }`}
    >
      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] transition-colors ${
        active ? "bg-white text-cyan-dark shadow-sm" : "bg-surface text-ink-4 group-hover:bg-white group-hover:text-ink-2"
      }`}>
        <i className={`bi ${icon} text-[13px]`} />
      </span>
      <span className="truncate">{text}</span>
      {active && <i className="bi bi-chevron-right ml-auto text-[9px] text-cyan-dark" />}
    </Link>
  )
}

export default function Sidebar({ isGM, isOwner, canPickStation, homePath, onLogout, mobileOpen, onClose, name, role, avatarInitials }) {
  const station = getStation(activeStation())
  const sections = buildSections()
  const ownerOrGm = isOwner || isGM

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-[198] bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[199] flex h-full w-sidebar flex-col border-r border-border bg-white transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ paddingTop: "max(12px,var(--sat))" }}
      >
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
          <div className="mb-4 border-b border-border px-2 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] shadow-sm"
                style={{ background: "var(--brand-gradient-btn)" }}
              >
                <span className="text-[11px] font-black tracking-[-.02em] text-white">{station.short}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-extrabold tracking-[-.02em] text-ink">{name || station.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[.06em] text-ink-4">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#22c55e" }} />
                  {role || "Operations"}
                </div>
              </div>
            </div>
          </div>

          {homePath && (
            <div className="mb-3">
              <NavLinkItem href={homePath} icon="bi-grid-1x2-fill" text="Command Center" />
            </div>
          )}

          <nav aria-label="Primary navigation" className="min-h-0 flex-1 overflow-y-auto pr-0.5">
            {sections.map(section => {
              if (section.ownerOrGm && !ownerOrGm) return null
              if (section.pickOnly && !canPickStation) return null
              return (
                <div key={section.label} className={`mb-4 ${section.desktopOnly ? "hidden lg:block" : ""}`}>
                  <div className="mb-1.5 px-2 text-[8.5px] font-extrabold uppercase tracking-[.14em] text-ink-4">
                    {section.label}
                  </div>
                  <div className="flex flex-col gap-1">
                    {section.links.map(l => <NavLinkItem key={l.href} {...l} />)}
                  </div>
                </div>
              )
            })}
          </nav>

          <div className="mt-2 border-t border-border pt-3">
            <div className="mb-2 flex items-center gap-2 px-2 text-[9px] font-semibold text-ink-4">
              <span className="h-1.5 w-1.5 rounded-full bg-green" />
              <span className="truncate">{station.name}</span>
              <span className="ml-auto uppercase tracking-wider">Live</span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-[10px] border border-transparent px-3 py-2.5 text-[12px] font-semibold text-red transition-colors hover:border-red/10 hover:bg-red-light"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-red-light">
                <i className="bi bi-box-arrow-right text-[13px]" />
              </span>
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
