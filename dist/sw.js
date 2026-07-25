/* ═══════════════════════════════════════════════════════════
   MSO Digital Operations — Service Worker
   Strategy:
   - App shell (HTML/JS/CSS) → Cache First
   - API calls (Apps Script) → Network First with cache fallback
   - Images → Cache First with long TTL
   - Fonts → Cache First
   - Push notifications → OneSignal (imported below)
═══════════════════════════════════════════════════════════ */

/* ── OneSignal push SDK ───────────────────────────────────
   This app already ships its own service worker (for offline caching),
   and two service workers can't control the same scope. OneSignal's
   documented solution for that exact situation is to importScripts()
   their SDK worker INTO the existing worker, rather than letting
   OneSignal register a second, competing one. So there is still only
   ONE service worker at scope "/", and it does both jobs: our caching
   below, and OneSignal's push handling via this import.

   Because this pulls OneSignal's own 'push'/'notificationclick' handlers
   in, we DELETE our old custom `push` handler further down — keeping it
   would double-handle the same push event and show duplicate
   notifications. importScripts must be at the very top, before any other
   listeners are registered. */
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')
} catch (e) {
  /* Never let a CDN hiccup break the whole service worker (which would
     also kill offline caching). If the import fails, push simply won't
     work until the next successful load — caching still works. */
}

/* ═══════════════════════════════════════════════════════════ */

// CACHE_NAME is injected automatically at build time by the sw-version
// plugin in vite.config.js. Every production build replaces the
// "ms0yyb0s-qislmz" token below with a unique hash, so the cache name
// changes on EVERY deploy — no one has to remember to bump it. The
// activate handler deletes every cache whose name !== CACHE_NAME, so a
// new build always purges the old JS bundle instead of serving it
// forever. If the token is still present (i.e. the file is served raw,
// un-built), we fall back to a timestamp so dev never gets stuck either.
const BUILD_ID = 'ms0yyb0s-qislmz'
// A STABLE fallback — never Date.now(). If this weren't stable, an un-built
// sw.js would compute a different CACHE_NAME on every evaluation, the
// browser would treat the worker as "new" forever, and controllerchange
// would reload the page in an infinite loop (splash screen never clears).
const CACHE_NAME = BUILD_ID.indexOf('SW_BUILD_ID') !== -1
  ? 'mso-dev-static'
  : 'mso-' + BUILD_ID
const OFFLINE_URL = '/offline.html'

const APP_SHELL = [
  '/',
  '/login',
  '/manifest.json',
]

const STATIC_EXTENSIONS = ['.js', '.css', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.jpeg', '.svg', '.ico']

/* ── Install ──────────────────────────────────────────── */
self.addEventListener('install', event => {
  /* NOT calling self.skipWaiting() here. Doing so made a new worker activate
     itself the instant it finished installing — before the person ever saw or
     tapped the "Refresh" banner — which forced a reload nobody asked for, and
     the resulting cycle of reload → recheck → treat-as-new-again is what made
     the banner reappear immediately and permanently, forcing repeat reloads.
     A worker now genuinely WAITS until skipWaiting is requested from the
     client's message handler below, triggered only by the person tapping
     Refresh. That's the entire point of showing the banner at all. */
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL).catch(() => {/* ignore individual failures */})
    })
  )
})

/* ── Activate ─────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

/* ── Fetch ────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  /* Skip non-GET and cross-origin except fonts/CDN */
  if (request.method !== 'GET') return
  if (url.origin !== location.origin &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com') &&
      !url.hostname.includes('cdn.jsdelivr.net')) return

  /* Apps Script API → Network First */
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleapis.com')) {
    event.respondWith(networkFirst(request))
    return
  }

  /* Static assets → Cache First */
  const ext = url.pathname.split('.').pop().toLowerCase()
  if (STATIC_EXTENSIONS.includes('.' + ext)) {
    event.respondWith(cacheFirst(request))
    return
  }

  /* HTML navigation → Network First with offline fallback */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(r => r || caches.match('/'))
      )
    )
    return
  }

  /* Default → Network First */
  event.respondWith(networkFirst(request))
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return cached || new Response('Offline', { status: 503 })
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || new Response(JSON.stringify({ ok: false, error: 'Offline' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503
    })
  }
}

/* ── Push Notifications ─────────────────────────────────
   Push and notification-click are now handled by the OneSignal SDK
   worker imported at the top of this file (importScripts). The previous
   custom `push` and `notificationclick` handlers were removed here on
   purpose — running them alongside OneSignal's would double-handle the
   same event and show duplicate notifications. All push display/click
   behaviour is configured in the OneSignal dashboard + init options. */

/* ── Background sync ──────────────────────────────────── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending') {
    event.waitUntil(syncPending())
  }
})

async function syncPending() {
  /* Placeholder — future: sync offline sales/dip records */
  console.log('[MSO SW] Background sync triggered')
}

/* ── Message from client ──────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
