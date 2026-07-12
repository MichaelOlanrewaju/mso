import React from "react"

/**
 * Presence dot.
 *
 * "Online" here means: this person's app sent a heartbeat within the
 * last two minutes. It is deliberately NOT a claim that they're looking
 * at their screen this second — the backend polls, it doesn't hold a
 * socket open, so a stronger claim would be a lie. The tooltip says
 * "Active recently" for the same reason.
 */
export default function OnlineIndicator({ online, size = 13, ring = "#fff" }) {
  if (!online) return null
  return (
    <span
      title="Active recently"
      aria-label="Active recently"
      className="absolute -bottom-0.5 -right-0.5 block rounded-full animate-pulse-dot"
      style={{
        width: size,
        height: size,
        background: "#22C55E",
        boxShadow: `0 0 0 2.5px ${ring}`,
      }}
    />
  )
}
