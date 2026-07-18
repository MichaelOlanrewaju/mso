import React from "react"
import Avatar from "./Avatar"
import OnlineIndicator from "./OnlineIndicator"

/**
 * Horizontal rail of colleagues you haven't messaged yet — it occupies the
 * slot the reference design gives to a story carousel, but carries real
 * weight: one tap opens a fresh DM with that person.
 *
 * A stories feature would need a stories table, media upload and expiry that
 * this backend has none of, so this is the honest equivalent: the same
 * glanceable, tappable row of faces, doing something a station manager
 * actually needs.
 *
 * Renders on the header's frosted panel, so its type is set light-on-dark.
 */
export default function PeopleRail({ people, onStart }) {
  if (!people.length) return null

  return (
    <section aria-labelledby="people-rail-heading" className="pb-3.5">
      <div className="flex items-baseline justify-between px-0.5 pb-3">
        <h2
          id="people-rail-heading"
          className="text-[10.5px] font-extrabold uppercase tracking-[1.3px] text-white/60"
        >
          Start a chat
        </h2>
        <span className="text-[10.5px] font-bold tabular-nums text-white/45">{people.length}</span>
      </div>

      {/* Negative margin + matching padding lets the rail bleed to the panel's
          edge while the first and last cards still clear its inner gutter. */}
      <div
        className="-mx-3.5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3.5 pb-1"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {people.map(person => (
          <button
            key={person.username}
            type="button"
            onClick={() => onStart(person)}
            aria-label={`Start a chat with ${person.name}, ${person.role}${person.online ? ", active recently" : ""}`}
            className="group flex w-[68px] flex-shrink-0 snap-start flex-col items-center gap-2 rounded-[16px] py-1 transition-transform duration-200 hover:-translate-y-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 active:scale-90"
          >
            <span className="relative block">
              <Avatar name={person.name} size={52} radius="50%" ring />
              {/* Presence takes the corner when they're around; the "start a
                  chat" plus only shows when there's no dot to display, so the
                  two never fight for the same 18px. */}
              {person.online ? (
                <OnlineIndicator online size={14} ring="rgba(255,255,255,.92)" />
              ) : (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-white transition-transform duration-200 group-hover:scale-110"
                  style={{ background: "var(--brand-accent)", boxShadow: "0 0 0 2px rgba(255,255,255,.92)" }}
                >
                  <i className="bi bi-plus text-[12px]" />
                </span>
              )}
            </span>
            <span className="w-full truncate text-center text-[11px] font-bold leading-tight text-white">
              {person.name.split(" ")[0]}
            </span>
            <span className="-mt-1.5 w-full truncate text-center text-[9.5px] font-medium capitalize leading-tight text-white/50">
              {person.role}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
