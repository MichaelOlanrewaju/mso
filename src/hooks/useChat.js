import { useCallback, useEffect, useRef, useState } from "react"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"
const POLL_MS = 10000
/* Inbox refresh — slower than the message poll on purpose. Unread counts
   and presence dots can lag a few seconds; an open thread cannot. */
const INBOX_POLL_MS = 20000
/* Heartbeat cadence. The backend's presence window is 2 min, so beating
   every 45s survives one dropped beat without flickering offline. */
const HEARTBEAT_MS = 45000

export function dmConversationId(a, b) {
  const pair = [a, b].map(s => s.toLowerCase()).sort()
  return `dm__${pair[0]}__${pair[1]}`
}

/* ── useConversations ────────────────────────────────────── */
export function useConversations({ username }) {
  const [status, setStatus] = useState("loading")
  const [conversations, setConversations] = useState([])
  // Colleagues seen within the backend's presence window. Empty array
  // until the backend patch is deployed — the UI just shows no dots.
  const [onlineUsernames, setOnlineUsernames] = useState([])
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL || !username) return
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getConversations")
    url.searchParams.set("station", STATION_KEY)
    url.searchParams.set("username", username)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current) return
        if (d.ok) {
          setConversations(d.conversations || [])
          setOnlineUsernames(d.onlineUsernames || [])
          setStatus("ready")
        }
        else setStatus("error")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [username])

  useEffect(() => { load() }, [load])

  // The inbox refreshes on its own so unread badges and presence dots
  // don't sit stale while someone stares at the list. Skipped while the
  // tab is hidden, same rule the message poll already follows.
  useEffect(() => {
    if (!username) return
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      load()
    }, INBOX_POLL_MS)
    return () => clearInterval(id)
  }, [username, load])

  return { status, conversations, onlineUsernames, refresh: load }
}

