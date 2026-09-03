import { useCallback, useEffect, useRef, useState } from "react"
import { getCurrentCoords } from "../utils/geolocation"
/* Tanks and pumps are per-station now — M&M has no TK3, and its pumps map
   to different tanks. Reading a shared config that assumed MSO's layout would
   have collected dips for a tank that does not exist. */
import { tanksFor, pumpsFor } from "../config/stations"
import { activeStation } from "../utils/station"
import { compressImage } from "../utils/compressImage"
import { postWithProgress } from "../utils/postWithProgress"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */

/* How often to re-check whether the GM has approved an edit request. The lock
   status used to be fetched once, on page load — so an approval that landed
   thirty seconds later never reached the supervisor's screen. */
const LOCK_POLL_MS = 15000

// Two different real pumps can share the same signage label (e.g. "P1" on
// Tank 2/PMS and "P1" on Tank 4/AGO — both physically exist at the station).
// pumpId() is that human-facing label — fine for display text and for
// what gets shown/saved as "which pump", but NEVER unique on its own.
// stateKey() is the actual unique identifier (config/pumps.js guarantees
// this) and must be used for anything keyed by identity: React state,
// object keys, form field bindings.
function pumpId(p) {
  return p.pumpId || p.id
}

function stateKey(p) {
  return p.id
}

function emptyReadings() {
  const readings = {}
  pumpsFor(activeStation()).forEach(p => {
    readings[stateKey(p)] = { open: "", close: "" }
  })
  return readings
}

function diffFor(r) {
  const openEntered = r.open !== "" && r.open !== null && r.open !== undefined
  const closeEntered = r.close !== "" && r.close !== null && r.close !== undefined
  const op = Number(r.open) || 0
  const cl = Number(r.close) || 0
  if (!openEntered && !closeEntered) return null
  // Closing hasn't been entered yet — that's normal mid-morning while
  // only Opening is being filled in, not an invalid reading. Only flag
  // an actual error once a real Closing value has been typed in.
  if (!closeEntered) return null
  /* Closing typed in but Opening genuinely never touched — this used to
     silently treat the blank as 0, turning the pump's entire lifetime
     cumulative reading into "today's sales" (confirmed directly: a real
     day this way produced a ₦3.2 billion phantom variance from seven
     pumps whose opening was never entered). Flagged as an error live,
     the moment Closing is typed, not just at final submit. */
  if (!openEntered) return "err"
  if (cl < op) return "err"
  return cl - op
}

/* Attaches the device's GPS coordinates to every save — CEO policy requires
   dip/pump/cash-up submissions to happen physically at the station, and the
   backend verifies this using lat/lng from here. A location that can't be
   obtained is sent as-is (null); the backend treats that as "not verified"
   and rejects with a clear message, rather than this function silently
   deciding what to do about it. */
/* A stalled network used to leave this hanging indefinitely — no timeout,
   no error, just a spinner that never resolved and no way to know whether
   anything actually saved. Confirmed directly: a supervisor's readings
   never made it to PumpMetres at all after his connection stalled mid-
   submit. 25 seconds is generous for a normal request but short enough
   that a genuinely dead connection surfaces as a real, actionable error
   instead of an indefinite wait. */
async function post(payload) {
  const coords = await getCurrentCoords()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000)
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ ...payload, lat: coords?.lat, lng: coords?.lng }),
      redirect: "follow",
      signal: controller.signal,
    })
    return await res.json()
  } catch (e) {
    if (e.name === "AbortError") {
      return { ok: false, error: "This is taking too long — check your connection and try again. Nothing was saved." }
    }
    return { ok: false, error: "Network error — check your connection and try again." }
  } finally {
    clearTimeout(timeoutId)
  }
}

