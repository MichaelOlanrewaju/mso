import React, { useState, useEffect } from "react"

/**
 * "Update available" banner.
 *
 * When a new build is deployed, the service worker installs the fresh version in
 * the background but we DON'T force a reload — a silent reload can wipe out
 * whatever someone was in the middle of typing (a dip reading, a chat message).
 * Instead this banner appears and lets the person refresh on their own terms:
 * one tap, no logout, no password. Exactly the WhatsApp/Slack pattern.
 *
 * It listens for a custom "mso-update-ready" event that main.jsx dispatches when
 * a new worker has finished installing and is waiting to take over.
 */
export default function UpdateBanner() {
  const [ready, setReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const onReady = () => setReady(true)
    window.addEventListener("mso-update-ready", onReady)
    return () => window.removeEventListener("mso-update-ready", onReady)
  }, [])

  if (!ready) return null

  const refresh = () => {
    setRefreshing(true)
    /* Tell the waiting worker to take over; main.jsx's controllerchange
       handler does the single reload once it does. If for any reason the
       worker message doesn't land, reload anyway after a short beat. */
    try {
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.ready.then(reg => {
          if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING")
        })
      }
    } catch { /* fall through to the hard reload */ }
    setTimeout(() => window.location.reload(), 600)
  }

  return (
    <div
      className="fixed inset-x-0 z-[9998] flex justify-center px-3"
      style={{ top: "max(var(--sat, 8px), 8px)", pointerEvents: "none" }}
    >
      <div
        className="flex w-full max-w-[440px] items-center gap-3 rounded-[14px] px-4 py-3 text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, var(--brand-primary), var(--brand-accent))", pointerEvents: "auto" }}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
          <i className={`bi ${refreshing ? "bi-arrow-repeat animate-spin-fast" : "bi-stars"} text-[15px]`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold leading-tight">A new version is ready</div>
          <div className="truncate text-[11px] text-white/70">Refresh to get the latest updates</div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="flex-shrink-0 rounded-[10px] bg-white px-3.5 py-2 text-[12px] font-extrabold disabled:opacity-60"
          style={{ color: "var(--brand-primary)" }}
        >
          {refreshing ? "Updating…" : "Refresh"}
        </button>
      </div>
    </div>
  )
}
