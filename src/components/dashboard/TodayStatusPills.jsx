import React from "react"

/**
 * The day's three-step close-out, drawn as the sequence it actually is.
 *
 * It was three identical emoji tiles before, which hid the one thing that
 * matters: these steps are strictly ordered. Cash-up can't happen before the
 * closing dip; the closing dip can't happen before the opening one. So the
 * steps are now numbered and joined by a connector that fills in as the day
 * progresses — you can see at a glance both where you are and what's blocked.
 *
 * Powered by todayStatus from getDashboard, same as before. No new data.
 */

const STEPS = [
  { key: "opening", n: 1, icon: "bi-sunrise",  label: "Opening Dip",  done: "Submitted", wait: "Pending" },
  { key: "closing", n: 2, icon: "bi-moon-stars", label: "Closing Dip", done: "Submitted", wait: "Pending" },
  { key: "cash",    n: 3, icon: "bi-cash-stack", label: "Cash Recon",  done: "Balanced",  wait: "Pending" },
]

function Step({ step, state, loading }) {
  // done   — finished
  // active — it's this step's turn; this is the one to act on
  // locked — the step before it hasn't happened yet
  const isDone = state === "done"
  const isActive = state === "active"

  const ring = isDone ? "#16A34A" : isActive ? "var(--brand-accent)" : "#CBD5E1"
  const tint = isDone ? "#F0FDF4" : isActive ? "var(--brand-accent-light)" : "#F8FAFC"
  const text = isDone ? "#16A34A" : isActive ? "var(--brand-accent-dark)" : "#94A3B8"

  return (
    <li className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <span
        className={`relative flex h-11 w-11 items-center justify-center rounded-[14px] border-2 transition-all duration-300 ${
          isActive ? "scale-105" : ""
        }`}
        style={{
          borderColor: ring,
          background: tint,
          boxShadow: isActive ? "0 4px 14px rgba(23,157,208,.22)" : "none",
        }}
      >
        {isDone ? (
          <i className="bi bi-check-lg text-[19px]" style={{ color: ring }} />
        ) : (
          <i className={`bi ${step.icon} text-[16px]`} style={{ color: text }} />
        )}
        {/* Step number sits on the badge — the order is the point. */}
        <span
          className="absolute -right-1 -top-1 flex h-[17px] w-[17px] items-center justify-center rounded-full text-[9px] font-extrabold text-white"
          style={{ background: ring, boxShadow: "0 0 0 2px #fff" }}
        >
          {step.n}
        </span>
      </span>

      <span className="text-center text-[9.5px] font-bold uppercase leading-tight tracking-[0.6px] text-ink-4">
        {step.label}
      </span>
      <span className="text-[11.5px] font-extrabold leading-none" style={{ color: text }}>
        {loading ? "…" : isDone ? step.done : isActive ? step.wait : "—"}
      </span>
    </li>
  )
}

/* The rail between steps. It fills only when the step before it is genuinely
   complete, so a half-filled rail reads as "this is where the day stopped". */
function Connector({ filled }) {
  return (
    <li aria-hidden className="mt-[22px] h-[3px] w-6 shrink-0 overflow-hidden rounded-full bg-border sm:w-10">
      <span
        className="block h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: filled ? "100%" : "0%",
          background: "linear-gradient(90deg,#16A34A,var(--brand-accent))",
        }}
      />
    </li>
  )
}

export default function TodayStatusPills({ todayStatus, loading }) {
  const opening = Boolean(todayStatus?.openingDip)
  const closing = Boolean(todayStatus?.closingDip)
  const cash = Boolean(todayStatus?.cashierRecon)

  const stateOf = key => {
    if (key === "opening") return opening ? "done" : "active"
    if (key === "closing") return closing ? "done" : opening ? "active" : "locked"
    return cash ? "done" : closing ? "active" : "locked"
  }

  const allDone = opening && closing && cash

  return (
    <div className="rounded-panel border border-border bg-white px-4 py-4 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[12.5px] font-extrabold tracking-[-0.01em] text-ink">
          Today&rsquo;s close-out
        </h3>
        {!loading && (
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-extrabold"
            style={
              allDone
                ? { background: "#F0FDF4", color: "#16A34A" }
                : { background: "var(--brand-accent-light)", color: "var(--brand-accent-dark)" }
            }
          >
            {allDone ? "Complete" : `${[opening, closing, cash].filter(Boolean).length} of 3`}
          </span>
        )}
      </div>

      <ol className="flex items-start justify-center">
        {STEPS.map((step, i) => (
          <React.Fragment key={step.key}>
            {i > 0 && (
              <Connector
                filled={i === 1 ? opening : closing}
              />
            )}
            <Step step={step} state={stateOf(step.key)} loading={loading} />
          </React.Fragment>
        ))}
      </ol>
    </div>
  )
}
