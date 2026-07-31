import React from "react"
import { litresValue, naira } from "../../utils/format"

/* type="text" accepts anything, so keep it numeric: digits plus at most one
   decimal point. Returning "" for an empty box preserves the blank-vs-zero
   distinction the rest of the dip logic depends on. */
function sanitiseNumeric(raw) {
  const cleaned = String(raw).replace(/[^\d.]/g, "")
  const parts = cleaned.split(".")
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned
}

export function PumpStepPanel({ pump, readings, mode, onChange, price }) {
  const isAgo = pump.product === "AGO"
  const isLpg = pump.product === "LPG"
  const unit = pump.unit || "L"
  const r = readings[pump.id] || { open: "", close: "" }
  const openEntered = r.open !== "" && r.open !== null && r.open !== undefined
  const closeEntered = r.close !== "" && r.close !== null && r.close !== undefined
  const op = Number(r.open) || 0
  const cl = Number(r.close) || 0
  const value = mode === "open" ? r.open : r.close
  const diff = mode === "close" && openEntered && cl > 0 && cl >= op ? cl - op : 0
  // Equal readings are valid — it means this pump had zero sales that
  // day (broken, unused, whatever the reason). Pump meters only ever
  // count up, so the only real error is Closing being LOWER than
  // Opening, not equal to it.
  const errClose = mode === "close" && closeEntered && openEntered && cl < op
  /* Opening genuinely never entered — this used to show "Opening (locked):
     0L" as if that were a real, legitimate reading, then silently let
     Closing be submitted against it. That's exactly what turned a pump's
     entire lifetime cumulative meter reading into "today's sales" on a
     real day. Flagged clearly now instead of quietly defaulting. */
  const missingOpen = mode === "close" && !openEntered

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px]"
          style={{ background: isAgo ? "var(--brand-accent-light)" : isLpg ? "#F5F3FF" : "var(--brand-accent-light)" }}
        >
          <i className={`bi ${isLpg ? "bi-fire" : "bi-speedometer2"} text-xl`} style={{ color: isAgo ? "var(--brand-accent)" : isLpg ? "#7C3AED" : "var(--brand-accent)" }} />
        </div>
        <div>
          <div className="text-[16px] font-extrabold text-ink">Pump {pump.pumpId || pump.id} — {pump.product}</div>
          <div className="text-[12px] text-ink-4">{pump.tank}</div>
        </div>
      </div>

      <div className="mb-3 text-[10px] font-bold uppercase tracking-[1.2px] text-ink-4">
        {mode === "open" ? "Opening metre reading" : "Closing metre reading"}
      </div>

      {mode === "close" && (
        missingOpen ? (
          <div className="mb-3 flex items-center gap-2 rounded-[14px] border border-red/30 bg-red-light px-4 py-3">
            <i className="bi bi-exclamation-triangle-fill text-red" />
            <span className="text-[12.5px] font-bold text-red">No opening reading on file — enter it before closing</span>
          </div>
        ) : (
          <div className="mb-3 flex items-center justify-between rounded-[14px] border border-border bg-surface px-4 py-3">
            <span className="text-[12px] font-semibold text-ink-3">Opening (locked)</span>
            <span className="font-mono text-[15px] font-bold text-ink">{litresValue(op)}{unit}</span>
          </div>
        )
      )}

      <input
        id="mainInp"
        /* type="text" with inputMode="decimal": still shows the numeric
           keypad on mobile, but avoids the Android/Chrome behaviour where a
           controlled type="number" silently rejects keystrokes mid-edit. */
        type="text"
        inputMode="decimal"
        /* Same fix as the dip panel: `|| ""` erased a typed 0 on render, so a
           pump meter genuinely reading 0 could not be recorded. */
        value={value === 0 || value ? String(value) : ""}
        onChange={e => onChange(pump.id, mode === "open" ? "open" : "close", sanitiseNumeric(e.target.value))}
        placeholder="Enter reading"
        className={`w-full rounded-[16px] border-2 bg-surface px-4 py-4 text-right font-mono text-[28px] font-extrabold text-ink outline-none transition-all focus:bg-white focus:ring-[4px] ${
          errClose || missingOpen ? "border-red focus:ring-red/10" : "border-border focus:border-cyan focus:ring-cyan/10"
        }`}
      />

      {missingOpen && closeEntered && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-red">
          <i className="bi bi-exclamation-circle" /> Can't save this — go back to Opening mode and enter it first
        </div>
      )}
      {!missingOpen && errClose && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-red">
          <i className="bi bi-exclamation-circle" /> Closing cannot be lower than opening
        </div>
      )}
      {!missingOpen && !errClose && cl > 0 && mode === "close" && cl === op && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink-3">
          <i className="bi bi-info-circle" /> No sales from this pump today — readings match
        </div>
      )}
      {!missingOpen && !errClose && cl > 0 && mode === "close" && cl > op && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-green">
          <i className="bi bi-check-circle" /> Valid · Diff: {litresValue(diff)}{unit}
        </div>
      )}

      {diff > 0 && (
        <>
          <div
            className="mt-3 flex items-center justify-between rounded-[14px] px-4 py-3 text-white shadow-card"
            style={{ background: "var(--brand-gradient-btn)" }}
          >
            <span className="text-[12.5px] font-semibold text-white/90">Pump difference</span>
            <span className="font-mono text-[14px] font-bold text-white">{litresValue(diff)}{unit}</span>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-[14px] bg-green-light px-4 py-3">
            <span className="text-[12.5px] font-semibold text-green">Revenue</span>
            <span className="font-mono text-[14px] font-bold text-green">{naira(diff * price)}</span>
          </div>
        </>
      )}
    </div>
  )
}
