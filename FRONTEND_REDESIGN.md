# MSO Front-End Redesign — v2

## What changed

This pass upgrades the existing MSO React/Vite front end without replacing its operational logic.

### Design system
- Introduced a calmer enterprise surface system with consistent background, borders, radii, shadows, focus states, and form styling.
- Reduced visual noise and excessive elevation while keeping the MSO navy/cyan brand hierarchy.
- Added reusable page-title, eyebrow, subtitle, mobile spacing, and interactive utility classes.
- Improved table readability and hover behavior.
- Strengthened keyboard focus visibility and mobile touch targets.

### App shell
- Reworked the sidebar into clearer groups: Operations, Reports & Insights, Stock & Credit, People & Finance, Workspace, Communication, Account, and Station.
- Added a stronger active-navigation treatment and station/live context.
- Reworked the topbar to emphasize page title, station context, live state, sync state, refresh, and notifications.
- Reduced unnecessary visual chrome while keeping station switching prominent.

### Dashboard
- Increased content breathing room and standardized the desktop content width.
- Added a mobile-safe content rhythm so the fixed bottom navigation does not obscure dashboard content.
- Kept the existing command-center information hierarchy and operational data flows intact.

## Intentionally preserved

- API/data hooks
- Authentication and role routing
- Station-aware branding
- PWA behavior
- Notifications
- Dashboard approval workflows
- Existing routes and operational pages

## Verification

The source changes were reviewed after editing. A production build could not be completed in this environment because the uploaded project did not include a usable Vite binary and dependency installation timed out before finishing. No claim of a successful production build is being made from this environment.
