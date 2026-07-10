# Testing notifications

## What this actually is
Not true push (won't arrive with the app fully closed / phone locked).
While the dashboard is open — even in a background tab — it polls for
pending cash-ups, edit requests, and payroll approvals every 3 minutes,
plus immediately whenever you switch back to the tab, and fires a real
browser/OS notification the moment something new shows up.

## Who gets them
Owner and GM dashboards only (`DashboardPage`, `GMDashboardPage`) — these
are the roles that actually approve cash-ups/edits/payroll, which is what
triggers an alert.

## How to test right now
1. Log in as owner or GM, open the dashboard.
2. If a permission prompt appears ("Stay in the loop"), tap **Allow
   notifications**. If you don't see it, notification permission may
   already be granted or previously denied from an earlier visit.
3. Once permission is granted, a **"Send test notification"** button
   appears near the top of the dashboard. Tap it.
   - **Sent — check now** → a real notification should appear within a
     couple seconds. If it doesn't show up even though the button says
     "Sent," the OS/browser is silently suppressing it — check step 5.
   - **Blocked — check browser settings** → permission was denied at the
     OS/browser level; the in-app prompt can't override that. Fix it in
     the browser's site settings, not in this app.
4. To test a *real* alert (not the test button): from another account,
   submit a cash reconciliation, an edit request, or a payroll run, then
   come back to the owner/GM dashboard and either wait up to 3 minutes or
   switch away from and back to the tab (triggers an immediate check).

## Platform-specific gotchas
- **iOS Safari:** Web notifications only work for a PWA that's been
  **installed to the Home Screen** (Share → Add to Home Screen), running
  standalone — they will NOT work in a regular Safari tab, silently, with
  no error shown. Also requires iOS 16.4+. If a test fails on iPhone,
  confirm both of these before assuming the code is broken.
- **Android Chrome:** works in both a regular tab and installed mode.
- **Desktop:** works normally in Chrome/Edge/Firefox; Safari desktop has
  weaker support and may not show notifications at all.
- **Do Not Disturb / Focus modes** on the OS will suppress delivery even
  when the app did everything right — worth ruling out if a real test
  fails silently.

## A bug that was just fixed
Previously, the poller that watches for new alerts could permanently fail
to start for anyone who had already granted notification permission on a
prior visit — a stale-closure bug where the login/username value wasn't
available yet on the very first render, and the effect never re-ran once
it became available. Fixed by watching `username` as a dependency so the
poller re-initializes with the correct value. If notifications ever
silently stop firing again for a specific user, that's the first thing to
re-check.
