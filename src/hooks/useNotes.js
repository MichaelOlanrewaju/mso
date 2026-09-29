import { useCallback, useEffect, useRef, useState } from "react"
import { getNotes, saveNoteRemote, deleteNoteRemote } from "../utils/notesApi"
import { NOTES_CACHE_PREFIX } from "../utils/notesCache"
import { getToken } from "../utils/session"

const SAVE_DELAY_MS = 700     // pause after typing before saving
const CACHE_DELAY_MS = 400    // don't rewrite the whole cache on every keystroke
const RETRY_BASE_MS = 4000
const RETRY_MAX_MS = 30000

const sleep = ms => new Promise(r => setTimeout(r, ms))

function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function writeJSON(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full/blocked */ }
}

export function newNoteId() {
  try { if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID() } catch { /* fall through */ }
  return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
}

/* A note as held on the device:
     { id, body, pinned, created, updated,
       saved  — the server has this note at least once,
       dirty  — edits exist that the server has NOT confirmed,
       error  — the last save attempt failed (transient) }
   The rule that keeps notes safe: a dirty note is never overwritten by
   what the server sends. It is simply saved again. */
export function useNotes(username) {
  const cacheKey = NOTES_CACHE_PREFIX + String(username || "").toLowerCase()
  const delKey = cacheKey + "_del"

  const notesRef = useRef(readJSON(cacheKey, []).map(n => ({ ...n, error: false })))
  const [notes, setNotes] = useState(notesRef.current)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [authExpired, setAuthExpired] = useState(false)
  const [busy, setBusy] = useState(0)

  const mounted = useRef(true)
  const timers = useRef({})
  const inflight = useRef({})
  const again = useRef({})
  const retries = useRef({})
  const cacheTimer = useRef(null)
  const pendingDeletes = useRef(new Set(readJSON(delKey, [])))
  const doSaveRef = useRef(null)

  /* Nothing is written to the device once there is no signed-in session.
     Logging out unmounts this page, which makes one last save — without this
     guard that save would put the notes straight back into localStorage right
     after logout had cleared them. */
  const persistNow = useCallback(() => {
    clearTimeout(cacheTimer.current)
    if (!getToken()) return
    writeJSON(cacheKey, notesRef.current.map(({ error, ...rest }) => rest))
  }, [cacheKey])

  const persistSoon = useCallback(() => {
    clearTimeout(cacheTimer.current)
    cacheTimer.current = setTimeout(persistNow, CACHE_DELAY_MS)
  }, [persistNow])

  const persistDeletes = useCallback(() => {
    if (!getToken()) return
    writeJSON(delKey, [...pendingDeletes.current])
  }, [delKey])

  const commit = useCallback(updater => {
    const next = typeof updater === "function" ? updater(notesRef.current) : updater
    notesRef.current = next
    if (mounted.current) setNotes(next)
    persistSoon()
  }, [persistSoon])

  const scheduleSave = useCallback((id, delay = SAVE_DELAY_MS) => {
    clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(() => doSaveRef.current && doSaveRef.current(id), delay)
  }, [])

  doSaveRef.current = async id => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    if (inflight.current[id]) { again.current[id] = true; return }
    const note = notesRef.current.find(n => n.id === id)
    if (!note || !note.dirty) return

    inflight.current[id] = true
    if (mounted.current) setBusy(b => b + 1)
    const sent = { body: note.body, pinned: note.pinned }
    let failed = false
    try {
      const res = await saveNoteRemote({ id, body: sent.body, pinned: sent.pinned, created: note.created })
      if (res && res.ok) {
        retries.current[id] = 0
        if (mounted.current) setAuthExpired(false)
        if (res.deleted) {
          commit(list => list.filter(n => n.id !== id))
        } else {
          commit(list => list.map(n => n.id !== id ? n : {
            ...n, saved: true, error: false, updated: res.updated || n.updated,
            // edits made while this request was in flight are still unsaved
            dirty: n.body !== sent.body || n.pinned !== sent.pinned,
          }))
        }
      } else {
        failed = true
        if (res && res.authExpired && mounted.current) setAuthExpired(true)
      }
    } catch { failed = true }

    inflight.current[id] = false
    if (mounted.current) setBusy(b => Math.max(0, b - 1))

    if (failed) {
      commit(list => list.map(n => n.id === id ? { ...n, error: true } : n))
      retries.current[id] = (retries.current[id] || 0) + 1
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * retries.current[id])
      if (mounted.current) scheduleSave(id, delay)
    } else if (again.current[id]) {
      again.current[id] = false
      scheduleSave(id, 0)
    }
  }

  const flushAll = useCallback(() => {
    notesRef.current.forEach(n => { if (n.dirty) doSaveRef.current && doSaveRef.current(n.id) })
    persistNow()
  }, [persistNow])

  const flushDeletes = useCallback(async () => {
    for (const id of [...pendingDeletes.current]) {
      try {
        // never let a delete overtake a save of the same note still in flight
        for (let i = 0; i < 50 && inflight.current[id]; i++) await sleep(300)
        const res = await deleteNoteRemote(id)
        if (res && res.ok) { pendingDeletes.current.delete(id); persistDeletes() }
        else if (res && res.authExpired) { if (mounted.current) setAuthExpired(true); break }
      } catch { break } // offline — try again next time
    }
  }, [persistDeletes])

  const refresh = useCallback(async () => {
    if (mounted.current) setLoadError(null)
    try {
      await flushDeletes()
      const res = await getNotes()
      if (!res || !res.ok) {
        if (res && res.authExpired && mounted.current) setAuthExpired(true)
        if (mounted.current) setLoadError((res && res.error) || "Couldn't load your notes.")
        return
      }
      if (mounted.current) setAuthExpired(false)
      const server = res.notes.filter(n => !pendingDeletes.current.has(n.id))
      const local = notesRef.current
      const serverIds = new Set(server.map(n => n.id))

      const merged = server.map(sn => {
        const ln = local.find(n => n.id === sn.id)
        return ln && ln.dirty ? ln : { ...sn, saved: true, dirty: false, error: false }
      })
      // On the device but not on the server: keep anything that never reached
      // it. Only a note the server HAD and no longer has (deleted on another
      // device) is dropped.
      local.forEach(ln => { if (!serverIds.has(ln.id) && !(ln.saved && !ln.dirty)) merged.push(ln) })

      commit(merged)
      merged.forEach(n => { if (n.dirty) scheduleSave(n.id, 0) })
    } catch {
      if (mounted.current) setLoadError("You're offline — showing the notes saved on this device.")
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [commit, flushDeletes, scheduleSave])

  useEffect(() => {
    mounted.current = true
    refresh()
    const onHide = () => { if (document.visibilityState === "hidden") flushAll() }
    const onPageHide = () => flushAll()
    const onOnline = () => { refresh() }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onPageHide)
    window.addEventListener("online", onOnline)
    const timerBag = timers.current
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onPageHide)
      window.removeEventListener("online", onOnline)
      flushAll() // one last attempt for anything typed in the final moments
      mounted.current = false
      Object.values(timerBag).forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── actions ─────────────────────────────────────────────── */
  const createNote = useCallback(() => {
    const now = new Date().toISOString()
    const note = { id: newNoteId(), body: "", pinned: false, created: now, updated: now, saved: false, dirty: false, error: false }
    commit(list => [note, ...list])
    return note.id
  }, [commit])

  const updateBody = useCallback((id, body) => {
    const n = notesRef.current.find(x => x.id === id)
    if (!n) return
    // A brand-new note that is still empty has nothing worth saving.
    const worthSaving = n.saved || body.trim() !== ""
    commit(list => list.map(x => x.id === id ? { ...x, body, updated: new Date().toISOString(), dirty: worthSaving, error: false } : x))
    if (worthSaving) scheduleSave(id)
    else clearTimeout(timers.current[id])
  }, [commit, scheduleSave])

  const togglePin = useCallback(id => {
    const n = notesRef.current.find(x => x.id === id)
    if (!n) return
    const worthSaving = n.saved || n.body.trim() !== ""
    commit(list => list.map(x => x.id === id ? { ...x, pinned: !x.pinned, dirty: worthSaving || x.dirty, error: false } : x))
    if (worthSaving) scheduleSave(id, 250)
  }, [commit, scheduleSave])

  const removeNote = useCallback(id => {
    clearTimeout(timers.current[id])
    const n = notesRef.current.find(x => x.id === id)
    commit(list => list.filter(x => x.id !== id))
    if (n && (n.saved || inflight.current[id])) {
      pendingDeletes.current.add(id)
      persistDeletes()
      flushDeletes()
    }
  }, [commit, flushDeletes, persistDeletes])

  const discardIfEmpty = useCallback(id => {
    const n = notesRef.current.find(x => x.id === id)
    if (n && n.body.trim() === "") removeNote(id)
  }, [removeNote])

  const saveState =
    busy > 0 ? "saving"
    : notes.some(n => n.dirty && n.error) ? "error"
    : notes.some(n => n.dirty) ? "saving"
    : "saved"

  return {
    notes, loading, loadError, authExpired, saveState,
    refresh, createNote, updateBody, togglePin, removeNote, discardIfEmpty, flushAll,
  }
}
