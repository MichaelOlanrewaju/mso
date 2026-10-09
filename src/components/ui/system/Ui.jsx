import React from "react"

export function PageHeader({ eyebrow, title, description, actions, back, onBack, meta }) {
  return (
    <div className="mso-page-header">
      <div className="mso-page-header-main">
        {back && (
          <button type="button" onClick={onBack} className="mso-icon-button" aria-label="Go back">
            <i className="bi bi-arrow-left" />
          </button>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="mso-eyebrow">{eyebrow}</div>}
          <h1 className="mso-page-title">{title}</h1>
          {description && <p className="mso-page-subtitle">{description}</p>}
          {meta && <div className="mso-page-meta">{meta}</div>}
        </div>
      </div>
      {actions && <div className="mso-page-actions">{actions}</div>}
    </div>
  )
}

export function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mso-section-header">
      <div>
        {eyebrow && <div className="mso-eyebrow">{eyebrow}</div>}
        <h2 className="mso-section-title">{title}</h2>
        {description && <p className="mso-section-description">{description}</p>}
      </div>
      {action && <div className="mso-section-action">{action}</div>}
    </div>
  )
}

export function Surface({ children, className = "", padding = true }) {
  return <section className={`mso-surface ${padding ? "mso-surface-pad" : ""} ${className}`}>{children}</section>
}

export function StatCard({ label, value, hint, icon, tone = "neutral", action }) {
  return (
    <div className={`mso-stat-card mso-stat-${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mso-stat-label">{label}</div>
          <div className="mso-stat-value">{value}</div>
          {hint && <div className="mso-stat-hint">{hint}</div>}
        </div>
        {icon && <div className="mso-stat-icon"><i className={`bi ${icon}`} /></div>}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function StatusBadge({ children, tone = "neutral", dot = true }) {
  return <span className={`mso-status mso-status-${tone}`}>{dot && <span className="mso-status-dot" />}{children}</span>
}

export function EmptyState({ icon = "bi-inbox", title = "Nothing here yet", description, action }) {
  return (
    <div className="mso-empty">
      <div className="mso-empty-icon"><i className={`bi ${icon}`} /></div>
      <div className="mso-empty-title">{title}</div>
      {description && <div className="mso-empty-description">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function DataToolbar({ search, onSearch, placeholder = "Search...", filters, actions }) {
  return (
    <div className="mso-toolbar">
      {onSearch && (
        <label className="mso-search">
          <i className="bi bi-search" />
          <input value={search || ""} onChange={e => onSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        </label>
      )}
      {filters && <div className="mso-toolbar-filters">{filters}</div>}
      {actions && <div className="mso-toolbar-actions">{actions}</div>}
    </div>
  )
}
