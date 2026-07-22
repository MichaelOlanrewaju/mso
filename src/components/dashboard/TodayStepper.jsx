import React from "react"

/**
 * The day's real workflow as one accurate sequence: Opening Dip → Pump
 * Readings → Closing Dip → Cash Reconciliation. Replaces two things that used
 * to disagree with each other — a 3-pill status row that only tracked dips,
 * and a separate CTA button using the same dip-only logic — which meant the
 * button could say "Both readings submitted ✓" while pump readings sat empty.
 * One accurate source of truth, and the first incomplete step is always the
 * one thing to tap next.
 */
export default function TodayStepper({ steps, onStepClick }) {
  const currentIndex = steps.findIndex(s => !s.done)
  const allDone = currentIndex === -1
  const current = allDone ? null : steps[currentIndex]

  return (
    <div className="mb-5 overflow-hidden rounded-[16px] bg-white shadow-lift">
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-[10px] font-bold uppercase tracking-[1px] text-ink-4">Today's Progress</span>
        <span className="text-[10px] font-bold text-ink-4">
          {steps.filter(s => s.done).length}/{steps.length} done
        </span>
      </div>

      {/* Step row: each node is a dot + label; a line connects them, filling
          in as steps complete. Tapping any step jumps straight to it. */}
      <div className="flex items-start px-4 pb-3 pt-3">
        {steps.map((step, i) => {
          const isDone = step.done
          const isCurrent = i === currentIndex
          return (
            <React.Fragment key={step.key}>
              <button
                type="button"
                onClick={() => onStepClick(step)}
                className="flex flex-1 flex-col items-center gap-1.5"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition-all"
                  style={
                    isDone
                      ? { background: "#16A34A", color: "#fff" }
                      : isCurrent
                      ? { background: "var(--brand-gradient-btn)", color: "#fff", boxShadow: "0 0 0 4px var(--brand-accent-light)" }
                      : { background: "var(--pagebg)", color: "var(--text-muted)" }
                  }
                >
                  <i className={`bi ${isDone ? "bi-check-lg" : step.icon}`} />
                </div>
                <span
                  className="text-center text-[9.5px] font-bold leading-tight"
                  style={{ color: isDone ? "#16A34A" : isCurrent ? "var(--brand-primary)" : "var(--text-muted)" }}
                >
                  {step.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div className="mt-4 h-[2px] flex-1 rounded-full" style={{ background: isDone ? "#16A34A" : "var(--pagebg)" }} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* The one obvious next action — or a clean "done" state. */}
      <button
        type="button"
        onClick={() => current && onStepClick(current)}
        disabled={allDone}
        className="flex h-[52px] w-full items-center gap-2.5 px-4 text-[14px] font-bold text-white disabled:opacity-100"
        style={{ background: allDone ? "#16A34A" : "var(--brand-gradient-btn)" }}
      >
        {allDone ? (
          <>
            <i className="bi bi-check-circle-fill" />
            <span className="flex-1 text-left">All caught up for today</span>
          </>
        ) : (
          <>
            <i className={`bi ${current.icon}`} />
            <span className="flex-1 text-left">{current.cta}</span>
            <i className="bi bi-arrow-right" />
          </>
        )}
      </button>
    </div>
  )
}
