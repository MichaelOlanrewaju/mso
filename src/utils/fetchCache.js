// Lightweight in-memory cache shared across all hooks in this app.
// Not localStorage — deliberately memory-only, so it's always fresh on
// a real page reload, but saves a redundant slow Apps Script round-trip
// when navigating back and forth between pages within the same session
// (e.g. Dashboard -> Dip -> back to Dashboard).
const store = new Map()

const DEFAULT_TTL_MS = 15000 // 15s — long enough to help back/forward nav, short enough to stay accurate

export function getCached(key) {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.at > entry.ttl) {
    store.delete(key)
    return undefined
  }
  return entry.value
}

export function setCached(key, value, ttl = DEFAULT_TTL_MS) {
  store.set(key, { value, at: Date.now(), ttl })
}

export function invalidateCached(key) {
  store.delete(key)
}

// Clears every cache entry whose key starts with the given prefix —
// useful after a save, e.g. invalidate all "dashboard:" entries so the
// next dashboard visit fetches fresh data instead of the just-stale cache.
export function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
