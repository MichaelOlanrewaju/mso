import { useCallback, useEffect, useState } from "react"

/* ── usePWA ─────────────────────────────────────────────────
   Manages:
   - PWA install prompt (beforeinstallprompt)
   - Push notification permission
   - Online / offline status
   - App installed state
─────────────────────────────────────────────────────────── */
export function usePWA() {
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [notifPermission, setNotifPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  )

  useEffect(() => {
    /* Already installed (standalone mode) */
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
      setIsInstalled(true)
    }

    /* Install prompt available */
    if (window.__msoInstallPrompt) setCanInstall(true)

    const onReady = () => setCanInstall(true)
    const onInstalled = () => { setIsInstalled(true); setCanInstall(false) }
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    window.addEventListener('mso:installready', onReady)
    window.addEventListener('mso:installed', onInstalled)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.removeEventListener('mso:installready', onReady)
      window.removeEventListener('mso:installed', onInstalled)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    const prompt = window.__msoInstallPrompt
    if (!prompt) return false
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    window.__msoInstallPrompt = null
    setCanInstall(false)
    if (outcome === 'accepted') setIsInstalled(true)
    return outcome === 'accepted'
  }, [])

  const requestNotifications = useCallback(async () => {
    if (!('Notification' in window)) return 'unsupported'
    if (Notification.permission === 'granted') return 'granted'
    const result = await Notification.requestPermission()
    setNotifPermission(result)
    return result
  }, [])

  return { canInstall, isInstalled, isOnline, notifPermission, promptInstall, requestNotifications }
}

// Honest note on what this is and isn't: a genuine "push" notification —
// one that arrives even with the browser fully closed and the phone
// locked — requires either implementing the real Web Push protocol
// (VAPID JWT signing + ECDH key agreement + AES-128-GCM payload
// encryption, none of which Apps Script supports natively) or routing
// through a third-party service like Firebase, which needs its own
// external account setup. Neither of those is safely shippable without
// real infrastructure to test against.
//
// What this DOES do, reliably, using only what already exists: while
// someone has the dashboard open (even in a background tab), it polls
// the same endpoints already powering the Alerts card and fires a real
// browser notification the moment something NEW shows up — a pending
// cash reconciliation, a pending payroll, a new edit request. Tracks
// what's already been notified in localStorage so the same item never
// re-fires on every poll.
const SEEN_KEY = "mso_notified_ids"
// 45 seconds was too aggressive — Apps Script has real limits on how many
// things it can process at once, and polling this often (x3 requests,
// from every open dashboard, indefinitely including backgrounded tabs)
// was very likely contributing to the whole app feeling slower everywhere,
// not just on the dashboard. 3 minutes is still "live" enough for
// approval-type alerts, which aren't urgent to the second.
const POLL_MS = 180000

function getSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"))
  } catch {
    return new Set()
  }
}
function markSeen(ids) {
  try {
    const seen = getSeen()
    ids.forEach(id => seen.add(id))
    // Keep this from growing forever — a rolling window of the most
    // recent 300 is more than enough for this purpose.
    const arr = Array.from(seen).slice(-300)
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr))
  } catch {}
}

function fireNotification(title, body, url) {
  if (!("Notification" in window) || Notification.permission !== "granted") return
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body, icon: "/icons/icon-192.png", badge: "/icons/icon-72.png",
        vibrate: [100, 50, 100], tag: "mso-live-alert", data: { url: url || "/" },
      })
    })
  } else {
    new Notification(title, { body, icon: "/icons/icon-192.png" })
  }
}

export function useLiveNotifications({ enabled, station = "mso", username }) {
  useEffect(() => {
    if (!enabled || !username) return
    const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
    if (!SCRIPT_URL) return

    const checkOnce = async () => {
      // Skip entirely if the tab isn't actually visible right now — no
      // point spending backend capacity checking for alerts nobody's
      // looking at. This is on top of the interval itself, since a
      // backgrounded tab with a long-lived setInterval would otherwise
      // keep firing indefinitely even while someone's working in a
      // completely different tab.
      if (document.visibilityState !== "visible") return
      if (!("Notification" in window) || Notification.permission !== "granted") return
      const seen = getSeen()
      const newlySeen = []

      try {
        const cashupUrl = new URL(SCRIPT_URL)
        cashupUrl.searchParams.set("action", "getPendingCashups")
        cashupUrl.searchParams.set("station", station)
        cashupUrl.searchParams.set("username", username)
        const cashupRes = await fetch(cashupUrl.toString()).then(r => r.json())
        if (cashupRes.ok) {
          ;(cashupRes.pending || []).forEach(c => {
            const id = `cashup-${c.date}`
            if (!seen.has(id)) {
              fireNotification("Cash Reconciliation pending", `${c.submittedBy || "Cashier"} submitted ${c.date} for approval`, "/dashboard-mso")
              newlySeen.push(id)
            }
          })
        }
      } catch {}

      try {
        const editUrl = new URL(SCRIPT_URL)
        editUrl.searchParams.set("action", "getEditRequests")
        editUrl.searchParams.set("station", station)
        editUrl.searchParams.set("username", username)
        const editRes = await fetch(editUrl.toString()).then(r => r.json())
        if (editRes.ok) {
          ;(editRes.requests || []).forEach(r => {
            const id = `edit-${r.rowIndex}`
            if (!seen.has(id)) {
              fireNotification("Edit request pending", `${r.name || r.requestedBy} wants to correct a record for ${r.date}`, "/dashboard-mso")
              newlySeen.push(id)
            }
          })
        }
      } catch {}

      try {
        const payUrl = new URL(SCRIPT_URL)
        payUrl.searchParams.set("action", "getPendingPayroll")
        payUrl.searchParams.set("station", station)
        payUrl.searchParams.set("username", username)
        const payRes = await fetch(payUrl.toString()).then(r => r.json())
        if (payRes.ok) {
          ;(payRes.pending || []).forEach(p => {
            const id = `payroll-${p.month}`
            if (!seen.has(id)) {
              fireNotification("Payroll pending approval", `${p.month} payroll is awaiting your review`, "/payroll-mso")
              newlySeen.push(id)
            }
          })
        }
      } catch {}

      if (newlySeen.length) markSeen(newlySeen)
    }

    checkOnce()
    const interval = setInterval(checkOnce, POLL_MS)
    // Also check right away when someone switches back to this tab —
    // otherwise they could wait up to 3 minutes after returning before
    // seeing anything, even though the interval is intentionally slow.
    const onVisible = () => { if (document.visibilityState === "visible") checkOnce() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [enabled, station])
}