export function useSalesEntry(username, name, selectedDate) {
  const [status, setStatus] = useState("loading")
  const [readings, setReadings] = useState(emptyReadings)
  const [hasOpening, setHasOpening] = useState(false)
  const [hasClosing, setHasClosing] = useState(false)
  /* Which real attendant worked this session — replaces the old behaviour
     where every sale was silently tagged with the SUPERVISOR's own name,
     never an actual attendant. Falls back to the supervisor's name only if
     nobody's selected one, so entry never blocks on this being set. */
  const [attendantId, setAttendantId] = useState("")
  const [attendantName, setAttendantName] = useState("")
  const [saving, setSaving] = useState(false)
  const [savingStep, setSavingStep] = useState(false)
  /* Which session each pump is currently on. After a price cutover a pump
     moves to session 2, and the evening closing must be written to THAT row —
     not back onto the morning session. */
  const [currentSession, setCurrentSession] = useState({})
  const [existingPhotos, setExistingPhotos] = useState({}) // { [pumpId__session]: { session, fileId, submittedBy } }
  const [pumpLocks, setPumpLocks] = useState({}) // { [pumpKey]: boolean }
  const [requestingEdit, setRequestingEdit] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const loadPhotos = useCallback(date => {
    if (!SCRIPT_URL) return
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getPhotos")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (!isMounted.current || !d.ok) return
        const map = {}
        ;(d.photos || []).forEach(p => {
          const key = `${p.subject}__${p.session}`
          map[key] = { session: p.session, fileId: p.fileId, submittedBy: p.submittedBy }
        })
        setExistingPhotos(map)
      })
      .catch(() => {
        // silent — worst case a previously-captured pump photo just
        // doesn't show a thumbnail this load, nothing is lost
      })
  }, [])

  const loadForDate = useCallback(
    date => {
      if (!SCRIPT_URL) {
        setStatus("idle")
        return
      }
      setStatus("loading")
      setReadings(emptyReadings())
      setHasOpening(false)
      setHasClosing(false)
      setExistingPhotos({})
      setPumpLocks({})

      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "getDailyReport")
      url.searchParams.set("station", activeStation())
      url.searchParams.set("date", date)
      url.searchParams.set("username", username || "")

      const lockUrl = new URL(SCRIPT_URL)
      lockUrl.searchParams.set("action", "getEditLockStatus")
      lockUrl.searchParams.set("station", activeStation())
      lockUrl.searchParams.set("date", date)
      fetch(lockUrl.toString(), { method: "GET", redirect: "follow" })
        .then(res => res.json())
        .then(d => {
          if (!isMounted.current || !d.ok) return
          setPumpLocks(d.pumpLocks || {})
        })
        .catch(() => {})

      fetch(url.toString(), { method: "GET", redirect: "follow" })
        .then(res => res.json())
        .then(d => {
          if (!isMounted.current) return
          if (!d.ok || !d.report || !d.report.pumpMetres) {
            setStatus("ready")
            return
          }
          const pm = d.report.pumpMetres
          const next = emptyReadings()
          const nextSession = {}
          let anyOpen = false
          let anyClose = false

          pumpsFor(activeStation()).forEach(p => {
            const key = stateKey(p)
            /* The LATEST session, not the first. After a mid-day price cutover a
               pump has two (or more) sessions; the one still open is the last.
               Reading sessions[0] showed the supervisor the morning session and
               would have overwritten it with the evening's closing figure. */
            const all = (pm[key] && pm[key].sessions) || []
            const session = all.length
              ? all.reduce((a, b) => ((b.sessNum || 1) >= (a.sessNum || 1) ? b : a))
              : null
            if (session) {
              if (session.open > 0) anyOpen = true
              if (session.close > 0) anyClose = true
              next[key] = { open: session.open || "", close: session.close || "" }
              nextSession[key] = session.sessNum || 1
            }
          })

          setReadings(next)
          setCurrentSession(nextSession)
          setHasOpening(anyOpen)
          setHasClosing(anyClose)
          setStatus("ready")
        })
        .catch(() => {
          if (!isMounted.current) return
          setStatus("error")
        })

      loadPhotos(date)
    },
    [username, loadPhotos]
  )

  useEffect(() => {
    if (selectedDate) loadForDate(selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  /* Lock-only refetch, so an approval unlocks the pump on its own rather than
     leaving the supervisor stuck on "Waiting for approval" until they think to
     change the date and change it back. */
  const refreshLocks = useCallback(date => {
    if (!SCRIPT_URL || !date) return
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getEditLockStatus")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!isMounted.current || !d.ok) return
        setPumpLocks(d.pumpLocks || {})
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      refreshLocks(selectedDate)
    }
    const id = setInterval(tick, LOCK_POLL_MS)
    const onVisible = () => { if (document.visibilityState === "visible") refreshLocks(selectedDate) }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [selectedDate, refreshLocks])

  const updateReading = useCallback((pid, field, value) => {
    setReadings(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: value } }))
  }, [])

  const clearAll = useCallback(() => {
    setReadings(emptyReadings())
  }, [])

  const grandTotals = useCallback(
    prices => {
      let pmsL = 0, agoL = 0, lpgKg = 0
      let hasError = false
      pumpsFor(activeStation()).forEach(p => {
        const key = stateKey(p)
        const d = diffFor(readings[key])
        if (d === "err") hasError = true
        else if (typeof d === "number") {
          if (p.product === "AGO") agoL += d
          else if (p.product === "LPG") lpgKg += d
          else pmsL += d
        }
      })
      return {
        pmsL,
        agoL,
        lpgKg,
        pmsRev: Math.round(pmsL * prices.pms),
        agoRev: Math.round(agoL * prices.ago),
        lpgRev: Math.round(lpgKg * (prices.lpg || 0)),
        hasError,
      }
    },
    [readings]
  )

  const hasAnyReading = useCallback(
    field => pumpsFor(activeStation()).some(p => Number(readings[stateKey(p)][field]) > 0),
    [readings]
  )

  // Saves exactly one pump's reading — used both for the incremental
  // "Save and Continue" step (so progress survives leaving mid-way
  // through the wizard) and inside the final submit's batch loop.
  const saveOnePump = useCallback(
    (p, date, prices, notes) => {
      const key = stateKey(p)
      const label = pumpId(p)
      const r = readings[key] || { open: "", close: "" }
      const openEntered = r.open !== "" && r.open !== null && r.open !== undefined
      const closeEntered = r.close !== "" && r.close !== null && r.close !== undefined
      const op = Number(r.open) || 0
      const cl = Number(r.close) || 0
      const price = p.product === "AGO" ? prices.ago : p.product === "LPG" ? (prices.lpg || 0) : prices.pms
      const diff = cl >= op ? cl - op : 0

      if (!openEntered && !closeEntered) return Promise.resolve({ ok: true, skipped: true })

      /* The actual root of the fix — this is the function that really sends
         the save. A closing reading with opening genuinely blank used to
         default op to 0 here and send diff = the pump's entire lifetime
         cumulative reading as "today's sales" (confirmed directly: this
         produced a ₦3.2 billion phantom variance on a real day, from seven
         pumps saved this way). Blocked here now, not just in the bulk
         submit path, so "Save and Continue" on a single pump can't hit it
         either. */
      if (closeEntered && !openEntered) {
        return Promise.resolve({
          ok: false,
          pumpLabel: label,
          error: `${label} has a closing reading but no opening reading. Enter the opening first.`,
        })
      }

      return post({
        /* Was two separate calls — savePumpMetre, then a distinct
           saveSale afterward — confirmed directly as the cause of a
           real, recurring bug: the second could silently fail while
           the first succeeded (21 July, 1 September, and repeatedly
           on M&M's P1_AGO). The backend now writes both the reading
           and its SalesLog entry together in one call, so there's no
           longer a second network round-trip that can fail on its
           own — this is the only save needed now. */
        action: "savePumpMetre", station: activeStation(), username, date,
        pump: key, product: p.product, tank: p.tank,
        openingMetre: op, closingMetre: cl, diff, price,
        amount: Math.round(diff * price), sessionNum: currentSession[stateKey(p)] || 1,
        payMethod: "Mixed", attendant: attendantName || name || username, attendantId: attendantId || "", notes: notes || "",
      })
        .catch(() => ({ ok: false, error: "Network error — check connection" }))
        .then(res => {
          const metreOk = !!(res && res.ok)
          if (!metreOk) return { ok: false, pumpLabel: label, error: res?.error, locked: res?.locked }
          return { ok: metreOk, pumpLabel: label }
        })
    },
    [readings, username, name, attendantId, attendantName]
  )

  const submit = useCallback(
    (date, prices, notes) => {
      const { pmsL, agoL, lpgKg, pmsRev, agoRev, lpgRev, hasError } = grandTotals(prices)
      if (hasError) return Promise.resolve({ ok: false, error: "Fix errors before submitting" })
      if (!hasAnyReading("open") && !hasAnyReading("close")) {
        return Promise.resolve({ ok: false, error: "Enter at least one pump reading" })
      }

      /* A closing reading submitted while opening is genuinely blank used
         to silently default to 0 — turning a pump's entire lifetime
         cumulative meter reading into "today's sales" (confirmed directly:
         this produced a ₦3.2 billion phantom variance on a real day, from
         seven pumps whose opening step was never completed). Caught here
         now, before it ever reaches the server, with a clear message
         naming exactly which pump needs its opening entered. */
      const missingOpening = pumpsFor(activeStation()).filter(p => {
        const r = readings[stateKey(p)]
        const closeEntered = r.close !== "" && r.close !== null && r.close !== undefined
        const openEntered = r.open !== "" && r.open !== null && r.open !== undefined
        return closeEntered && !openEntered
      })
      if (missingOpening.length > 0) {
        const names = missingOpening.map(p => pumpId(p)).join(", ")
        return Promise.resolve({
          ok: false,
          error: `${names} has a closing reading but no opening reading. Enter the opening first — submitting without it would count the pump's entire lifetime total as today's sales.`,
        })
      }

      // IMPORTANT: this payload must NEVER include tk1_opening/tk1_closing/
      // tk1_diff/tk1_margin (or tk2-4/lpg_tank equivalents). Those columns
      // hold the supervisor's physical tank dip readings (litres/kg
      // actually in the tank, bounded by tank capacity) — a completely
      // different number from a pump meter reading (a cumulative
      // odometer-style total that only ever grows, often into the
      // hundreds of thousands). Writing pump data into the dip columns
      // previously corrupted tank stock levels and made Tank Levels show
      // nonsensical percentages.
      //
      // LPG's kg/price/revenue are now sourced from real pump readings
      // here, same as PMS/AGO — previously these came from a manually
      // typed guess on the Cash-up page, which is now just "Amount
      // Remitted" for reconciliation, matching how PMS/AGO already work.
      const data = {
        pms_litres: pmsL, pms_price: prices.pms, pms_revenue: pmsRev,
        ago_litres: agoL, ago_price: prices.ago, ago_revenue: agoRev,
        grand_total: pmsRev + agoRev,
        lpg_kg: lpgKg, lpg_price: prices.lpg || 0, lpg_revenue: lpgRev,
      }

      setSaving(true)
      return post({ action: "saveDailyReport", station: activeStation(), username, date, data })
        .then(d => {
          if (!d.ok) {
            setSaving(false)
            return d
          }
          const failedPumps = []
          const pumpsWithReadings = pumpsFor(activeStation()).filter(p => {
            const r = readings[stateKey(p)]
            const hasReading = Number(r.open) > 0 || Number(r.close) > 0
            // Locked pumps are already correctly saved (that's exactly
            // why they're locked) — skip re-saving them here instead of
            // sending a save the backend will reject, which would
            // otherwise show up as a confusing "failed" pump.
            // Locked pumps are already correctly saved (that's exactly
            // why they're locked) — skip re-saving them here instead of
            // sending a save the backend will reject, which would
            // otherwise show up as a confusing "failed" pump. Which lock
            // applies depends on what's actually about to be resubmitted:
            // a real closing value makes this a closing-type save, same
            // rule the backend uses.
            const lock = pumpLocks[stateKey(p)]
            const wouldBeClosingSave = Number(r.close) > 0
            const relevantlyLocked = lock && (wouldBeClosingSave ? lock.closeLocked : lock.openLocked)
            return hasReading && !relevantlyLocked
          })

          // Saved in small batches rather than all at once — firing up to
          // 14 simultaneous POSTs (2 per pump x 7 pumps) at Apps Script
          // in one Promise.all was a plausible cause of an occasional
          // silent drop under load. A few at a time is still fast but
          // much less likely to overwhelm the script's concurrency limits.
          // Most pumps were likely already saved incrementally via
          // "Save and Continue" — re-saving here is cheap (an update, not
          // a duplicate row) and acts as a safety net for anything that
          // failed to save along the way.
          const BATCH_SIZE = 3
          const savePump = p =>
            saveOnePump(p, date, prices, notes).then(res => {
              if (!res.ok) failedPumps.push(res.pumpLabel || pumpId(p))
              return res
            })

          let chain = Promise.resolve()
          for (let i = 0; i < pumpsWithReadings.length; i += BATCH_SIZE) {
            const batch = pumpsWithReadings.slice(i, i + BATCH_SIZE)
            chain = chain.then(() => Promise.all(batch.map(savePump)))
          }

          return chain.then(() => {
            setSaving(false)
            if (failedPumps.length > 0) {
              return { ok: false, error: `Reading didn't save for: ${failedPumps.join(", ")}. Please try those pumps again.` }
            }
            return d
          })
        })
        .catch(() => {
          setSaving(false)
          return { ok: false, error: "Network error — check connection" }
        })
    },
    [readings, username, name, attendantId, attendantName, grandTotals, hasAnyReading, saveOnePump, pumpLocks]
  )

  const savePhoto = useCallback(
    async (date, session, subject, dataUrl, mimeType, onProgress) => {
      let toSend = dataUrl
      let sendMime = mimeType || "image/jpeg"
      try {
        const compressed = await compressImage(dataUrl)
        toSend = compressed.dataUrl
        sendMime = compressed.mimeType
      } catch (e) {
        // fall back to original image if compression fails for any reason
      }

      const base64 = toSend.split(",")[1]
      try {
        return await postWithProgress(
          SCRIPT_URL,
          { action: "savePhoto", station: activeStation(), username, date, session, subject, mimeType: sendMime, base64 },
          onProgress
        )
      } catch (e) {
        return { ok: false }
      }
    },
    [username]
  )

  const saveStep = useCallback(
    (p, date, prices, notes) => {
      setSavingStep(true)
      return saveOnePump(p, date, prices, notes).then(res => {
        setSavingStep(false)
        return res
      })
    },
    [saveOnePump]
  )

  const requestEditPump = useCallback(
    (date, pumpLabel, pumpKey, mode, message) => {
      setRequestingEdit(true)
      return post({
        action: "saveEditRequest", station: activeStation(), username, name,
        date, type: `pump_${mode === "close" ? "close" : "open"}_${pumpKey}`,
        message: message || `Requesting permission to correct Pump ${pumpLabel} (${mode === "close" ? "Closing" : "Opening"})`,
      }).then(d => {
        setRequestingEdit(false)
        return d
      }).catch(() => {
        setRequestingEdit(false)
        return { ok: false, error: "Network error — check connection" }
      })
    },
    [username, name]
  )

  return {
    status, readings, hasOpening, hasClosing, existingPhotos,
    updateReading, clearAll, grandTotals, submit, savePhoto, saving,
    saveStep, savingStep, pumpLocks, requestEditPump, requestingEdit,
    attendantId, setAttendantId, attendantName, setAttendantName,
    refresh: () => loadForDate(selectedDate),
  }
}
