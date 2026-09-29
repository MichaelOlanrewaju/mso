/* Notes are cached on the device so they open instantly and survive a bad
   connection. That cache is private data sitting in localStorage, so it is
   cleared at logout — EXCEPT when it still holds edits that never reached
   the server. Wiping those would silently lose someone's note, which is
   worse than keeping it until they next sign in and it syncs. */
export const NOTES_CACHE_PREFIX = "mso_notes_v1_"

export function clearNotesCache() {
  try {
    const keys = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(NOTES_CACHE_PREFIX)) keys.push(k)
    }
    keys.forEach(k => {
      if (k.endsWith("_del")) {
        const pending = JSON.parse(window.localStorage.getItem(k) || "[]")
        if (!pending.length) window.localStorage.removeItem(k)
        return
      }
      const notes = JSON.parse(window.localStorage.getItem(k) || "[]")
      const unsynced = notes.some(n => n.dirty || (!n.saved && String(n.body || "").trim() !== ""))
      if (!unsynced) window.localStorage.removeItem(k)
    })
  } catch { /* never block logout */ }
}
