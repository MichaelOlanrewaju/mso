import React, { useMemo, useState } from "react"
import ChatHeader from "./ChatHeader"
import SearchBar from "./SearchBar"
import PeopleRail from "./PeopleRail"
import FilterTabs from "./FilterTabs"
import ConversationList from "./ConversationList"
import { useChatListPrefs } from "../../hooks/useChatListPrefs"
import { dmConversationId } from "../../hooks/useChat"
import { STATION_KEYS, getStation } from "../../config/stations"

const TABS = [
  { id: "all", label: "All", icon: "bi-collection" },
  { id: "unread", label: "Unread", icon: "bi-dot" },
  { id: "direct", label: "Direct", icon: "bi-person" },
  { id: "groups", label: "Groups", icon: "bi-people" },
  { id: "favourites", label: "Favourites", icon: "bi-star" },
]

/**
 * The Chat List screen.
 *
 * Presentation only: every conversation, every person and every timestamp
 * comes from useConversations / useStaff exactly as before. Pins and
 * favourites are device-local (see useChatListPrefs) because the API
 * stores neither.
 */
export default function ChatSidebar({
  auth,
  conversations,
  convStatus,
  staff,
  onlineUsernames = [],
  activeConvId,
  onSelect,
  onDashboard,
  stationToggle,
}) {
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState("all")
  const { isPinned, isFavourite, togglePin, toggleFavourite } = useChatListPrefs(auth.username)

  /* ── Normalise into one shape the cards can render ─────────────── */
  const rows = useMemo(() => {
    const general = conversations.find(c => c.conversationId === "general")
    const out = [
      {
        conversationId: "general",
        name: "General",
        isGeneral: true,
        lastText: general?.lastText || "",
        lastTimestamp: general?.lastTimestamp || "",
        unread: general?.unread || 0,
        online: false,
      },
    ]
    conversations
      .filter(c => c.type === "dm")
      .forEach(c =>
        out.push({
          conversationId: c.conversationId,
          name: c.name,
          otherUsername: c.otherUsername,
          isGeneral: false,
          lastText: c.lastText || "",
          lastTimestamp: c.lastTimestamp || "",
          unread: c.unread || 0,
          online: !!c.online,
        })
      )
    return out
  }, [conversations])

  /* Colleagues with no thread yet — these feed the rail, not the list. */
  const freshStaff = useMemo(() => {
    const existing = new Set(conversations.filter(c => c.type === "dm").map(c => c.otherUsername))
    return staff.filter(s => s.username !== auth.username && !existing.has(s.username))
  }, [staff, conversations, auth.username])

  /* Genuine unread total, straight from the backend's read cursors. */
  const unseenCount = useMemo(
    () => rows.reduce((sum, r) => sum + (r.unread || 0), 0),
    [rows]
  )

  /* Fast lookup for presence dots on the People rail. */
  const onlineSet = useMemo(
    () => new Set((onlineUsernames || []).map(u => String(u).toLowerCase())),
    [onlineUsernames]
  )

  /* ── Filter → sort → split ─────────────────────────────────────── */
  const { pinned, recent, counts } = useMemo(() => {
    const q = query.trim().toLowerCase()

    const matches = rows.filter(r => {
      if (q && !(r.name.toLowerCase().includes(q) || (r.lastText || "").toLowerCase().includes(q)))
        return false
      if (tab === "unread") return (r.unread || 0) > 0
      if (tab === "direct") return !r.isGeneral
      if (tab === "groups") return r.isGeneral
      if (tab === "favourites") return isFavourite(r.conversationId)
      return true
    })

    // Newest first; a thread that has never been used sinks to the bottom.
    const byRecency = (a, b) => (b.lastTimestamp || "").localeCompare(a.lastTimestamp || "")

    return {
      pinned: matches.filter(r => isPinned(r.conversationId)).sort(byRecency),
      recent: matches.filter(r => !isPinned(r.conversationId)).sort(byRecency),
      counts: {
        all: rows.length,
        unread: rows.filter(r => (r.unread || 0) > 0).length,
        direct: rows.filter(r => !r.isGeneral).length,
        groups: rows.filter(r => r.isGeneral).length,
        favourites: rows.filter(r => isFavourite(r.conversationId)).length,
      },
    }
  }, [rows, query, tab, isPinned, isFavourite])

  /* Staff matching the search too, so one query covers chats and people. */
  const railPeople = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? freshStaff.filter(
          s => s.name.toLowerCase().includes(q) || (s.role || "").toLowerCase().includes(q)
        )
      : freshStaff
    const withPresence = base.map(s => ({
      ...s,
      online: onlineSet.has(String(s.username).toLowerCase()),
    }))
    // Whoever is around right now floats to the front — you're far more
    // likely to want the colleague who can answer you today.
    return withPresence.sort((a, b) => Number(b.online) - Number(a.online))
  }, [freshStaff, query, onlineSet])

  const openConversation = conv =>
    onSelect({
      conversationId: conv.conversationId,
      name: conv.name,
      isGeneral: conv.isGeneral,
    })

  const startDM = person =>
    onSelect({
      conversationId: dmConversationId(auth.username, person.username),
      name: person.name,
      isGeneral: false,
    })

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-t-[24px] md:rounded-[24px]"
      style={{ background: "#F4F7FC", boxShadow: "0 8px 30px rgba(15,23,42,.10)" }}
    >
      {/* Header carries the greeting, the dashboard button, and — nested in a
          single frosted panel, the way the reference stacks its story card —
          the people rail and the search field. Keeping those two on one
          surface is what stops the top of the screen reading as three
          unrelated strips. */}
      <ChatHeader
        name={auth.name}
        role={auth.role}
        unseenCount={unseenCount}
        onDashboard={onDashboard}
      >
        <div
          className="rounded-[22px] border border-white/15 p-3.5"
          style={{
            background: "rgba(255,255,255,0.10)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.14), 0 12px 32px rgba(6,3,40,.30)",
          }}
        >
          {/* Rail hides itself when the roster is exhausted or nothing matches. */}
          <PeopleRail people={railPeople} onStart={startDM} />
          <SearchBar value={query} onChange={setQuery} />
        </div>
      </ChatHeader>

      {/* Station toggle — placed here deliberately, BELOW ChatHeader's own
          safe-area padding. It used to sit above the header entirely, which
          put it right in the phone's reserved notch/status-bar space instead
          of the actual content area. Only shown to those who can view both
          stations' chat; switching it reloads the conversation list, the
          people rail, and messages for that station. */}
      {stationToggle && (
        <div className="mt-2 flex gap-1.5 rounded-[12px] bg-white p-1.5 shadow-card">
          {STATION_KEYS.map(key => (
            <button
              key={key} type="button"
              onClick={() => stationToggle.onSwitch(key)}
              className="flex-1 rounded-[9px] py-2 text-[12.5px] font-bold transition-colors"
              style={stationToggle.station === key
                ? { background: getStation(key).theme.primary, color: "#fff" }
                : { background: "transparent", color: "var(--text-muted)" }}
            >
              {getStation(key).short || getStation(key).name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-6" style={{ WebkitOverflowScrolling: "touch" }}>
        {/* Chips stick under the header so filtering stays reachable mid-scroll. */}
        <div
          className="sticky top-0 z-10 -mx-3 px-3 pb-2 pt-4"
          style={{
            background: "linear-gradient(180deg,#F4F7FC 74%,rgba(244,247,252,0) 100%)",
          }}
        >
          <FilterTabs tabs={TABS} active={tab} onChange={setTab} counts={counts} />
        </div>

        <ConversationList
          pinned={pinned}
          recent={recent}
          activeConvId={activeConvId}
          query={query.trim()}
          tab={tab}
          isPinned={isPinned}
          isFavourite={isFavourite}
          onOpen={openConversation}
          onTogglePin={togglePin}
          onToggleFavourite={toggleFavourite}
          loading={convStatus === "loading" && !conversations.length}
        />

        {convStatus === "error" && (
          <div className="mt-4 rounded-[18px] border border-red/20 bg-red-light px-4 py-3.5 text-center">
            <p className="text-[13px] font-bold text-red">Chats didn’t load</p>
            <p className="mt-1 text-[12px] text-ink-3">Check your connection and pull to refresh.</p>
          </div>
        )}

        {/* Hold-to-pin is invisible otherwise — say it once, quietly. */}
        {(pinned.length > 0 || recent.length > 1) && (
          <p className="pt-5 text-center text-[10.5px] text-ink-4">
            Hold a chat to pin it · Tap the star to favourite
          </p>
        )}
      </div>
    </div>
  )
}
