# BUILD NEXT — Dip & Pump Operational Redesign V9.17

## Objective
Finish and verify the Dip & Pump frontend redesign using the existing MSO Dashboard implementation.

## Changes in this revision
- Added an operational reading checklist to the reference panel. It shows each configured tank, product, whether the active opening/closing reading is entered, and the current value using the existing `tankState`.
- Checklist entries can jump directly to the corresponding existing tank step; this does not change the required workflow order or save behaviour.
- Made the reading input's purpose and unit explicit, and added a capacity reference indicator for opening readings using the existing configured capacity and existing percentage calculation.
- Improved accessibility of workflow progress and preserved zero as a valid entered reading in the steps drawer.
- Refined responsive layout, focus styling, card hierarchy, spacing, and sticky desktop reference panel. CSS changes are scoped to the Dip & Pump screen.

## Protected scope
No API service, endpoint, HTTP method, payload, response contract, authentication, database, Apps Script, or backend file was intentionally changed. No new operational calculations or fabricated data were introduced. Existing save, edit-request, photo, pending-discharge confirmation, and final-submit handlers remain in place.

## Verification still required
1. Install dependencies using `npm ci` in an environment with package registry access.
2. Run `npm run build` and `npm run lint` (the repository's lint script is currently only a placeholder).
3. Start the app and test opening and closing readings with a normal value, blank value, and zero.
4. Test switching dates and modes, step navigation, checklist jumps, locked readings, photo upload, edit request, pending-discharge confirmation, confirmation modal, and successful submission.
5. Compare API request payloads and calculated figures before and after using the same inputs.
6. Check 360px mobile, tablet, and desktop widths, and verify no unrelated page regressions.

## Current environment limitation
The local dependency directory is incomplete and does not contain a runnable Vite binary. `npm run build` could not start (`vite: not found`), and dependency installation did not complete in this environment. Do not treat this archive as build-verified until the checks above pass.
