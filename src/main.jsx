import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "bootstrap-icons/font/bootstrap-icons.css"
import "./styles/global.css"
import App from "./App"
import { ToastProvider } from "./components/layout/ToastProvider"

/* ── Service Worker Registration ──────────────────────────
   The production service worker must NOT run during `vite dev`. A dev server
   and a production service worker can otherwise mix stale cached React/Vite
   chunks, which can create duplicate React module instances and crash hooks.
*/
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[MSO] SW registered:', reg.scope)
        /* Re-check /sw.js every minute. This only finds a new worker because every production
           build stamps a unique CACHE_NAME into sw.js, so the file's bytes change on each deploy.
           Before that, sw.js was byte-for-byte identical between deploys, no update was ever
           detected, and the app kept running stale code — don't remove the stamping step. */
        setInterval(() => reg.update(), 60000)

        /* A new worker must NOT silently take over: a forced reload throws away whatever the user
           is typing (a dip reading, a chat message). So we only announce that an update is ready;
           the UpdateBanner shows a Refresh button and the user decides when. Tapping it posts
           SKIP_WAITING, which fires controllerchange below, which performs the single reload. */
        let announced = false
        const announce = () => {
          if (announced) return
          announced = true
          window.dispatchEvent(new Event('mso-update-ready'))
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) announce()
          })
        })
      })
      .catch(err => console.warn('[MSO] SW registration failed:', err))
  })

  /* Reload at most ONCE per tab when a new worker takes control. The guard has to live in
     sessionStorage, not in a variable: a variable resets to false on every reload, so it can
     never stop the next reload — that was the cause of the app refreshing over and over.
     sessionStorage survives the reload within the tab, while a brand-new tab starts clean, so a
     genuinely newer deploy later still refreshes. If storage is blocked we skip the reload rather
     than risk a loop. */
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    try {
      if (sessionStorage.getItem('mso_sw_reloaded') === '1') return
      sessionStorage.setItem('mso_sw_reloaded', '1')
    } catch (e) { return }
    window.location.reload()
  })
} else if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  // Clean up any production worker left over from a previous local build.
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(reg => reg.unregister()))
      if (window.caches) {
        const names = await caches.keys()
        await Promise.all(names.map(name => caches.delete(name)))
      }
      console.info('[MSO] Development mode: production service worker/cache disabled.')
    } catch (e) {
      console.warn('[MSO] Could not clear development service worker cache:', e)
    }
  })
}

/* ── PWA Install Prompt — store event for use in app ──── */
window.__msoInstallPrompt = null
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  window.__msoInstallPrompt = e
  window.dispatchEvent(new CustomEvent('mso:installready'))
})
window.addEventListener('appinstalled', () => {
  window.__msoInstallPrompt = null
  window.dispatchEvent(new CustomEvent('mso:installed'))
})

/* ── Remove the boot splash once React is mounted ──────────
   The splash is painted by index.html before this bundle even loads.
   We fade it out after mount, but keep it up for a minimum ~900ms total
   so on a fast connection it reads as a deliberate brand moment instead
   of an ugly one-frame flash. */
function dismissSplash() {
  // A successful mount means boot is healthy — clear the failsafe counters
  // so the loop-breaker in index.html starts fresh next time and a future
  // real recovery isn't blocked by a stale flag.
  try {
    sessionStorage.removeItem('mso_boot_reloads')
    sessionStorage.removeItem('mso_boot_recovered')
  } catch (e) { /* ignore */ }

  const splash = document.getElementById("mso-splash")
  if (!splash) return
  const MIN_MS = 300
  const elapsed = performance.now()
  const wait = Math.max(0, MIN_MS - elapsed)
  setTimeout(() => {
    splash.classList.add("mso-hide")
    // Remove from the DOM after the fade transition completes
    setTimeout(() => splash.remove(), 320)
  }, wait)
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)

/* Give the first paint a beat, then dismiss the splash */
if (document.readyState === "complete") requestAnimationFrame(dismissSplash)
else window.addEventListener("load", () => requestAnimationFrame(dismissSplash))
