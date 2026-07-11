# OneSignal Web Push — integration guide

## Project architecture (what I found before changing anything)
- **JavaScript**, not TypeScript (no tsconfig).
- Plain **React 18 + Vite 5**, React Router. No PWA plugin — a **hand-written
  service worker** at `public/sw.js`, registered in `src/main.jsx`.
- Manifest already PWA-valid (standalone, 192/512 icons, start_url `/`).
- An existing **in-app** notification system (`useLiveNotifications`) that
  fires alerts only while the app is open. **Left fully intact.**

## The one decision that shaped everything
You already have a service worker, and **two service workers can't share a
scope**. OneSignal's documented answer for this exact case is to
`importScripts()` their SDK worker **into** your existing worker rather than
register a second one. That's what I did — so there is still exactly **one**
service worker at scope `/`, now doing both offline caching and push.

## Files changed

### `public/sw.js`  (extended, not replaced)
- Added `importScripts('.../OneSignalSDK.sw.js')` at the very top.
- **Removed** the old custom `push` and `notificationclick` handlers —
  OneSignal's imported worker owns those now; keeping both would show
  duplicate notifications. All caching logic is untouched.

### `src/utils/onesignal.js`  (NEW)
Modular OneSignal wrapper: loads the v16 SDK once, initializes it to
**reuse `/sw.js`** (`serviceWorkerPath: "sw.js"`, `serviceWorkerParam:
{scope:"/"}`), and exposes `requestPushPermission`, `identifyPushUser`,
`clearPushUser`, `getPushPermission`. Bails cleanly on unsupported browsers
and when the App ID env var is missing. No auto-prompt on load.

### `src/hooks/usePushNotifications.js`  (NEW)
Thin React hook: initializes after mount (never blocks first paint), keeps
the OneSignal identity synced to the logged-in user via a ref (no wasted
re-renders), exposes `{ ready, permission, enable }`.

### `src/App.jsx`  (minimal add)
Calls `usePushNotifications(...)` once at the app root, so push init +
identity sync happen uniformly for **every role** and attach/clear across
login/logout — without touching the four separate dashboards.

### `src/components/pwa/PWABanners.jsx`  (extended)
`StaffNotifications` now also drives OneSignal alongside the existing
in-app system. `NotificationPrompt` routes "Allow" through OneSignal when
available (registers a real push subscription), falling back to the old
browser-permission path otherwise.

### `src/pages/SupervisorDashboardPage.jsx`, `CashierDashboardPage.jsx`
Passed `role` into `<StaffNotifications>` for push targeting/tags.

### `public/manifest.json`
Added explicit `"scope": "/"` (best practice; matches the SW scope).

### `.env.example`  (NEW)
Placeholders — `VITE_ONESIGNAL_APP_ID`, optional
`VITE_ONESIGNAL_SAFARI_WEB_ID`. **No secrets.** (Your OneSignal REST API
key, used to SEND pushes, stays server-side only — never in a VITE_ var.)

## What you must set up (one-time)
1. Create an app at **onesignal.com** → Web push → "Typical Site".
2. Set your site URL to your production domain (`https://app.msolimpid.com`).
3. Copy the **App ID** → set `VITE_ONESIGNAL_APP_ID` in your Vercel env vars
   (and locally in a `.env` file, gitignored).
4. Redeploy so Vite bakes the var into the build.

## Testing

### Android (Chrome / Edge / Samsung Internet)
1. Open the deployed site (or install the PWA).
2. Log in → dashboard → tap **Allow notifications** on the prompt.
3. In OneSignal dashboard → **Messages → New Push** → send a test.
4. It should arrive even with the browser/app closed.

### iPhone / iPad (Safari, iOS 16.4+)
1. Open the site in **Safari** → Share → **Add to Home Screen**.
   (iOS web push ONLY works from the installed Home-Screen PWA — never a
   Safari tab. This is an Apple limitation OneSignal cannot bypass.)
2. Open the installed app → log in → **Allow notifications**.
3. Send a test from the OneSignal dashboard.
4. It should arrive on the locked device.

## Sending from your backend (later)
Your Apps Script backend can POST to OneSignal's REST API
(`https://onesignal.com/api/v1/notifications`) with the REST API key in the
header, targeting `include_external_user_ids: [username]` (we set the
external ID at login) or by `filters` on the `role`/`station` tags we set.
Keep that REST key in Apps Script Script Properties — never in the frontend.

## Production checklist
- HTTPS: required by OneSignal and already satisfied (Vercel + your domain).
- `VITE_ONESIGNAL_APP_ID` set in the production environment before build.
- Deploy; on iPhone, delete + reinstall the Home-Screen app to pull the new
  service worker.
- Send a dashboard test to each platform to confirm.

## Honest limitations
- **iOS still needs the installed PWA** — no web-push product changes that.
- OneSignal's free tier is generous but has limits; check current caps for
  your staff count (well within free for a small team).
- The existing in-app notifications still run — you now have both layers:
  instant in-app while open, real push when closed.
