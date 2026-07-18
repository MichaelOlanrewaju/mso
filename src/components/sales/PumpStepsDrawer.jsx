import React from "react"

export default function PumpStepsDrawer({ open, onClose, steps, current, mode, readings, onJump }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1060] flex items-end">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative z-[1] max-h-[78vh] w-full overflow-y-auto rounded-t-[20px] bg-white" style={{ paddingBottom: "calc(16px + var(--sab))" }}>
        <div className="mx-auto mt-3 h-[3.5px] w-[38px] rounded-sm bg-border" />
        <div className="flex items-center justify-between px-[18px] pb-2 pt-3.5">
          <div className="text-base font-extrabold text-ink">Pump Steps</div>
          <button type="button" onClick={onClose} className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-surface text-lg text-ink-3">
            ×
          </button>
        </div>

        <div className="flex flex-col gap-1.5 px-3.5 pb-3 pt-1">
          {steps.map((step, i) => {
            const pump = step.pump
            const isCurrent = i === current
            const r = readings[pump.id] || { open: "", close: "" }
            const done = Number(r[mode === "open" ? "open" : "close"]) > 0

            return (
              <button
                key={pump.id}
                type="button"
                onClick={() => {
                  onJump(i)
                  onClose()
                }}
                className={`flex items-center gap-3 rounded-[12px] border px-3.5 py-3 text-left transition-all ${
                  isCurrent ? "border-cyan/30 bg-cyan-light" : "border-border bg-white hover:bg-surface"
                }`}
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] text-[12px] font-extrabold"
                  style={pump.product === "AGO" ? { background: "var(--brand-accent-light)", color: "var(--brand-accent)" } : { background: "var(--brand-accent-light)", color: "var(--brand-accent-dark)" }}
                >
                  {pump.pumpId || pump.id}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-ink">Pump {pump.pumpId || pump.id} — {pump.product}</div>
                  <div className="text-[10.5px] text-ink-4">{pump.tank}</div>
                </div>
                {done && <i className="bi bi-check-circle-fill text-green" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
