import React, { useEffect, useRef, useState } from "react"
import {
  motion, AnimatePresence, MotionConfig, useReducedMotion,
  useMotionValue, animate, useInView,
} from "framer-motion"

/* Shared motion language for the whole console.
   - Short (150–450ms), ease-out, no bounce.
   - <MotionRoot> sets reducedMotion="user", so every motion component below
     drops transform/layout animation automatically for people who ask for it.
   - Everything here is presentation only; no data, API or permission logic. */

export const EASE = [0.2, 0.7, 0.2, 1]
export const SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.7 }

export function MotionRoot({ children }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: 0.28, ease: EASE }}>{children}</MotionConfig>
}

/* Route change: quick fade + 8px rise. Ends at transform:none so sticky and
   fixed children keep behaving. */
export function PageTransition({ children, routeKey }) {
  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/* Staggered list/grid entrance. */
const staggerParent = (gap, delay) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
})
const staggerChild = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE } },
}
export function Stagger({ as = "div", gap = 0.055, delay = 0, className, style, children, ...rest }) {
  const Comp = motion[as] || motion.div
  return (
    <Comp className={className} style={style} variants={staggerParent(gap, delay)} initial="hidden" animate="show" {...rest}>
      {children}
    </Comp>
  )
}
export function StaggerItem({ as = "div", className, style, children, ...rest }) {
  const Comp = motion[as] || motion.div
  return <Comp className={className} style={style} variants={staggerChild} {...rest}>{children}</Comp>
}

/* Fade/rise in when scrolled into view (long pages). */
export function Reveal({ children, className, delay = 0, as = "div" }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "0px 0px -8% 0px" })
  const Comp = motion[as] || motion.div
  return (
    <Comp ref={ref} className={className} initial={{ opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.4, ease: EASE, delay }}>
      {children}
    </Comp>
  )
}

/* Expandable section: height + opacity. */
export function Collapse({ open, children, className }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="c" className={className} style={{ overflow: "hidden" }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.26, ease: EASE }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* Smooth swap between loading / content / empty / error. Give each state a
   distinct `stateKey`. */
export function StateSwap({ stateKey, children, className }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={stateKey} className={className}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: EASE }}>
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/* Modal / bottom-sheet shell: fading scrim + panel. `sheet` = slides from the
   bottom on phones. Parent keeps its own markup for the panel content. */
export function ModalLayer({ open, onClose, children, scrimClassName = "fixed inset-0 z-[999] bg-black/55 backdrop-blur-sm", className = "", panelClassName = "", sheet = true, style }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="scrim" className={`${scrimClassName} ${className}`} style={style}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }} onClick={onClose}>
          <motion.div className={panelClassName} onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, y: sheet ? 36 : 12, scale: sheet ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: sheet ? 28 : 8, scale: sheet ? 1 : 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* Count-up for pre-formatted figures like "₦1,234,567", "12,300.5 L", "-4.2%".
   The first numeric run is animated; prefix, suffix, grouping and decimals are
   preserved, so the end state is always exactly the string it was given. */
const NUM_RE = /(\d[\d,]*)(\.\d+)?/
export function CountUp({ value, duration = 0.9, className, style }) {
  const reduce = useReducedMotion()
  const text = value == null ? "" : String(value)
  const m = typeof value === "number" || typeof value === "string" ? NUM_RE.exec(text) : null
  const [shown, setShown] = useState(text)
  const prev = useRef(null)
  const mv = useMotionValue(0)

  useEffect(() => {
    if (!m || reduce) { setShown(text); prev.current = m ? parseFloat(m[0].replace(/,/g, "")) : null; return }
    const target = parseFloat(m[0].replace(/,/g, ""))
    if (!isFinite(target)) { setShown(text); return }
    const decimals = m[2] ? m[2].length - 1 : 0
    const grouped = m[1].includes(",")
    const from = prev.current ?? 0
    const before = text.slice(0, m.index), after = text.slice(m.index + m[0].length)
    mv.set(from)
    const fmt = n => {
      const s = n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped })
      return before + s + after
    }
    const ctl = animate(mv, target, {
      duration, ease: EASE,
      onUpdate: v => setShown(fmt(v)),
      onComplete: () => { setShown(text); prev.current = target },
    })
    return () => { ctl.stop(); prev.current = target }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduce])

  return <span className={className} style={{ fontVariantNumeric: "tabular-nums", ...style }}>{m ? shown : text}</span>
}

/* Convenience: animate a node if it is a plain string/number, else pass through. */
export function AnimatedValue({ children }) {
  if (typeof children === "string" || typeof children === "number") return <CountUp value={children} />
  return children
}

AnimatedValue.Styled = function Styled({ style, children }) {
  return <CountUp value={children} style={style} />
}

/* Skeleton block with the app's existing shimmer. */
export function Skeleton({ className = "", dark = false, style }) {
  return <span className={`${dark ? "skel-dark" : "skel"} inline-block ${className}`} style={style} />
}

export { motion, AnimatePresence, useReducedMotion }
