import React from "react"
import { motion } from "../motion"

// Tiny dependency-free sparkline — just enough to show "this number has
// a recent shape", not a full chart. Lives in its own file so it's easy
// to swap for recharts/etc. later without touching KpiGrid.
export default function Sparkline({ values, stroke = "var(--brand-accent)", width = 72, height = 26 }) {
  if (!values || values.length < 2) return null

  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return [x, y]
  })

  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const [lastX, lastY] = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <motion.path key={path} d={path} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1], delay: 0.3 }} />
      <motion.circle key={`c${path}`} cx={lastX} cy={lastY} r="2.5" fill={stroke}
        initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 1.1 }} />
    </svg>
  )
}
