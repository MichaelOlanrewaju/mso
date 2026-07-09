/* ═══════════════════════════════════════════════════════════
   MSO Digital Operations — Service Worker
   Strategy:
   - App shell (HTML/JS/CSS) → Cache First
   - API calls (Apps Script) → Network First with cache fallback
   - Images → Cache First with long TTL
   - Fonts → Cache First
═══════════════════════════════════════════════════════════ */

// ⚠️ BUMP THIS ON EVERY DEPLOY ⚠️
// The cache-cleanup logic below only runs when this string actually
// changes. If you deploy new code without bumping this, browsers can
// keep serving the OLD cached JS bundle indefinitely — even after a
// successful Netlify deploy — which has caused real confusion this
// project ("I deployed the fix but you're still describing old behavior").
// Bump this (v3 → v4 → v5...) every single time you hand over a new zip.
const CACHE_NAME = 'mso-v20'
const OFFLINE_URL = '/offline.html'

const APP_SHELL = [
  '/',
  '/login',
  '/manifest.json',
]

const STATIC_EXTENSIONS = ['.js', '.css', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.jpeg', '.svg', '.ico']

/* ── Install ──────────────────────────────────────────── */
self.addEventListener('install', event => {
  self.skipWaiting()
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

/* ── Push Notifications ───────────────────────────────── */
self.addEventListener('push', event => {
  let data = { title: 'MSO Console', body: 'You have a new notification.', url: '/' }
  try { data = { ...data, ...event.data.json() } } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [100, 50, 100],
      data: { url: data.url },
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      tag: 'mso-notification',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

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
