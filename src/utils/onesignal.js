/* ═══════════════════════════════════════════════════════════
   OneSignal Web Push — initialization
   ───────────────────────────────────────────────────────────
   Loaded once, after the app mounts. Deliberately NOT imported at the
   top of main.jsx's module graph so it never blocks first paint.

   Key design point: this app already has its own service worker at
   /sw.js. OneSignal is told to REUSE that worker (which importScripts()
   OneSignal's SDK worker at the top of sw.js) instead of registering a
   second, competing one — see serviceWorkerParam / serviceWorkerPath
   below. That's what keeps a single worker at scope "/".

   Config comes from Vite env vars (never hardcoded):
     VITE_ONESIGNAL_APP_ID        — your OneSignal App ID (required)
     VITE_ONESIGNAL_SAFARI_WEB_ID — Safari Web ID (optional; legacy Safari)
═══════════════════════════════════════════════════════════ */

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID
const ONESIGNAL_SAFARI_WEB_ID = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID

let initPromise = null

/**
 * Loads and initializes the OneSignal v16 SDK exactly once.
 * Safe to call multiple times — subsequent calls return the same promise.
 * Resolves to the OneSignal instance, or null if unsupported / not configured.
 */
export function initOneSignal() {
  if (initPromise) return initPromise

  initPromise = new Promise((resolve) => {
    // 1 — Bail cleanly on anything that can't do web push, so callers can
    //     treat "no push" as a normal state rather than an error.
    if (typeof window === "undefined") return resolve(null)
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      console.info("[OneSignal] Web push not supported in this browser — skipping.")
      return resolve(null)
    }
    if (!ONESIGNAL_APP_ID) {
      console.warn("[OneSignal] VITE_ONESIGNAL_APP_ID is not set — push disabled. Add it to your environment to enable notifications.")
      return resolve(null)
    }

    // 2 — OneSignal v16 uses a global deferred queue: push a function and
    //     the SDK runs it once loaded. This is the officially recommended
    //     load pattern and avoids race conditions with the async script.
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          ...(ONESIGNAL_SAFARI_WEB_ID ? { safari_web_id: ONESIGNAL_SAFARI_WEB_ID } : {}),

          // Reuse THIS app's existing service worker instead of letting
          // OneSignal register its own competing one. sw.js importScripts()
          // the OneSignal worker, so pointing these at /sw.js (scope "/")
          // means one worker does both caching and push.
          serviceWorkerParam: { scope: "/" },
          serviceWorkerPath: "sw.js",

          // We drive the permission prompt ourselves at the right moment
          // (see requestPushPermission) rather than OneSignal auto-prompting
          // on page load, which browsers penalize and users dislike.
          autoResregister: false,
          notifyButton: { enable: false },

          allowLocalhostAsSecureOrigin: import.meta.env.DEV,
        })

        console.info("[OneSignal] Initialized.")
        resolve(OneSignal)
      } catch (err) {
        console.warn("[OneSignal] init failed:", err)
        resolve(null)
      }
    })

    // 3 — Inject the SDK script once. If it's already on the page, skip.
    if (!document.getElementById("onesignal-sdk")) {
      const s = document.createElement("script")
      s.id = "onesignal-sdk"
      s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      s.defer = true
      s.onerror = () => {
        console.warn("[OneSignal] SDK script failed to load — push unavailable this session.")
        resolve(null)
      }
      document.head.appendChild(s)
    }
  })

  return initPromise
}

/**
 * Prompts the user for notification permission and subscribes them.
 * Call this from a user gesture (button tap) or a deliberate moment —
 * NOT automatically on load. Returns one of:
 *   "granted" | "denied" | "unsupported" | "dismissed" | "error"
 */
export async function requestPushPermission() {
  const OneSignal = await initOneSignal()
  if (!OneSignal) return "unsupported"

  try {
    // Already granted? Make sure they're opted in and return.
    if (Notification.permission === "granted") {
      await OneSignal.User.PushSubscription.optIn()
      return "granted"
    }
    if (Notification.permission === "denied") {
      // Can't re-prompt once hard-denied — the user must change it in
      // browser/OS settings. Surfaced so the UI can explain that.
      return "denied"
    }

    // Native prompt via OneSignal, then opt the subscription in.
    await OneSignal.Notifications.requestPermission()
    if (Notification.permission === "granted") {
      await OneSignal.User.PushSubscription.optIn()
      return "granted"
    }
    return "dismissed"
  } catch (err) {
    console.warn("[OneSignal] permission request failed:", err)
    return "error"
  }
}

/**
 * Ties the current OneSignal subscription to your app's user, so the
 * backend can target notifications at a specific person/role later.
 * Uses OneSignal "External ID" (the stable, recommended cross-device key)
 * plus tags for role/station so you can segment.
 */
export async function identifyPushUser({ username, role, station }) {
  const OneSignal = await initOneSignal()
  if (!OneSignal || !username) return
  try {
    await OneSignal.login(String(username).toLowerCase())
    const tags = {}
    if (role) tags.role = String(role).toLowerCase()
    if (station) tags.station = String(station).toLowerCase()
    if (Object.keys(tags).length) await OneSignal.User.addTags(tags)
  } catch (err) {
    console.warn("[OneSignal] identify failed:", err)
  }
}

/** Clears the OneSignal identity on logout so the next user isn't conflated. */
export async function clearPushUser() {
  const OneSignal = await initOneSignal()
  if (!OneSignal) return
  try { await OneSignal.logout() } catch { /* non-fatal */ }
}

/** Current push permission as a simple string, for UI state. */
export function getPushPermission() {
  if (typeof Notification === "undefined") return "unsupported"
  return Notification.permission // "default" | "granted" | "denied"
}
