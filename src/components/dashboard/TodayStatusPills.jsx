import React from "react"

function Pill({ icon, label, value, tone }) {
  const toneColor = tone === "done" ? "#16A34A" : tone === "warn" ? "#179DD0" : "#94A3B8"
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-card border border-border bg-white px-3 py-3.5 text-center shadow-card">
      <span className="text-[20px] leading-none">{icon}</span>
      <span className="text-[9px] font-bold uppercase tracking-[0.7px] text-ink-4">{label}</span>
      <span className="text-[12px] font-extrabold" style={{ color: toneColor }}>{value}</span>
    </div>
  )
}

// Sequential daily flow: closing can't happen before opening, cash-up can't
// happen before closing — each step reads "—" until the step before it is
// actually done, rather than guessing. Powered by todayStatus (computed
// server-side in getDashboard), not the old tanks/cashToBank fields, so
// this stays correct even on days using the live SalesLog fallback.
export default function TodayStatusPills({ todayStatus, loading }) {
  const opening = todayStatus?.openingDip
  const closing = todayStatus?.closingDip
  const cash = todayStatus?.cashierRecon

  return (
    <div className="flex gap-2.5">
      <Pill
        icon="🌅"
        label="Opening Dip"
        value={loading ? "…" : opening ? "Submitted" : "Pending"}
        tone={loading ? "muted" : opening ? "done" : "warn"}
      />
      <Pill
        icon="🌙"
        label="Closing Dip"
        value={loading ? "…" : closing ? "Submitted" : opening ? "Pending" : "—"}
        tone={loading ? "muted" : closing ? "done" : opening ? "warn" : "muted"}
      />
      <Pill
        icon="💳"
        label="Cashier Recon"
        value={loading ? "…" : cash ? "Balanced" : closing ? "Pending" : "—"}
        tone={loading ? "muted" : cash ? "done" : closing ? "warn" : "muted"}
      />
    </div>
  )
}
