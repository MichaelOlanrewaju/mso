import React, { useEffect, useState } from "react"
import { usePWA, sendTestNotification, useLiveNotifications } from "../../hooks/usePWA"
import { usePushNotifications } from "../../hooks/usePushNotifications"

/* ── Offline toast ──────────────────────────────────────── */
export function OfflineBanner() {
  const { isOnline } = usePWA()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isOnline) setShow(true)
    else {
      const t = setTimeout(() => setShow(false), 2000)
      return () => clearTimeout(t)
    }
  }, [isOnline])

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] flex items-center gap-2.5 rounded-[12px] px-4 py-3 text-[13px] font-semibold shadow-xl"
      style={{ background: isOnline ? "#16A34A" : "#06091A", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", transition: "background 0.4s" }}>
      <i className={`bi ${isOnline ? "bi-wifi" : "bi-wifi-off"} text-[15px]`} />
      {isOnline ? "Back online" : "You're offline — some features may be limited"}
    </div>
  )
}

/* ── Install strip (shown on landing page) ──────────────── */
export function InstallStrip() {
  const { canInstall, isInstalled, promptInstall } = usePWA()
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)

  /* Don't show if already installed or dismissed this session */
  if (!canInstall || isInstalled || dismissed) return null

  const handleInstall = async () => {
    setInstalling(true)
    await promptInstall()
    setInstalling(false)
  }

  return (
    <div className="flex items-center gap-3 rounded-[14px] border px-3.5 py-3"
      style={{ background: "rgba(23,157,208,.09)", border: ".5px solid rgba(23,157,208,.22)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", marginBottom: 14 }}>
      <i className="bi bi-phone flex-shrink-0 text-[20px]" style={{ color: "#3BB8E8" }} />
      <div className="flex-1">
        <div className="text-[12.5px] font-bold" style={{ color: "rgba(255,255,255,.90)" }}>Add to Home Screen</div>
        <div className="text-[11px]" style={{ color: "rgba(255,255,255,.35)", marginTop: 2 }}>Install for one-tap access · Works offline</div>
      </div>
      <button type="button" onClick={handleInstall} disabled={installing}
        className="flex-shrink-0 rounded-[9px] px-3.5 py-2 text-[12px] font-extrabold text-white disabled:opacity-50"
        style={{ background: "#179DD0", boxShadow: "0 2px 12px rgba(23,157,208,.40)", border: "none", cursor: "pointer" }}>
        {installing ? "…" : "Install"}
      </button>
      <button type="button" onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 opacity-30"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
        <i className="bi bi-x-lg text-[12px]" />
      </button>
    </div>
  )
}

/* ── Test notification button ───────────────────────────── */
// Drop this anywhere (Dashboard, Settings, etc.) so someone can confirm
// THEIR device/browser is actually receiving notifications right now,
// instead of waiting around for a real pending cash-up/edit/payroll to
// show up and hoping it fires.
export function TestNotificationButton() {
  const [state, setState] = useState("idle") // idle | sending | sent | blocked | unsupported

  const handleClick = async () => {
    setState("sending")
    const result = await sendTestNotification()
    if (result.ok) setState("sent")
    else if (result.reason === "unsupported") setState("unsupported")
    else setState("blocked")
    setTimeout(() => setState("idle"), 4000)
  }

  if (state === "unsupported") {
    return <div className="text-[11.5px]" style={{ color: "rgba(255,255,255,.35)" }}>Notifications aren't supported in this browser.</div>
  }

  return (
    <button type="button" onClick={handleClick} disabled={state === "sending"}
      className="flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[11.5px] font-semibold disabled:opacity-60"
      style={{
        background: state === "sent" ? "rgba(34,197,94,.14)" : state === "blocked" ? "rgba(239,68,68,.14)" : "rgba(23,157,208,.10)",
        color: state === "sent" ? "#22C55E" : state === "blocked" ? "#EF4444" : "#3BB8E8",
        border: "none", cursor: "pointer",
      }}>
      <i className={`bi ${state === "sent" ? "bi-check-circle-fill" : state === "blocked" ? "bi-bell-slash-fill" : "bi-bell-fill"} text-[12px]`} />
      {state === "sending" ? "Sending…"
        : state === "sent" ? "Sent — check now"
        : state === "blocked" ? "Blocked — check browser settings"
        : "Send test notification"}
    </button>
  )
}
/* ── All-in-one notifications block ──────────────────────
   Drop <StaffNotifications username={...} /> into any dashboard to get:
   the live-notification poller running (approvals reach owner/GM, price
   changes reach everyone), a one-time "Allow notifications" prompt, and
   the "Send test notification" button once granted. One component so all
   four dashboards stay in sync. */
