# BUILD NEXT — MSO Discharge Control Center V11

## V11 redesign — 25 October 2026
The Discharge page now has a substantially different visual direction rather than a light restyle:
- Replaced the plain page presentation with a dark, motion-led operations header and a dedicated **Discharge Control Center** hero.
- Added restrained animated grid/ring effects, a pulsing live indicator, staggered entrance motion, and hover feedback on summary metrics and controls.
- Added four date-aware overview metrics: delivery count, quantity received, deliveries awaiting pricing, and recorded net quantity variance. These are calculated from the existing in-memory records filtered by product, supplier, and the currently applied date range.
- Redesigned the sticky navigation as a dark glass-like header with a clearer active tab state and cyan report action.
- Reworked surfaces, date filter controls, record groups, form fields, focus states, and responsive spacing to use a cohesive navy/cyan/white operational design.
- Added purpose-built mobile styling for the hero, metrics, toolbar, and navigation, including a two-column metric layout at small widths.
- Respects `prefers-reduced-motion` for users who request reduced animation.

## Frontend-only preservation
The work was limited to `src/pages/DischargePage.jsx` and this document. No API endpoint, request method, request payload, response handling, authentication, routing, role permissions, business calculation, validation, submission, edit, delete, pricing, report, or print handler was intentionally changed. The existing date range filtering and date-aware summary logic remain in place.

## Validation status
- Static source review performed after the UI changes.
- Compared the source tree against the supplied project; intended changes are limited to `src/pages/DischargePage.jsx` and `BUILD_NEXT.md`.
- `npm install --no-audit --no-fund` timed out in this environment. As dependencies are not installed, `npm run build` could not be run successfully here.
- Browser testing at 320px, 375px, 430px, 768px, 1024px, 1366px, and 1440px has not been performed in a real browser. Role-specific workflow, live data, and report/print regression tests also remain outstanding.

## Recommended next step
In a network-enabled environment, run `npm install` followed by `npm run build`, then launch `npm run dev`. Verify the Records, Record Discharge, and Price Discharge tabs using each existing role. Test all date presets and custom ranges against real records, then check report/print output and responsive breakpoints before deploying.

## V12 Discharge page cleanup
- Priced discharges hidden by default (toggle "Show priced"); printable Discharge Report covers them.
- Removed hero, metric tiles and "Selected period summary" card.
- GM/CEO land on Price Discharge tab when anything is unpriced.

## V13 — station colours on Discharge + Framer Motion layer
- Discharge page uses the active station's brand tokens (Mobil blue / M&M wine+gold): header, tab underline, product pills, buttons, focus rings.
- Added `framer-motion` (only new dependency) and `src/components/motion/` (MotionRoot with reducedMotion="user", PageTransition, Stagger/StaggerItem, Collapse, StateSwap, ModalLayer, CountUp, Skeleton).
- Applied: page transitions, KPI count-up + hover/tap, sparkline draw-on, 7-day bar growth, sidebar scrim/active chevron/stagger, mobile drawer slide, bottom-nav entrance, confirm modal sheet, Discharge tabs/date panel/list stagger/empty states.
- Global CSS: table row hover, focus ring, press feedback, hero glow. No API/auth/permission/business logic touched.
- Run `npm install` once (framer-motion added to package.json).

## V14 — dashboard polish
- Payment Breakdown is now an animated donut (segments draw in, hover/tap highlights a segment or row, centre total counts up). Same data and Grand Total.
- 7-day Sales Trend: hover/tap a day for a tooltip with exact PMS/AGO litres; other days dim.
- KPI cards: coloured left edge (grows in), cursor spotlight glow.
- Tank Levels: bars fill in with a light shine, litres count up, critically-low tanks pulse red.
- Recent Transactions rows slide in one after another.

- Payment Breakdown now shows the PREVIOUS day (backend adds yesterdayPayments/yesterdayDate to getDashboard — deploy new Code.gs).

## V15 — Supervisor dashboard + Daily Summary
- Supervisor dashboard: station-brand hero (animated progress ring, step chips, Continue button), staggered sections, animated tank bars/pump rows/counters, skeletons, motion nav. All features, routes and handlers unchanged; no mock data.
- Both pages take station colours from the live brand tokens (Mobil blue / M&M wine+gold).
- Daily Summary: skeleton loading, animated state cards, count-up hero figures, staggered sections on each date change, short mobile date label.

- Shortage page: ignore out-of-order responses (fixes list flashing then showing empty); manager empty-state wording.

## V17 — Data Audit page
- New page `/audit/:station` (GM/CEO/owner): scans a date range, flags cash gaps, tank/pump meter breaks, duplicates,
  missing cash-ups, and bank deposits that don't match the day's to-bank. Sidebar + mobile drawer link "Data Audit".
- Backend: `getAudit` + `auditRange_` in Code.gs (read-only). Notes (INFO) = missing proof photos, dip-vs-meter.

## V18 — price-change cutover can no longer be dismissed
- A detected PMS/AGO price change is stored per station (localStorage) and stays pending until the pumps are closed
  via the cutover sheet. The alert is a blocking dialog with only "Close pumps now" (no "Remind me later").
- It steps aside on /sales/<station>?cutover=<product>, and clears when the cutover succeeds.
- Frontend-only: it cannot stop someone using a different device/browser that has not seen the change.

## V19 — server-forced price cutover ("today only")
- Backend: `requirePriceCutoverToday()` (run once from the editor) stores a requirement per station; `getCurrentPrices`
  returns `cutoverRequired`; `pumpPriceCutover` clears it on success; it expires after the day it was set for.
- App: supervisor devices show the blocking alert from the server flag (no device memory needed); clears on every device
  once the cutover is done.

## V20 — closing dip no longer misread as opening when TK1 is empty
- App now sends `isClosing` (false on opening save, true on closing save) to saveDailyReport.
- Backend fallback (old apps) now looks at ALL tanks' closing readings, not just TK1.
- Symptom fixed: Confirm & Save on Closing Stock did nothing / "Opening Dip already submitted" whenever TK1 closed at 0 L.

## V21 — Summary: a closing of 0 L is a real reading
- Once any tank's closing is entered, a 0 closing = tank sold out (sold = opening, margin computed), not "not entered".

## V22 — previous-day cash-up gate + automatic price-change requirement
- Backend `saveDailyReport`: a CASHIER cannot start a day's cash-up while the previous active day's cash-up is not APPROVED
  (blank, PENDING or REJECTED all block). Supervisor/GM/Owner are never held by it, so a supervisor can still enter
  the morning dip/pump readings. A cash-up already started (PENDING/REJECTED) can still be corrected.
  Kill switch: Script Property `gate_prev_cashup` = `off`.
- New `getCashupGate` endpoint + `useCashupGate` hook: red "Cash-up is locked for this day" banner on the Cash-up page.
- Backend `savePrice`: a PMS/AGO price change while a pump of that product has an unclosed session now sets the
  server-side cutover requirement automatically (no manual script), so every supervisor device shows the blocking alert
  until `pumpPriceCutover` is done.
- PriceChangeAlert: stronger look (red backdrop, pulsing icon, "Price changed — act now").

## V23 — price-change popup no longer repeats after it is done
- Server `cutoverRequired_` is self-healing: the requirement disappears as soon as no pump of that product has an
  unclosed session at the old price (closed by the app, a script, or from another phone).
- App no longer creates its own local "price changed" alert; it only shows the server's requirement, and purges old
  local ones on load. No more popup after the work is done or when no pump was running.
