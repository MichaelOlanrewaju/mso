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
        /* Check for updates every 60 seconds */
        setInterval(() => reg.update(), 60000)
        /* Notify user of new version */
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              /* New version available — post message to skip waiting */
              newWorker.postMessage('SKIP_WAITING')
            }
          })
        })
      })
      .catch(err => console.warn('[MSO] SW registration failed:', err))
  })

  /* Reload when new SW takes control */
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) { refreshing = true; window.location.reload() }
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)
