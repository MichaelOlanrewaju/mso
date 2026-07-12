import React from "react"
import { HEADER_GRADIENT, greetingFor, firstName } from "./tokens"

/**
 * Premium gradient header for the Chat List.
 *
 * The "notification" affordance is wired to the real thing this app has —
 * the dashboard — rather than inventing a notification feed that no
 * endpoint backs. It shows a live dot only when there is genuinely
 * something unseen (a conversation newer than this user's last visit),
 * which `unseenCount` supplies from real timestamps.
 */
export default function ChatHeader({ name, role, unseenCount = 0, onDashboard, children }) {
  return (
    <header
      className="relative flex-shrink-0 overflow-hidden rounded-b-[24px] px-5 pb-5"
      style={{ paddingTop: "max(var(--sat), 52px)", background: HEADER_GRADIENT }}
    >
      {/* Ambient light — two soft blooms give the gradient depth instead of
          a flat diagonal wash. Pointer-events off so they never eat taps. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-10 h-52 w-52 rounded-full"
        style={{ background: "radial-gradient(circle,rgba(23,157,208,.45),transparent 68%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 bottom-[-70px] h-56 w-56 rounded-full"
        style={{ background: "radial-gradient(circle,rgba(124,58,237,.28),transparent 70%)" }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-white/60">
            {greetingFor()}
          </p>
          <h1 className="mt-0.5 truncate text-[23px] font-extrabold leading-tight tracking-[-0.02em] text-white">
            {firstName(name) || "there"}
          </h1>
          {role && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold capitalize text-white/75 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
              {role} · MSO Station
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onDashboard}
          aria-label={
            unseenCount > 0
              ? `Back to dashboard. ${unseenCount} unread message${unseenCount === 1 ? "" : "s"}`
              : "Back to dashboard"
          }
          className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] border border-white/20 bg-white/10 text-white backdrop-blur-md transition-transform duration-150 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 active:scale-95"
        >
          <i className="bi bi-grid text-[16px]" />
          {unseenCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white"
              style={{ background: "#DC2626", boxShadow: "0 0 0 2px #170a5e" }}
            >
              {unseenCount > 9 ? "9+" : unseenCount}
            </span>
          )}
        </button>
      </div>

      {/* Search slots in here, sitting on the gradient like the reference. */}
      {children && <div className="relative mt-4">{children}</div>}
    </header>
  )
}
