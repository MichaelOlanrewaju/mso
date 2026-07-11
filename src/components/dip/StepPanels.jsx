import React from "react"

const DOT_COLOR = { PMS: "#179DD0", AGO: "#179DD0", LPG: "#7C3AED" }

export function TankStepPanel({ cfg, tankState, mode, onTankChange, price }) {
  const unit = cfg.unit || "L"
  const s = tankState[cfg.id]
  const value = mode === "open" ? s.open : s.close
  // A tank's level only ever goes DOWN as fuel is sold (opposite of a
  // pump meter, which counts up) — so closing <= opening is the normal
  // case. Closing exactly equal to opening is a legitimate zero-sales
  // day for that tank, not an error; only closing being HIGHER than
  // opening (which would mean the tank refilled itself) is a real
  // mistake worth flagging.
  const dipDiff = mode === "close" && s.open > 0 && s.close > 0 && s.open >= s.close ? s.open - s.close : 0
  const errClose = mode === "close" && s.close > 0 && s.open > 0 && s.close > s.open
  const pct = s.open > 0 ? Math.round((s.open / cfg.cap) * 100) : 0

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px]"
          style={{ background: cfg.product === "AGO" ? "#EAF6FC" : cfg.product === "LPG" ? "#F5F3FF" : "#EAF6FC" }}
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
          <span className="font-mono text-[15px] font-bold text-ink">{s.open.toLocaleString("en-NG")}{unit}</span>
        </div>
      )}

      <input
        id="mainInp"
        type="number"
        inputMode="decimal"
        value={value || ""}
        onChange={e => onTankChange(cfg.id, mode === "open" ? "open" : "close", e.target.value)}
        placeholder="0"
        className={`w-full rounded-[16px] border-2 bg-surface px-4 py-4 text-right font-mono text-[28px] font-extrabold text-ink outline-none transition-all focus:bg-white focus:ring-[4px] ${
          errClose ? "border-red focus:ring-red/10" : "border-border focus:border-cyan focus:ring-cyan/10"
        }`}
      />

      {errClose && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-red">
          <i className="bi bi-exclamation-circle" /> Closing cannot be higher than opening
        </div>
      )}
      {!errClose && s.close > 0 && mode === "close" && s.close === s.open && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink-3">
          <i className="bi bi-info-circle" /> No change from opening — nothing sold from this tank today
        </div>
      )}
      {!errClose && s.close > 0 && mode === "close" && s.close < s.open && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-green">
          <i className="bi bi-check-circle" /> Valid · Diff: {dipDiff.toLocaleString("en-NG", { maximumFractionDigits: 2 })}{unit}
        </div>
      )}

      {dipDiff > 0 && (
        <>
          <div
            className="mt-3 flex items-center justify-between rounded-[14px] px-4 py-3 text-white shadow-card"
            style={{ background: "linear-gradient(135deg, #130656, #179DD0)" }}
          >
            <span className="text-[12.5px] font-semibold text-white/90">Dip difference</span>
            <span className="font-mono text-[14px] font-bold text-white">{dipDiff.toLocaleString("en-NG", { maximumFractionDigits: 2 })}{unit}</span>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-[14px] bg-green-light px-4 py-3">
            <span className="text-[12.5px] font-semibold text-green">Expected revenue</span>
            <span className="font-mono text-[14px] font-bold text-green">₦{Math.round(dipDiff * price).toLocaleString("en-NG")}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-[12px] bg-surface px-4 py-2.5 text-[11.5px] font-medium text-ink-4">
            <i className="bi bi-info-circle" /> Margin vs pump metres will show on the Records page once Sales is submitted for this date.
          </div>
        </>
      )}
    </div>
  )
}