/* ── useChatPresence ─────────────────────────────────────────
   Heartbeat while the chat screen is open and visible. This is what
   makes anyone else's "online" dot true — presence is a claim about
   the app being open, not about a websocket, because there isn't one.
   Silently no-ops if the backend hasn't been patched yet.
──────────────────────────────────────────────────────────────── */
export function useChatPresence({ username, active = true }) {
  useEffect(() => {
    if (!SCRIPT_URL || !username || !active) return

    let cancelled = false
    const beat = () => {
      if (cancelled) return
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "chatHeartbeat")
      url.searchParams.set("station", STATION_KEY)
      url.searchParams.set("username", username)
      url.searchParams.set("token", getToken())
      fetch(url.toString(), { method: "GET", redirect: "follow" }).catch(() => {})
    }

    beat()
    const id = setInterval(beat, HEARTBEAT_MS)
    // Beat immediately on return so someone who unlocks their phone
    // doesn't spend up to 45s looking offline to everyone else.
    const onVisible = () => { if (document.visibilityState === "visible") beat() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [username, active])
}

/* ── useChat ─────────────────────────────────────────────── */
export function useChat({ username, name, conversationId }) {
  const [status, setStatus] = useState("loading")
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const lastTsRef = useRef("")
  const isMounted = useRef(true)
  const pollTimer = useRef(null)
  const isInitialRef = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false; if (pollTimer.current) clearTimeout(pollTimer.current) }
  }, [])

  const fetchMessages = useCallback((after, isInitial) => {
    if (!SCRIPT_URL || !conversationId) return Promise.resolve()
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getChatMessages")
    url.searchParams.set("station", STATION_KEY)
    url.searchParams.set("conversationId", conversationId)
    url.searchParams.set("username", username)
    url.searchParams.set("token", getToken()) // for deleted-for-me filtering
    if (after) url.searchParams.set("after", after)
    return fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current || !d.ok) return
        const incoming = d.messages || []
        if (incoming.length > 0) {
          lastTsRef.current = incoming[incoming.length - 1].timestamp
          setMessages(prev => {
            if (isInitial) return incoming
            const ids = new Set(prev.map(m => m.messageId))
            const fresh = incoming.filter(m => !ids.has(m.messageId))
            return fresh.length ? [...prev, ...fresh] : prev
          })
        }
        if (isInitial) setStatus("ready")
      })
      .catch(() => { if (isInitial && isMounted.current) setStatus("error") })
  }, [conversationId, username])

  useEffect(() => {
    if (!conversationId) return
    lastTsRef.current = ""
    isInitialRef.current = true
    setMessages([])
    setStatus("loading")
    if (pollTimer.current) clearTimeout(pollTimer.current)

    let cancelled = false
    const tick = () => {
      const isInitial = isInitialRef.current
      if (isInitial) isInitialRef.current = false
      // Don't spend a request while the tab/app isn't visible — a
      // backgrounded chat window polling every 10s is pure waste. We
      // still reschedule so polling resumes the moment they come back,
      // and the visibilitychange handler below fires an immediate catch-up
      // fetch on return so they're never left staring at stale messages.
      const skip = typeof document !== "undefined" && document.visibilityState === "hidden" && !isInitial
      const work = skip ? Promise.resolve() : fetchMessages(isInitial ? "" : lastTsRef.current, isInitial)
      work.finally(() => {
        if (!cancelled && isMounted.current) {
          pollTimer.current = setTimeout(tick, POLL_MS)
        }
      })
    }
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled && isMounted.current) {
        fetchMessages(lastTsRef.current, false)
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    const kickoff = setTimeout(tick, 0)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisible)
      clearTimeout(kickoff)
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, fetchMessages])

  /* Move this user's read cursor to now. Fired when the thread opens and
     whenever new messages land while they're looking at it — so a chat
     they're actively reading never accumulates a phantom unread badge.
     Fire-and-forget: a failed cursor write costs a stale badge, which is
     not worth blocking or surfacing an error over. */
  const markRead = useCallback(() => {
    if (!SCRIPT_URL || !conversationId || !username) return
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "markConversationRead")
    url.searchParams.set("station", STATION_KEY)
    url.searchParams.set("conversationId", conversationId)
    url.searchParams.set("username", username)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" }).catch(() => {})
  }, [conversationId, username])

  /* Mark read on open, and again each time the message list grows while
     this thread is on screen. */
  useEffect(() => {
    if (status !== "ready") return
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return
    markRead()
  }, [status, messages.length, markRead])

  const sendMessage = useCallback(async ({ text = "", imageFileId = "" } = {}) => {
    const trimmed = text.trim()
    if (!trimmed && !imageFileId) return { ok: false }
    if (!SCRIPT_URL) return { ok: false }

    const tempId = `temp-${Date.now()}`
    const optimistic = {
      messageId: tempId, senderUsername: username, senderName: name,
      text: trimmed, imageFileId, timestamp: new Date().toISOString(), pending: true,
    }
    setMessages(prev => [...prev, optimistic])
    setSending(true)

    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "saveChatMessage", token: getToken(), station: STATION_KEY, conversationId, username, name, text: trimmed, imageFileId }),
      })
      const d = await res.json()
      if (d.ok) {
        setMessages(prev => prev.map(m => m.messageId === tempId
          ? { ...m, messageId: d.messageId, timestamp: d.timestamp, pending: false }
          : m))
        if (d.timestamp > (lastTsRef.current || "")) lastTsRef.current = d.timestamp
      } else {
        setMessages(prev => prev.map(m => m.messageId === tempId ? { ...m, failed: true, pending: false } : m))
      }
      return d
    } catch {
      setMessages(prev => prev.map(m => m.messageId === tempId ? { ...m, failed: true, pending: false } : m))
      return { ok: false, error: "Network error" }
    } finally {
      if (isMounted.current) setSending(false)
    }
  }, [username, name, conversationId])

  const editMessage = useCallback(async (messageId, newText) => {
    if (!SCRIPT_URL) return { ok: false }
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "editChatMessage", token: getToken(), station: STATION_KEY, messageId, text: newText, username }),
      })
      const d = await res.json()
      if (d.ok) {
        setMessages(prev => prev.map(m => m.messageId === messageId
          ? { ...m, text: newText, editedAt: new Date().toISOString() }
          : m))
      }
      return d
    } catch { return { ok: false, error: "Network error" } }
  }, [username])

  const deleteMessage = useCallback(async messageId => {
    if (!SCRIPT_URL) return { ok: false }
    // Remove locally immediately (optimistic)
    setMessages(prev => prev.filter(m => m.messageId !== messageId))
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "deleteChatMessage", token: getToken(), station: STATION_KEY, messageId, username }),
      })
      return await res.json()
    } catch { return { ok: false, error: "Network error" } }
  }, [username])

  const hideConversation = useCallback(async () => {
    if (!SCRIPT_URL || !conversationId) return { ok: false }
    setMessages([])
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "hideConversation", token: getToken(), station: STATION_KEY, conversationId, username }),
      })
      return await res.json()
    } catch { return { ok: false, error: "Network error" } }
  }, [conversationId, username])

  return { status, messages, sending, sendMessage, editMessage, deleteMessage, hideConversation, markRead }
}
