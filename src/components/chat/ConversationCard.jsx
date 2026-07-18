import React, { useRef, useState } from "react"
import Avatar from "./Avatar"
import UnreadBadge from "./UnreadBadge"
import OnlineIndicator from "./OnlineIndicator"
import { BRAND_GRADIENT, CARD_SHADOW, CARD_SHADOW_HOVER, timeLabel } from "./tokens"

/**
 * A single conversation row.
 *
 * Unread rows earn weight rather than decoration: the name goes heavier,
 * the preview darkens, and a cyan rail appears down the left edge — so an
 * unread chat is legible at a glance without the row shouting.
 *
 * Long-press (or the star button) toggles pin/favourite. Both are stored
 * on this device only — the API has no field for either.
 */
export default function ConversationCard({
  name,
  lastText,
  lastTimestamp,
  unread = 0,
  online = false,
  isGeneral = false,
  isActive = false,
  isPinned = false,
  isFavourite = false,
  isFresh = false,
  onOpen,
  onTogglePin,
  onToggleFavourite,
}) {
  const [pressed, setPressed] = useState(false)
  const holdTimer = useRef(null)
  const hasUnread = unread > 0

  const startHold = () => {
    setPressed(true)
    holdTimer.current = setTimeout(() => {
      onTogglePin?.()
      // Confirm the toggle physically — the row is the only feedback
      // surface here, and a silent change feels broken on touch.
      if (navigator.vibrate) navigator.vibrate(12)
    }, 520)
  }
  const endHold = () => {
    setPressed(false)
    if (holdTimer.current) clearTimeout(holdTimer.current)
  }

  return (
    <div
      className="group relative"
      onPointerDown={startHold}
      onPointerUp={endHold}
      onPointerLeave={endHold}
      onPointerCancel={endHold}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-current={isActive ? "true" : undefined}
        className={`relative flex w-full items-center gap-3.5 overflow-hidden rounded-[20px] bg-white p-3 pr-14 text-left transition-all duration-200 ease-out will-change-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan md:hover:-translate-y-[2px] ${
          pressed ? "scale-[0.985]" : ""
        }`}
        style={{
          boxShadow: isActive
            ? "0 0 0 2px var(--brand-accent), 0 8px 22px rgba(19,6,86,.12)"
            : hasUnread
            ? "0 4px 16px rgba(19,6,86,.10)"
            : CARD_SHADOW,
        }}
        onMouseEnter={e => {
          if (!isActive) e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER
        }}
        onMouseLeave={e => {
          if (!isActive)
            e.currentTarget.style.boxShadow = hasUnread
              ? "0 4px 16px rgba(19,6,86,.10)"
              : CARD_SHADOW
        }}
      >
        {/* Unread rail — a quiet cyan edge, not a loud tint. */}
        {hasUnread && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ background: "linear-gradient(180deg,var(--brand-accent),var(--brand-primary))" }}
          />
        )}

        <span className="relative flex-shrink-0">
          {isGeneral ? (
            <Avatar
              name="General"
              size={50}
              radius="17px"
              icon={<i className="bi bi-people-fill text-[19px]" />}
              style={{ background: BRAND_GRADIENT }}
            />
          ) : (
            <Avatar name={name} size={50} radius="17px" />
          )}
          {!isGeneral && <OnlineIndicator online={online} />}
          {isPinned && (
            <span
              aria-hidden="true"
              className="absolute -left-1 -top-1 flex h-[19px] w-[19px] items-center justify-center rounded-full text-white"
              style={{ background: "var(--brand-primary)", boxShadow: "0 0 0 2.5px #fff" }}
            >
              <i className="bi bi-pin-angle-fill text-[9px]" />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={`truncate text-[14.5px] tracking-[-0.01em] text-ink ${
                hasUnread ? "font-extrabold" : "font-bold"
              }`}
            >
              {name}
            </span>
            {lastTimestamp && (
              <span
                className={`flex-shrink-0 text-[10.5px] font-semibold tabular-nums ${
                  hasUnread ? "text-cyan-dark" : "text-ink-4"
                }`}
              >
                {timeLabel(lastTimestamp)}
              </span>
            )}
          </span>
          <span className="mt-1 flex items-center gap-1.5">
            {lastText ? (
              <>
                {/* Delivered tick only on chats with nothing new — a double
                    tick next to an unread badge would contradict itself. */}
                {!hasUnread && (
                  <i
                    aria-hidden="true"
                    className="bi bi-check2-all flex-shrink-0 text-[12px] text-cyan"
                  />
                )}
                <span
                  className={`truncate text-[12.5px] leading-snug ${
                    hasUnread ? "font-semibold text-ink-2" : "text-ink-3"
                  }`}
                >
                  {lastText}
                </span>
              </>
            ) : (
              <span className="truncate text-[12.5px] italic leading-snug text-ink-4">
                {isGeneral
                  ? "Station-wide room · everyone"
                  : isFresh
                  ? "No messages yet"
                  : "Tap to open"}
              </span>
            )}
            <UnreadBadge count={unread} />
          </span>
        </span>
      </button>

      {/* Favourite toggle — outside the main button so the card stays a
          single, unambiguous target for opening the chat. */}
      <button
        type="button"
        onClick={onToggleFavourite}
        aria-pressed={isFavourite}
        aria-label={isFavourite ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
        className={`absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan active:scale-90 ${
          isFavourite
            ? "text-[#F5A524]"
            : "text-ink-4 opacity-0 hover:bg-surface hover:text-ink-3 focus-visible:opacity-100 group-hover:opacity-100 md:opacity-0"
        }`}
        style={isFavourite ? { opacity: 1 } : undefined}
      >
        <i className={`bi ${isFavourite ? "bi-star-fill" : "bi-star"} text-[14px]`} />
      </button>
    </div>
  )
}
