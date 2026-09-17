/* Shared, retry-aware fetch wrapper — the foundation for fixing the
   network-reliability problem confirmed directly: pump-side pages at
   the station often sit on weak signal, and a single dropped request
   currently just fails outright with no second attempt.

   This does NOT retry everything blindly — only failures that are
   genuinely worth retrying (a network drop, a timeout, a 5xx from the
   server). A real validation error (wrong password, missing field)
   fails immediately, since retrying that would just waste time and
   confuse whoever's waiting.

   Existing per-page getAPI/postAPI functions are untouched by this
   file alone — adopting this is a deliberate, page-by-page migration,
   not a blanket replacement, so nothing breaks by this file merely
   existing. */

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

function isRetryable(error, response) {
  if (error) return true // network failure, timeout, DNS, etc. — always worth another try
  if (response && response.status >= 500) return true // server-side hiccup
  return false
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/* Core retry loop. maxAttempts=3 means the request is tried up to 3
   times total before giving up — the first attempt plus two retries.
   Backoff is short (500ms, then 1200ms) — long enough to let a brief
   signal drop clear, short enough that a genuine failure doesn't leave
   someone staring at a spinner for a long time before finding out. */
async function fetchWithRetry(url, options, maxAttempts = 3) {
  const backoffMs = [500, 1200]
  let lastError = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, options)
      if (response.ok || !isRetryable(null, response)) {
        return response
      }
      lastError = new Error(`Server returned ${response.status}`)
    } catch (err) {
      lastError = err
      if (!isRetryable(err, null)) throw err
    }

    if (attempt < maxAttempts - 1) {
      await delay(backoffMs[attempt] || 1200)
    }
  }

  throw lastError
}

/* GET-style call — params go on the query string, matching every
   existing per-page getAPI convention exactly, so migrating a page
   over is a drop-in swap, not a rewrite of its call sites. */
export async function apiGet(action, params = {}) {
  if (!SCRIPT_URL) return { ok: false, error: "App isn't configured — missing script URL." }
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", action)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  })

  try {
    const response = await fetchWithRetry(url.toString(), { method: "GET", redirect: "follow" })
    return await response.json()
  } catch (err) {
    return { ok: false, error: "Network error — please check your connection and try again.", networkFailure: true }
  }
}

/* POST-style call — same retry treatment. Only used for calls that
   are safe to retry automatically (the backend's own duplicate-check
   and lock protection, hardened earlier, is what makes this safe —
   see savePumpMetre / withLock). A call this wrapper should NEVER
   retry on its own — one that isn't naturally safe to repeat — should
   keep using its page's existing, non-retrying postAPI instead. */
export async function apiPost(action, body = {}) {
  if (!SCRIPT_URL) return { ok: false, error: "App isn't configured — missing script URL." }

  try {
    const response = await fetchWithRetry(SCRIPT_URL, {
      method: "POST",
      redirect: "follow",
      body: JSON.stringify({ action, ...body }),
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: "Network error — please check your connection and try again.", networkFailure: true }
  }
}
