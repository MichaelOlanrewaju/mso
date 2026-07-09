import React from "react"

export default function StepsDrawer({ open, onClose, steps, current, mode, tankState, onJump }) {
  if (!open) return null

  const valueFor = step => {
    const s = tankState[step.cfg.id]
    const v = mode === "open" ? s.open : s.close
    return v > 0 ? `${v.toLocaleString("en-NG")}L` : "—"
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-end bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="max-h-[75vh] w-full overflow-y-auto rounded-t-[24px] bg-white p-5"
        style={{ paddingBottom: "calc(20px + var(--sab))" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <div className="mb-4 text-[16px] font-extrabold text-ink">All steps</div>
        <div className="flex flex-col gap-1.5">
          {steps.map((step, i) => {
            const isDone = i < current
            const isNow = i === current
            const label = `${step.cfg.id} — ${mode === "open" ? "Opening" : "Closing"} Stock`
            const sub = `${step.cfg.product} · Feeds ${step.cfg.pumps.join(", ")}`

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onClose()
                  onJump(i)
                }}
                className={`flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-all ${
                  isNow ? "border-cyan/40 bg-cyan-light" : "border-border bg-white hover:bg-surface"
                }`}
              >
                <div
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    isDone ? "bg-green text-white" : isNow ? "bg-cyan text-white" : "bg-surface text-ink-4"
                  }`}
                >
                  {isDone ? <i className="bi bi-check" /> : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-bold text-ink">{label}</div>
                  <div className="truncate text-[10.5px] text-ink-4">{sub}</div>
                </div>
                <div className="flex-shrink-0 font-mono text-[12px] font-semibold text-ink-2">{valueFor(step)}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
