import React, { useEffect, useState } from "react"
import { usePWA } from "../../hooks/usePWA"

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

/* ── Notification permission prompt ─────────────────────── */
export function NotificationPrompt({ onDismiss }) {
  const { notifPermission, requestNotifications } = usePWA()
  const [asking, setAsking] = useState(false)

  if (notifPermission === 'granted' || notifPermission === 'denied' || notifPermission === 'unsupported') return null

  const handleAllow = async () => {
    setAsking(true)
    await requestNotifications()
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
