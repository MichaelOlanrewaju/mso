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

const DOT_COLOR = { PMS: "var(--brand-accent)", AGO: "var(--brand-accent)", LPG: "#7C3AED" }

export function TankStepPanel({ cfg, tankState, mode, onTankChange, price }) {
  const unit = cfg.unit || "L"
  const s = tankState[cfg.id]
  const value = mode === "open" ? s.open : s.close
  // A tank's level only ever goes DOWN as fuel is sold (opposite of a
  // pump meter, which counts up) — so closing <= opening is the normal
  // case. Closing exactly equal to opening is a legitimate zero-sales
  // day for that tank, not an error; only closing being HIGHER than
  // opening (which would mean the tank refilled itself) is a real
  // mistake worth flagging. If a delivery happened today, the opening
  // reading itself already includes it — saveDischarge bumps it directly
  // the moment a delivery is recorded — so this stays a plain comparison.
  const entered = v => v !== "" && v !== null && v !== undefined && !Number.isNaN(Number(v))
  const dipDiff = mode === "close" && entered(s.open) && entered(s.close) && Number(s.open) >= Number(s.close) ? Number(s.open) - Number(s.close) : 0
  const errClose = mode === "close" && entered(s.close) && entered(s.open) && Number(s.close) > Number(s.open)
  const pct = Number(s.open) > 0 ? Math.round((Number(s.open) / cfg.cap) * 100) : 0

  return (
    <div>
      <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px]"
          style={{ background: cfg.product === "AGO" ? "var(--brand-accent-light)" : cfg.product === "LPG" ? "#F5F3FF" : "var(--brand-accent-light)" }}
        >
          <i className={`bi ${cfg.product === "LPG" ? "bi-fire" : "bi-water"} text-xl`} style={{ color: DOT_COLOR[cfg.product] }} />
        </div>
        <div>
          <div className="text-[16px] font-extrabold text-ink">{cfg.id} — {cfg.product}</div>
          <div className="flex items-center gap-1.5 text-[12px] text-ink-4">
            Feeds {cfg.pumps.join(", ")}
            {mode === "open" && pct > 0 && <span className="font-mono text-ink-3">· {pct}% capacity</span>}
          </div>
        </div>
      </div>

      <div className="mb-3 text-[10px] font-bold uppercase tracking-[1.2px] text-ink-4">
        {mode === "open" ? "Opening stock reading" : "Closing stock reading"}
      </div>

      {mode === "close" && (
        <div className="mb-3 flex items-center justify-between rounded-[14px] border border-border bg-surface px-4 py-3">
          <span className="text-[12px] font-semibold text-ink-3">Opening (locked)</span>
          <span className="font-mono text-[15px] font-bold text-ink">{litresValue(s.open)}{unit}</span>
        </div>
      )}

      <div className="dip-reading-input-wrap">
        <label htmlFor="mainInp" className="mb-2 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-[1px] text-slate-500">
          <span>{mode === "open" ? "Enter opening dip" : "Enter closing dip"}</span>
          <span className="rounded-md bg-slate-100 px-2 py-1 font-bold normal-case tracking-normal text-slate-600">{unit}</span>
        </label>
      <input
        id="mainInp"
        /* type="text" with inputMode="decimal": still shows the numeric
           keypad on mobile, but avoids the Android/Chrome behaviour where a
           controlled type="number" silently rejects keystrokes mid-edit. */
        type="text"
        inputMode="decimal"
        /* `value || ""` blanked a typed 0 the moment it rendered, so an empty
           tank could never be entered — the digit vanished as you typed it. */
        value={value === 0 || value ? String(value) : ""}
        onChange={e => onTankChange(cfg.id, mode === "open" ? "open" : "close", sanitiseNumeric(e.target.value))}
        placeholder="Enter reading"
        aria-label={`${cfg.id} ${mode === "open" ? "opening" : "closing"} dip reading in ${unit}`}
        aria-invalid={errClose}
        aria-describedby={errClose ? `${cfg.id}-dip-error` : undefined}
        className={`w-full rounded-[12px] border-2 bg-slate-50 px-4 py-4 text-right font-mono text-[28px] font-extrabold text-ink outline-none transition-all focus:bg-white focus:ring-[4px] ${
          errClose ? "border-red focus:ring-red/10" : "border-border focus:border-cyan focus:ring-cyan/10"
        }`}
      />
      <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-slate-500">
        <span>{mode === "open" ? "Measure the physical tank level" : "Measure the remaining tank level"}</span>
        <span className="font-semibold">Enter litres</span>
      </div>
      </div>

      {mode === "open" && (
        <div className="mt-4 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="mb-2 flex items-center justify-between text-[10.5px]">
            <span className="font-semibold text-slate-600">Tank capacity reference</span>
            <span className="font-mono font-bold text-slate-800">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={`${cfg.id} opening reading as a percentage of capacity`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: "var(--brand-accent)" }} />
          </div>
          <div className="mt-1.5 text-right text-[10px] text-slate-500">Capacity: {litresValue(cfg.cap)}{unit}</div>
        </div>
      )}

      {errClose && (
        <div id={`${cfg.id}-dip-error`} role="alert" className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-red">
          <i className="bi bi-exclamation-circle" /> Closing cannot be higher than opening
        </div>
      )}
      {!errClose && entered(s.close) && mode === "close" && Number(s.close) === Number(s.open) && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink-3">
          <i className="bi bi-info-circle" /> No change from opening — nothing sold from this tank today
        </div>
      )}
      {!errClose && entered(s.close) && mode === "close" && Number(s.close) < Number(s.open) && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-green">
          <i className="bi bi-check-circle" /> Valid · Diff: {litresValue(dipDiff)}{unit}
        </div>
      )}

      {dipDiff > 0 && (
        <>
          <div
            className="mt-3 flex items-center justify-between rounded-[14px] px-4 py-3 text-white shadow-card"
            style={{ background: "var(--brand-gradient-btn)" }}
          >
            <span className="text-[12.5px] font-semibold text-white/90">Dip difference</span>
            <span className="font-mono text-[14px] font-bold text-white">{litresValue(dipDiff)}{unit}</span>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-[14px] bg-green-light px-4 py-3">
            <span className="text-[12.5px] font-semibold text-green">Expected revenue</span>
            <span className="font-mono text-[14px] font-bold text-green">{naira(dipDiff * price)}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-[12px] bg-surface px-4 py-2.5 text-[11.5px] font-medium text-ink-4">
            <i className="bi bi-info-circle" /> Margin vs pump metres will show on the Records page once Sales is submitted for this date.
          </div>
        </>
      )}
    </div>
  )
}
