# React Runtime Fix

## Problem
The app was throwing:

`Cannot read properties of null (reading 'useState')`

at `useAuth()` during `App` startup.

## Root cause addressed
The project was registering its production service worker during `vite dev`. That can mix stale cached production chunks with fresh Vite development modules, producing duplicate React instances/dispatchers. React hooks then fail inside `useState`.

## Fixes
- Vite now explicitly deduplicates `react` and `react-dom`.
- Production service-worker registration runs only in production builds.
- Development mode unregisters any old MSO service workers and clears their caches on page load.

## After installing this build
Run:

```bash
rm -rf node_modules/.vite
npm run dev
```

Then hard-refresh the browser once.

If the browser still has an old MSO service worker, open DevTools → Application → Service Workers and unregister the old `/sw.js` worker once.
