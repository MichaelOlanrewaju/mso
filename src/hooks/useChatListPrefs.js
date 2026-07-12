import { useCallback, useEffect, useState } from "react"

/**
 * Pins and favourites for the Chat List.
 *
 * These are stored on this device only. The chat backend has no field for
 * either, and the brief ruled out new APIs — so rather than fake a server
 * round-trip that silently drops the value, this is honest local state:
 * it survives reloads, it just doesn't follow you to another device.
 *
 * Keyed per user so two people sharing a station tablet don't inherit each
 * other's pins.
 */
const KEY = username => `mso.chat.prefs.${(username || "anon").toLowerCase()}`

function read(username) {
  try {
    const raw = localStorage.getItem(KEY(username))
    if (!raw) return { pinned: [], favourites: [] }
    const parsed = JSON.parse(raw)
    return {
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
      favourites: Array.isArray(parsed.favourites) ? parsed.favourites : [],
    }
  } catch {
    return { pinned: [], favourites: [] }
  }
}

export function useChatListPrefs(username) {
  const [prefs, setPrefs] = useState(() => read(username))

  // Re-read when the signed-in user changes (shared-device case).
  useEffect(() => { setPrefs(read(username)) }, [username])

  const persist = useCallback(next => {
    setPrefs(next)
    try { localStorage.setItem(KEY(username), JSON.stringify(next)) } catch { /* quota / private mode — keep in memory */ }
  }, [username])

  const toggle = useCallback((bucket, id) => {
    setPrefs(prev => {
      const list = prev[bucket]
      const next = {
        ...prev,
        [bucket]: list.includes(id) ? list.filter(x => x !== id) : [...list, id],
      }
      try { localStorage.setItem(KEY(username), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [username])

  const togglePin = useCallback(id => toggle("pinned", id), [toggle])
  const toggleFavourite = useCallback(id => toggle("favourites", id), [toggle])
  const isPinned = useCallback(id => prefs.pinned.includes(id), [prefs.pinned])
  const isFavourite = useCallback(id => prefs.favourites.includes(id), [prefs.favourites])

  return { isPinned, isFavourite, togglePin, toggleFavourite, prefs, persist }
}

export default useChatListPrefs