export function StaffNotifications({ username, role, station = "mso" }) {
  // Existing in-app notification system — unchanged. Fires alerts while
  // the app is OPEN (approvals, price changes). Kept as-is.
  const { notifPermission } = usePWA()
  useLiveNotifications({ enabled: notifPermission === "granted", username, station })

  // OneSignal web push — the NEW layer. Delivers even when the app is
  // CLOSED (Android always; iOS when installed to Home Screen, 16.4+).
  // Initializes after mount and ties the subscription to this user.
  const push = usePushNotifications(
    username ? { username, role, station } : null
  )

  const [showPrompt, setShowPrompt] = useState(
    typeof Notification !== "undefined" && Notification.permission === "default"
  )

  // When the user accepts our prompt, route it through OneSignal so the
  // subscription is registered with their servers (not just a bare
  // browser permission). Falls back gracefully if OneSignal isn't ready.
  const handleEnable = async () => {
    setShowPrompt(false)
    if (push.ready) {
      await push.enable()
    }
  }

  return (
    <>
      {notifPermission === "granted" && (
        <div className="mb-3 flex justify-end">
          <TestNotificationButton />
        </div>
      )}
      {showPrompt && (
        <NotificationPrompt
          onDismiss={() => setShowPrompt(false)}
          onEnable={handleEnable}
        />
      )}
    </>
  )
}

export function NotificationPrompt({ onDismiss, onEnable }) {
  const { notifPermission, requestNotifications } = usePWA()
  const [asking, setAsking] = useState(false)

  if (notifPermission === 'granted' || notifPermission === 'denied' || notifPermission === 'unsupported') return null

  const handleAllow = async () => {
    setAsking(true)
    // Prefer the OneSignal-aware path (registers a real push subscription).
    // Fall back to the existing browser-permission request if no handler
    // was supplied, so this component still works anywhere it's used alone.
    if (onEnable) await onEnable()
    else await requestNotifications()
    setAsking(false)
    onDismiss?.()
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }} onClick={onDismiss}>
      <div className="w-full max-w-sm overflow-hidden rounded-[20px] bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-5">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[14px]"
            style={{ background: "rgba(23,157,208,0.10)" }}>
            <i className="bi bi-bell-fill text-[20px]" style={{ color: "#179DD0" }} />
          </div>
          <div className="mb-1 text-[16px] font-extrabold text-gray-900">Stay in the loop</div>
          <div className="text-[13.5px] text-gray-500" style={{ lineHeight: 1.6 }}>
            Get notified when payroll is submitted for approval, shortages are reported, or new messages arrive.
          </div>
        </div>
        <div className="flex gap-2.5 border-t border-gray-100 px-5 pb-5 pt-4">
          <button type="button" onClick={onDismiss}
            className="flex-1 rounded-[10px] border border-gray-200 py-2.5 text-[13.5px] font-semibold text-gray-500">
            Not now
          </button>
          <button type="button" onClick={handleAllow} disabled={asking}
            className="flex-[2] rounded-[10px] py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
            style={{ background: "#179DD0" }}>
            {asking ? "Enabling…" : "Allow notifications"}
          </button>
        </div>
      </div>
    </div>
  )
}
