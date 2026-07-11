import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "bootstrap-icons/font/bootstrap-icons.css"
import "./styles/global.css"
import App from "./App"
import { ToastProvider } from "./components/layout/ToastProvider"

/* ── Service Worker Registration ────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[MSO] SW registered:', reg.scope)

        /* Ask the browser to re-check /sw.js periodically. Because every
           production build now stamps a unique CACHE_NAME into sw.js, the
           file's bytes actually change each deploy, so this update() call
           reliably detects the new worker (previously sw.js was byte-for-
           byte identical across deploys and no update was ever found —
           the root cause of the app running stale code). */
        setInterval(() => reg.update(), 60000)

        /* If a worker is already waiting when we register (user opened the
           app after a deploy), activate it right away. */
        if (reg.waiting && navigator.serviceWorker.controller) {
          reg.waiting.postMessage('SKIP_WAITING')
        }

        /* When a new worker is found, tell it to skip waiting the moment
           it finishes installing, so the fresh bundle takes over without
           the user having to close and reopen the app. */
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage('SKIP_WAITING')
            }
          })
        })
      })
      .catch(err => console.warn('[MSO] SW registration failed:', err))
  })

  /* Reload exactly once when a new SW takes control, so the page runs the
     just-activated fresh bundle. The guard is stored in sessionStorage —
     NOT a plain variable — because a plain variable resets to false on
     every reload, which cannot stop a loop. With the sessionStorage flag,
     even if controllerchange fires repeatedly we reload at most once per
     tab session. */
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    try {
      if (sessionStorage.getItem('mso_sw_reloaded') === '1') return
      sessionStorage.setItem('mso_sw_reloaded', '1')
    } catch (e) {
      // sessionStorage unavailable — fall back to a one-shot best effort
    }
    window.location.reload()
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
