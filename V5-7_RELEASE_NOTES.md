# MSO Front-End V5–V7 Release

## V5 — Data Experience
- Added a reusable `DataTable` primitive with search-ready filtering, sorting, pagination, row selection, loading skeletons and empty states.
- Added consistent table footer and pagination controls.
- Added mobile-safe data table behavior and reduced dense-table visual noise.
- Standardized focus, reduced-motion and print behavior.

## V6 — Workflow Optimization
- Added `WorkflowActionBar` for persistent workflow state + primary actions.
- Added workflow-step primitives for future multi-step operations.
- Sales now exposes its current pump/step state alongside navigation.
- Cash reconciliation now exposes a persistent readiness/lock state and a single review/save action.
- Kept existing business logic, hooks and API behavior intact.

## V7 — Production Polish
- Added reduced-motion handling.
- Added stronger focus-visible treatment.
- Improved print behavior by suppressing interactive controls.
- Improved mobile action-bar behavior around bottom navigation/safe areas.
- Added consistent skeleton, empty and error-ready surfaces.
- Preserved station-aware branding and existing role routing.

## Verification
- Source-level JSX parsing should be run before deployment.
- Run `npm ci` then `npm run build` in a normal Node environment before production deployment.
