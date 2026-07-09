// Uses fetch() — the same proven-reliable method every other save in this
// app already uses with this Apps Script backend (which 302-redirects POST
// responses; fetch follows that correctly with redirect: "follow"). XHR
// was tried here for real upload-progress events, but Apps Script's
// redirect handling under XHR was not reliable, so this trades a
// byte-exact percentage for a save that always actually works — that's
// the right trade. Progress is simulated: it eases up to ~92% over a
// duration based on the payload size, then jumps to 100% the instant the
// real response comes back, so it never lies about completion and never
// hangs at 100% while still waiting.
export async function postWithProgress(url, payload, onProgress) {
  const body = JSON.stringify(payload)
  // Rough duration estimate so a bigger payload eases more slowly —
  // this is a feel-good estimate, not a measurement, which is fine since
  // it's purely cosmetic and the real completion signal is the fetch
  // resolving, not this timer.
  const estimatedMs = Math.min(8000, Math.max(900, body.length / 800))

  let cancelled = false
  let progressTimer = null

  if (onProgress) {
    const start = Date.now()
    progressTimer = setInterval(() => {
      if (cancelled) return
      const elapsed = Date.now() - start
      const pct = Math.min(92, Math.round((elapsed / estimatedMs) * 92))
      onProgress(pct)
    }, 120)
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
      redirect: "follow",
    })
    const json = await res.json()
    if (onProgress) onProgress(100)
    return json
  } finally {
    cancelled = true
    if (progressTimer) clearInterval(progressTimer)
  }
}
