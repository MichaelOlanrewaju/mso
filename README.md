# MSO Limpid — Operations Console (React + Vite)

This replaces the earlier Gatsby build. Same product, same backend contract,
rebuilt on Vite because this is an authenticated internal console, not a
content site — Gatsby's whole value (SSG, SEO) buys nothing here, and Vite's
dev server starts in milliseconds instead of ~6s of bootstrap.

## Setup

```bash
npm install
cp .env.example .env.development   # pre-filled with the URL from your original HTML
npm run dev                        # http://localhost:5173
```

```bash
npm run build && npm run preview   # production build
```

## What changed vs. the Gatsby version

**Framework**
- `gatsby` → `vite` + `react-router-dom`. Routing moved from file-based
  pages to `src/App.jsx`'s `<Routes>`.
- `process.env.GATSBY_*` → `import.meta.env.VITE_*` (Vite's convention).
- Gatsby's `<Link activeClassName>` → React Router's `<NavLink>` with a
  function `className`.
- `navigate()` / `window.location.replace()` → React Router's
  `useNavigate()`, so logging in/out no longer triggers a full page reload.
- Gatsby's `Head` export → a 4-line `usePageTitle()` hook.

**Design** — same color system and information architecture, deliberately
pushed further rather than redone from scratch:

- **Login page rebuilt as a split panel.** A dark brand panel with a
  signature element — a vertical fuel gauge that fills on load, the same
  visual language as the dashboard's own tank-dip readouts — paired with a
  light, focused sign-in form. This is the one place I spent real design
  "budget"; everything else stays disciplined around it.
- **One page-load sequence**, not scattered effects: login panel elements
  and dashboard sections each fade up in a single staggered sequence
  (capped around 360ms total) instead of all popping in at once.
- **Hero KPI card** now carries a 7-day trend sparkline and a slow,
  quiet light-sweep — a "this number is alive" cue instead of decoration.
- **Topbar** gets a thin animated line under it that lights up only while
  a fetch is in flight — a second, subtler "live" signal beyond the spinner.
- Respects `prefers-reduced-motion` throughout (everything above turns off).

Functionally nothing changed: same `useAuth`/`useDashboardData` hooks, same
localStorage session shape, same Apps Script query contract.

## ⚠️ Still unconfirmed: the login endpoint

Same caveat as before — I don't have your real `login.html`/Apps Script
login action, so `src/pages/LoginPage.jsx` guesses
`?action=login&username=&password=` against the same script URL, expecting
`{ ok: true, user: { role, name, u } }` back. That's the one fetch call to
fix once you confirm the real contract (or share the Apps Script source /
old login files and I'll wire it up exactly).

## Project structure

```
src/
  pages/          LoginPage, DashboardPage, NotFoundPage
  components/
    layout/        Sidebar, Topbar, BottomNav, MobileDrawer, ToastProvider
    dashboard/      KpiGrid, KpiCard, Sparkline, DipSummaryCard, AgoCard,
                    PaymentBreakdown, TankLevelsCard, SalesTrendCard,
                    TransactionsCard, ExpensesCard, AlertsCard, QuickActionsCard
    ui/             FuelGauge (login page signature element)
  hooks/            useAuth, useDashboardData, useClock, usePageTitle
  utils/format.js
  styles/global.css
```

## What's still not built

Same as before — only the login page + dashboard exist. The rest of the
sidebar/bottom-nav/drawer links (Record Sales, Tank Dip, Discharge, P&L
Report, etc.) point at routes that 404 to the styled not-found page, ready
to be filled in one at a time using the same component patterns.
