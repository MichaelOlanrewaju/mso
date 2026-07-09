import React, { useEffect, useState } from "react"

/**
 * Visual safe-area debug tool — v2, fixed to not collide with page content.
 *
 * Default state: a tiny dot in the top-right corner, out of the way of
 * any header content. Tap it to expand a small floating readout panel
 * (not a full-width strip) showing the actual --sat/--sab/--sal values.
 *
 * Usage: <SafeAreaDebug /> anywhere in a page's JSX.
 */
export default function SafeAreaDebug() {
  const [open, setOpen] = useState(false)
  const [vals, setVals] = useState({ sat: "0px", sab: "0px", sal: "0px" })

  useEffect(() => {
    const probe = document.createElement("div")
    probe.style.cssText =
      "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;" +
      "padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);"
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    setVals({ sat: cs.paddingTop, sab: cs.paddingBottom, sal: cs.paddingLeft })
    document.body.removeChild(probe)
  }, [])

  return (
    <>
      {/* Small dot, anchored well above any bottom nav/action bar using the
          real safe-area-bottom variable plus generous clearance, rather
          than a guessed fixed pixel value that breaks on taller bars
          (like the Dip wizard's Save & Continue bar). */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Toggle safe-area debug"
        className="fixed right-3 z-[9999] flex h-7 w-7 items-center justify-center rounded-full text-[11px] shadow-lift"
        style={{ bottom: "calc(140px + var(--sab))", background: open ? "#DC2626" : "rgba(0,0,0,.4)", color: "#fff" }}
      >
        <i className="bi bi-rulers" />
      </button>

      {open && (
        <div
          className="fixed right-3 z-[9999] w-[200px] rounded-[12px] p-3 font-mono text-[10px] text-white shadow-lift"
          style={{ bottom: "calc(174px + var(--sab))", background: "rgba(0,0,0,.85)" }}
        >
          <div className="mb-1.5 font-bold">Safe-area (this device)</div>
          <div>sat (top): {vals.sat}</div>
          <div>sab (bottom): {vals.sab}</div>
          <div>sal (left): {vals.sal}</div>
          <div className="mt-1.5 text-white/60">
            {vals.sat === "0px"
              ? "0px = browser tab, or non-notched. Our 22px fallback is doing the work."
              : "Device safe-area active (likely installed PWA)."}
          </div>
        </div>
      )}
    </>
  )
}
