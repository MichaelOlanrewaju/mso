# Update: session tokens, password hashing, landing/login redesign

## 1. Session tokens (backend + frontend)
- Login now issues a random 48-char session token, stored in a new
  `Sessions` sheet (MSO workbook) with a 30-day expiry, cached via
  CacheService so validation doesn't cost a sheet scan per request.
- `requireRole` is now token-based: **identity comes from the token, never
  from a claimed username/role in the request.** Before this, anyone who
  knew a username could act as that user on role-gated actions.
- All 20 role-gated actions now require a valid token. Additionally
  token-required: `updateProfile` (you can only edit yourself now) and all
  chat read/write actions (sender identity comes from the session — no
  more posting as someone else; DM contents require being a participant).
- `logout` now revokes the server-side token too.
- Frontend: new `src/utils/session.js` (`getToken()`), attached to every
  gated request across hooks and pages.

## 2. Password hashing
- Stored format is now `sha256$<salt>$<hash>` (SHA-256, per-user random salt).
- **Migration is automatic:** existing plaintext rows still log in, and are
  transparently upgraded to a hash on that user's next successful login.
  No manual step, no lockouts.
- All password-writing paths store hashes: profile password change, email
  reset flow, `setStaffPassword`, `resetOwnerPassword`, `inviteStaff`.

## 3. Landing + login redesign
- **Landing:** proper desktop layout (left-anchored hero, headline scales
  to 88px, wider body measure, feature chips, inline CTA + hover states,
  left-edge gradient for text legibility). Mobile story-carousel behavior
  is unchanged — same slides, timings, swipe, and progress bars.
- **Login:** desktop split-screen — brand panel (photo, value points,
  station status) beside the form; mobile keeps the centered card. Added
  real `<label>` elements, `role="alert"/"status"` on feedback, and
  reduced-motion support. Submit logic is byte-for-byte the same flow.

## Deploy order (matters this time)
1. **Backend first**: paste `Code.gs` into Apps Script → Deploy → New
   version. (Deploying frontend first would send tokens the old backend
   ignores — harmless; deploying backend first briefly rejects gated
   actions from the old frontend until step 2 — also fine, brief.)
2. **Frontend**: replace repo contents with this zip, push, let Vercel build.
3. **Everyone logs in once.** All existing sessions are deliberately
   invalidated (they have no token). One re-login per person, then normal.
   That same login also upgrades their stored password to a hash.

## Known trade-off, stated honestly
GET requests carry the token as a query parameter, which can land in
server-side logs — a real but much smaller exposure than the passwords
that used to travel that way: tokens expire in 30 days, are revocable on
logout, and grant no access to the password itself. Converting every GET
endpoint to POST would eliminate this but touches nearly every read in
the app; noted as possible future hardening rather than done now.

## Post-deploy checks
- Log in → open Payroll or Approvals → data loads (token accepted).
- Log out on one device → confirm a saved copy of that token no longer
  works (revocation).
- After one login, check the Staff sheet: that user's Password cell should
  now read `sha256$...` instead of the plaintext.
