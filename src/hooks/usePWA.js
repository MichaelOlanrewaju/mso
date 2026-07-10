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
