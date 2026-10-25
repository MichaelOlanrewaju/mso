import React from "react"
import { motion, AnimatePresence, AnimatedValue, EASE } from "../motion"

const EDGE = {
  hero: "var(--brand-accent)",
  cyan: "var(--brand-accent)",
  green: "#22C55E",
  amber: "#FACC15",
  red: "#FB923C",
}
const TOP_BAR = {
  hero: "from-deepnavy to-cyan",
  cyan: "from-deepnavy to-cyan",
  green: "from-[#059669] to-[#34D399]",
  amber: "from-[#1188B5] to-[var(--brand-accent)]",
  red: "from-[#991B1B] to-[#F87171]",
}

/* A <span style=...>text</span> value (how KpiGrid passes pending/muted styling)
   is unwrapped so its text can count up while keeping its style. */
function countable(v) {
  if (React.isValidElement(v) && v.type === "span" && typeof v.props.children === "string") {
    return <AnimatedValue.Styled style={v.props.style}>{v.props.children}</AnimatedValue.Styled>
  }
  return v
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
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: delay / 1000 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      onPointerMove={e => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`)
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`)
      }}
      className={`relative overflow-hidden mso-kpi rounded-card border px-5 py-[18px] transition-shadow duration-300
        ${
          isHero
            ? "dot-grid border-deepnavy-2 shadow-hero hover:shadow-hero"
            : "border-border bg-white shadow-card hover:shadow-lift"
        }`}
      style={
        isHero
          ? { background: "var(--brand-gradient-btn)" }
          : undefined
      }
    >
      {isHero
        ? <span className={`absolute inset-x-0 top-0 h-[3px] rounded-t-card bg-gradient-to-r ${TOP_BAR[variant]}`} />
        : <motion.span aria-hidden className="absolute inset-y-0 left-0 w-[4px] origin-top" style={{ background: EDGE[variant] }}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.5, ease: EASE, delay: 0.2 + delay / 1000 }} />}
      {/* Cursor spotlight — a soft glow that follows the pointer. */}
      <span aria-hidden className="mso-spot pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300" />

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
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.span key="l" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className={`${isHero ? "skel-dark" : "skel"} inline-block h-6 w-[110px] align-middle`} />
          ) : (
            <motion.span key="v" className="inline-block" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <AnimatedValue>{countable(value)}</AnimatedValue>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div
        className={`relative z-[2] flex items-center gap-[5px] text-[11px] ${
          isHero ? "text-white/[0.36]" : "text-ink-3"
        }`}
      >
        {loading ? (
          <span className={`${isHero ? "skel-dark" : "skel"} inline-block h-3.5 w-20`} />
        ) : (
          <motion.span className="inline-flex items-center gap-[5px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>{foot}</motion.span>
        )}
      </div>
    </motion.div>
  )
}
