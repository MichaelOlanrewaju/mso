import React from "react"

/**
 * Unread count pill.
 *
 * Backed by a real read cursor (ChatReads on the backend), not a guess:
 * a message counts here only if it arrived after this user last opened
 * the conversation, someone else sent it, and they haven't hidden it.
 */
export default function UnreadBadge({ count, muted = false }) {
  if (!count) return null
  return (
    <span
      aria-label={`${count} unread message${count === 1 ? "" : "s"}`}
      className="flex h-[20px] min-w-[20px] flex-shrink-0 items-center justify-center rounded-full px-1.5 text-[10.5px] font-extrabold tabular-nums text-white"
      style={{
        background: muted ? "#94A3B8" : "linear-gradient(135deg,#179DD0 0%,#1188B5 100%)",
        boxShadow: muted ? "none" : "0 2px 8px rgba(23,157,208,.40)",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}
