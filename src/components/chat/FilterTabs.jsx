import React from "react"
import { BRAND_GRADIENT, CARD_SHADOW } from "./tokens"

/**
 * Filter chips. Every tab here is backed by data that genuinely exists:
 *  - All        → everything
 *  - Direct     → conversations of type "dm"
 *  - Groups     → the station-wide General room
 *  - Favourites → user's own starred chats (stored on this device)
 *
 * There is deliberately no "Unread" tab: nothing in the API reports read
 * state, so the tab could only ever lie.
 */
export default function FilterTabs({ tabs, active, onChange, counts = {} }) {
  return (
    <div
      role="tablist"
      aria-label="Filter conversations"
      className="-mx-3 flex gap-2 overflow-x-auto px-3 py-1"
      style={{ scrollbarWidth: "none" }}
    >
      {tabs.map(tab => {
        const selected = active === tab.id
        const count = counts[tab.id]
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan active:scale-95 ${
              selected ? "text-white" : "border border-border bg-white text-ink-3 hover:border-cyan/40 hover:text-ink"
            }`}
            style={
              selected
                ? { background: BRAND_GRADIENT, boxShadow: "0 4px 14px rgba(19,6,86,.25)" }
                : { boxShadow: CARD_SHADOW }
            }
          >
            {tab.icon && <i className={`bi ${tab.icon} text-[11px]`} aria-hidden="true" />}
            {tab.label}
            {count > 0 && (
              <span
                className={`ml-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold tabular-nums ${
                  selected ? "bg-white/25 text-white" : "bg-surface text-ink-4"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
