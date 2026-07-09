import React from "react"

export default function FuelGauge({ level = 68, caption = "Live tank monitoring, 24/7" }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[230px] w-[108px]">
        {/* tick marks */}
        <div className="absolute -left-4 top-0 flex h-full flex-col justify-between py-1 text-[8px] font-bold text-white/20">
          <span>100</span>
          <span>50</span>
          <span>0</span>
        </div>

        {/* gauge shell */}
        <div className="relative h-full w-full overflow-hidden rounded-[54px] border border-white/15 bg-white/[0.04] shadow-[inset_0_2px_18px_rgba(0,0,0,.35)]">
          {/* liquid fill */}
          <div
            className="animate-gauge-rise absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-dark to-cyan"
            style={{ "--gauge-level": `${level}%` }}
          >
            <div className="animate-gauge-wave absolute -top-2 left-[-10%] h-4 w-[120%] rounded-[50%] bg-cyan-dark/70" />
          </div>

          {/* glass highlight */}
          <div className="pointer-events-none absolute inset-y-3 left-2 w-[3px] rounded-full bg-white/15" />
        </div>

        {/* readout */}
        <div className="absolute inset-x-0 bottom-7 text-center">
          <div className="mono text-2xl font-extrabold text-white drop-shadow-[0_1px_6px_rgba(0,0,0,.4)]">
            {level}%
          </div>
        </div>
      </div>

      <div className="mt-4 text-center text-[11px] font-medium text-white/40">{caption}</div>
    </div>
  )
}
