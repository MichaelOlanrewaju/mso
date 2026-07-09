import React from "react"

const TOP_BAR = {
  hero: "from-deepnavy to-cyan",
  cyan: "from-deepnavy to-cyan",
  green: "from-[#059669] to-[#34D399]",
  amber: "from-[#B45309] to-[#F59E0B]",
  red: "from-[#991B1B] to-[#F87171]",
}

export default function KpiCard({
  variant = "cyan",
  icon,
  iconBg,
  iconColor,
  label,
  value,
  foot,
  loading,
  delay = 0,
  signature, // optional node — only the hero card uses this (sparkline)
}) {
  const isHero = variant === "hero"

  return (
    <div
      className={`enter relative overflow-hidden rounded-card border px-5 py-[18px] transition-all duration-300 hover:-translate-y-[3px]
        ${
          isHero
            ? "dot-grid border-deepnavy-2 shadow-hero hover:shadow-hero"
            : "border-border bg-white shadow-card hover:shadow-lift"
        }`}
      style={
        isHero
          ? { animationDelay: `${delay}ms`, background: "linear-gradient(135deg, #130656 0%, #1a0875 55%, #179DD0 160%)" }
          : { animationDelay: `${delay}ms` }
      }
    >
      <span className={`absolute inset-x-0 top-0 h-[3px] rounded-t-card bg-gradient-to-r ${TOP_BAR[variant]}`} />

      {/* Signature moment: a slow light sweep across the hero tile only —
          a quiet "this is live" cue, not a flashy loop. */}
      {isHero && (
        <span
          aria-hidden
          className="animate-sheen pointer-events-none absolute inset-y-0 left-0 z-[1] w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
        />
      )}

      <div className="relative z-[2] flex items-start justify-between gap-3">
        <div
          className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-[9px] text-[17px]"
          style={{ background: iconBg }}
        >
          <i className={`bi ${icon}`} style={{ color: iconColor }} />
        </div>
        {isHero && signature && !loading && <div className="opacity-90">{signature}</div>}
      </div>

      <div
        className={`relative z-[2] mb-[5px] text-[9.5px] font-bold uppercase tracking-[1.2px] ${
          isHero ? "text-white/[0.4]" : "text-ink-4"
        }`}
      >
        {label}
      </div>

      <div
        className={`relative z-[2] mono mb-2 font-bold leading-none tracking-[-0.02em] ${
          isHero ? "text-[26px] text-white" : "text-[22px] text-ink"
        }`}
      >
        {loading ? (
          <span className={`${isHero ? "skel-dark" : "skel"} inline-block h-6 w-[110px] align-middle`} />
        ) : (
          value
        )}
      </div>

      <div
        className={`relative z-[2] flex items-center gap-[5px] text-[11px] ${
          isHero ? "text-white/[0.36]" : "text-ink-3"
        }`}
      >
        {loading ? (
          <span className={`${isHero ? "skel-dark" : "skel"} inline-block h-3.5 w-20`} />
        ) : (
          foot
        )}
      </div>
    </div>
  )
}
