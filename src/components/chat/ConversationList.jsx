import React from "react"
import ConversationCard from "./ConversationCard"

function SectionHeading({ icon, label, count }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-3 pt-5">
      <i className={`bi ${icon} text-[12px] text-ink-4`} aria-hidden="true" />
      <h2 className="text-[11px] font-extrabold uppercase tracking-[1.2px] text-ink-3">{label}</h2>
      {count > 0 && (
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold tabular-nums text-ink-4 shadow-sm">
          {count}
        </span>
      )}
    </div>
  )
}

function Empty({ query, tab }) {
  const copy = query
    ? { icon: "bi-search", title: "No matches", body: `Nothing here matches “${query}”.` }
    : tab === "favourites"
    ? { icon: "bi-star", title: "No favourites yet", body: "Tap the star on any chat to keep it here." }
    : tab === "unread"
    ? { icon: "bi-check2-all", title: "All caught up", body: "Nothing new since you last looked." }
    : tab === "groups"
    ? { icon: "bi-people", title: "No group chats", body: "General is the only station-wide room." }
    : { icon: "bi-chat-dots", title: "No chats yet", body: "Pick someone above to start the first one." }

  return (
    <div className="mx-auto mt-8 max-w-[290px] rounded-[22px] bg-white px-6 py-8 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-cyan-light">
        <i className={`bi ${copy.icon} text-[19px] text-cyan-dark`} aria-hidden="true" />
      </div>
      <p className="text-[14px] font-bold text-ink">{copy.title}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-4">{copy.body}</p>
    </div>
  )
}

/**
 * Renders the pinned and recent groups. Sorting and filtering are done by
 * the caller so this stays a pure presentation layer.
 */
export default function ConversationList({
  pinned,
  recent,
  activeConvId,
  query,
  tab,
  isPinned,
  isFavourite,
  onOpen,
  onTogglePin,
  onToggleFavourite,
  loading,
}) {
  const row = conv => (
    <ConversationCard
      key={conv.conversationId}
      name={conv.name}
      lastText={conv.lastText}
      lastTimestamp={conv.lastTimestamp}
      unread={conv.unread}
      online={conv.online}
      isGeneral={conv.isGeneral}
      isFresh={conv.isFresh}
      isActive={activeConvId === conv.conversationId}
      isPinned={isPinned(conv.conversationId)}
      isFavourite={isFavourite(conv.conversationId)}
      onOpen={() => onOpen(conv)}
      onTogglePin={() => onTogglePin(conv.conversationId)}
      onToggleFavourite={() => onToggleFavourite(conv.conversationId)}
    />
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-2.5 pt-5" aria-busy="true" aria-label="Loading conversations">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="flex items-center gap-3.5 rounded-[20px] bg-white p-3 shadow-card"
            style={{ opacity: 1 - i * 0.18 }}
          >
            <div className="h-[50px] w-[50px] flex-shrink-0 rounded-[16px] bg-surface" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded-full bg-surface" />
              <div className="h-2.5 w-2/3 rounded-full bg-surface" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!pinned.length && !recent.length) return <Empty query={query} tab={tab} />

  return (
    <>
      {pinned.length > 0 && (
        <section aria-labelledby="pinned-heading">
          <SectionHeading icon="bi-pin-angle-fill" label="Pinned" count={pinned.length} />
          <div className="flex flex-col gap-2.5">{pinned.map(row)}</div>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading">
          <SectionHeading icon="bi-clock-history" label="Recent" count={recent.length} />
          <div className="flex flex-col gap-2.5">{recent.map(row)}</div>
        </section>
      )}
    </>
  )
}
