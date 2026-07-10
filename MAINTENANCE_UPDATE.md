# Maintenance update — backups, archiving, chat load, audit view

## 1 · Automatic backups (NEW)
Copies both workbooks (MSO + MRS) into an "MSO Backups" folder in Drive.

**Set up the weekly auto-backup (do this ONCE):**
```
?action=installBackupTrigger&key=<admin key>
```
This creates a time-driven trigger that backs up every Monday ~2am.
Backups older than 90 days are auto-pruned so Drive doesn't fill up.

**Run a backup on demand any time:**
```
?action=backupNow&key=<admin key>
```

Notes:
- Backups are full copies of the live spreadsheets, timestamped in the
  filename (`MSO_Backup_MSO_2026-07-10_02-00`).
- First run will prompt the Apps Script project for Drive permission if it
  hasn't been granted before.

## 2 · Security update — DEPLOY STATUS
The session-token + password-hashing update (see `SECURITY_UPDATE.md`) is
in this same `Code.gs` and frontend build. **It is only live once you:**
1. Paste this `Code.gs` into Apps Script → Deploy → New version.
2. Deploy this frontend to Vercel.
3. Have every staff member log in once (old sessions are intentionally
   invalidated; that login also upgrades their password to a hash).
Until all three happen, the new protection isn't active. If you're unsure
whether the currently-live version already includes it, redeploying this
one is safe and idempotent.

## 3 · Yearly archive (NEW)
Keeps the hot sheets (SalesLog, DailySales, PumpMetres) small so the
dashboard stays fast as data accumulates. Moves rows dated before a given
year into per-year archive tabs in the same workbook (non-destructive —
copied first, deleted from the live tab only after the copy succeeds).

**Run at the start of a new year (or whenever a sheet gets large):**
```
?action=archiveOldData&station=mso&beforeYear=2027&key=<admin key>
```
That example archives everything dated before 2027-01-01. Run once per
station (`&station=mrs` too). Reports how many rows moved per tab.
Not automatic on purpose — archiving is a deliberate, occasional action
you'll want to eyeball, not something that should silently fire.

## 4 · Chat polling load (CHANGED)
Chat previously polled the backend every 4 seconds per open window. Now:
- Polls every 10 seconds instead.
- Skips the request entirely while the tab/app is hidden (still catches up
  instantly when you return to it).
This meaningfully cuts Apps Script load, especially with several staff
having chat open at once. No visible change in normal use.

## 5 · Audit / activity view (ALREADY PRESENT)
Was already built and routed — no work needed. It's at `/activity-mso`,
linked in the sidebar as "Activity Log", Owner/GM only, with date and
action-type filters. It reads the `ActivityLog` sheet that every action
already writes to.

## Deploy order
Backend first (`Code.gs` → new version), then frontend (Vercel). After
deploying the backend, run `installBackupTrigger` once. Optionally run a
`backupNow` immediately so you have a fresh snapshot from day one.
