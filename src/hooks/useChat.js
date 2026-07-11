import { useCallback, useEffect, useRef, useState } from "react"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"
const POLL_MS = 10000

export function dmConversationId(a, b) {
  const pair = [a, b].map(s => s.toLowerCase()).sort()
  return `dm__${pair[0]}__${pair[1]}`
}

/* ── useConversations ────────────────────────────────────── */
export function useConversations({ username }) {
  const [status, setStatus] = useState("loading")
  const [conversations, setConversations] = useState([])
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
        if (d.ok) { setConversations(d.conversations || []); setStatus("ready") }
        else setStatus("error")
      })
      .catch(() => { if (isMounted.current) setStatus("error") })
  }, [username])

  useEffect(() => { load() }, [load])
  return { status, conversations, refresh: load }
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

  return { status, messages, sending, sendMessage, editMessage, deleteMessage, hideConversation }
}
