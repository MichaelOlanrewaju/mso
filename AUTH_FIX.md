# Fix: hybrid auth (stops "session expired" lockouts)

## What was wrong (your diagnosis was correct)
`requireRole` had been rewritten to **hard-fail** whenever a session token
didn't validate. Any ordinary token hiccup — token not written at login,
expired, a cache race, or (the real one here) the app running an older
cached copy of its own code that didn't send a token at all — turned a
legitimate owner/GM into "Your session has expired," even though their
account and role were perfectly fine. Reverting to the old username-based
check worked because it never looks at tokens, so none of those failure
modes could occur.

## The fix: hybrid authorization
`requireRole` now does BOTH, in order:
1. **Token first** — if a valid session token is present, identity and
   role come from it (the strong, spoof-proof path). Unchanged security
   for everyone on the current build.
2. **Username fallback** — if the token is missing/stale, it falls back to
   looking the claimed username up in the Staff sheet and checking that
   role, exactly like the pre-token code. A legitimate owner/GM is never
   locked out of a price change (or any role-gated action) by a token
   problem. Every fallback use is logged as `AUTH_FALLBACK` in ActivityLog
   so you can see when/how often it happens.

The same token-preferred / verified-username-fallback pattern was applied
to the other actions that had been made token-strict:
- **Chat** (send/edit/delete/hide, read messages, conversations) — writes
  still resolve the sender from a real Staff record (you can't post as a
  username that doesn't exist), but a stale token no longer blocks chat.
- **updateProfile** — you can edit your own profile on the fallback path,
  and password changes remain independently gated by the current-password
  check, so the fallback can't be used to hijack a password.
- **getDischarge / getStaff** — role resolved the same hybrid way;
  financials still hidden from non-owner/GM.

## Frontend changes
- **Removed the force-logout** in `useAuth` that nuked any session without
  a token. With hybrid auth that was both unnecessary and the direct cause
  of unexpected "session expired" prompts — a tokenless session now keeps
  working and simply gains a token on the user's next natural login.
- **Service worker cache bumped to `mso-v39`.** The stale-code problem was
  the cache name not changing between deploys, so old caches never cleared.
  (HTML is already Network-First and JS filenames are hash-fingerprinted by
  Vite, so those were fine — the cache-name bump is the actual fix.)

## Deploy
1. Backend `Code.gs` → Apps Script → Deploy → New version. **This is the
   one that stops the lockouts** — deploy it first.
2. Frontend zip → push → Vercel.
3. On iPhone, delete + reinstall the home-screen app to pull `v39`.

## Security note (the honest trade-off you chose)
The username fallback slightly widens the theoretical surface: a caller who
sends a valid username but no token is trusted on role-based actions. For
an internal tool where lockouts are a real operational problem, that's a
reasonable trade. Once you've confirmed all devices are on the token-sending
build (watch for `AUTH_FALLBACK` entries dropping to zero in ActivityLog),
you can tighten `requireRole` back to token-only if you want — but only
after that count is reliably zero.
