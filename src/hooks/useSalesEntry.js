import { useCallback, useEffect, useRef, useState } from "react"
import { PUMPS } from "../config/pumps"
import { compressImage } from "../utils/compressImage"
import { postWithProgress } from "../utils/postWithProgress"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

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
  PUMPS.forEach(p => {
    readings[stateKey(p)] = { open: "", close: "" }
  })
  return readings
}

function diffFor(r) {
  const op = Number(r.open) || 0
  const cl = Number(r.close) || 0
  if (op === 0 && cl === 0) return null
  // Closing hasn't been entered yet — that's normal mid-morning while
  // only Opening is being filled in, not an invalid reading. Only flag
  // an actual error once a real Closing value has been typed in and
  // it's genuinely lower than Opening (pump meters only count up).
  if (cl === 0) return null
  if (cl < op) return "err"
  return cl - op
}

function post(payload) {
  return fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload),
    redirect: "follow",
  }).then(res => res.json())
}

export function useSalesEntry(username, name, selectedDate) {
  const [status, setStatus] = useState("loading")
  const [readings, setReadings] = useState(emptyReadings)
  const [hasOpening, setHasOpening] = useState(false)
  const [hasClosing, setHasClosing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingStep, setSavingStep] = useState(false)
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
    url.searchParams.set("station", STATION_KEY)
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
      url.searchParams.set("station", STATION_KEY)
      url.searchParams.set("date", date)
      url.searchParams.set("username", username || "")

      const lockUrl = new URL(SCRIPT_URL)
      lockUrl.searchParams.set("action", "getEditLockStatus")
      lockUrl.searchParams.set("station", STATION_KEY)
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
          let anyOpen = false
          let anyClose = false

          PUMPS.forEach(p => {
            const key = stateKey(p)
            const session = pm[key] && pm[key].sessions && pm[key].sessions[0]
            if (session) {
              if (session.open > 0) anyOpen = true
              if (session.close > 0) anyClose = true
              next[key] = { open: session.open || "", close: session.close || "" }
            }
          })

          setReadings(next)
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
      PUMPS.forEach(p => {
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
    field => PUMPS.some(p => Number(readings[stateKey(p)][field]) > 0),
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
      const op = Number(r.open) || 0
      const cl = Number(r.close) || 0
      const price = p.product === "AGO" ? prices.ago : p.product === "LPG" ? (prices.lpg || 0) : prices.pms
      const diff = cl >= op ? cl - op : 0

      if (op === 0 && cl === 0) return Promise.resolve({ ok: true, skipped: true })

      return post({
        action: "savePumpMetre", station: STATION_KEY, username, date,
        pump: key, product: p.product, tank: p.tank,
        openingMetre: op, closingMetre: cl, diff, price,
        amount: Math.round(diff * price), sessionNum: 1,
      })
        .catch(() => ({ ok: false, error: "Network error — check connection" }))
        .then(res => {
          const metreOk = !!(res && res.ok)
          if (!metreOk) return { ok: false, pumpLabel: label, error: res?.error, locked: res?.locked }
          if (diff <= 0) return { ok: metreOk, pumpLabel: label }
          // saleSave failing doesn't lose the metre reading itself — it's
          // the SalesLog/transactions feed, not the reading of record —
          // so it's attempted but doesn't fail the whole pump save.
          return post({
            action: "saveSale", station: STATION_KEY, username, date,
            tank: p.tank, pump: label, product: p.product,
            litres: diff, pricePerL: price, amount: Math.round(diff * price),
            payMethod: "Mixed", attendant: name || username, notes: notes || "",
          })
            .catch(() => null)
            .then(() => ({ ok: metreOk, pumpLabel: label }))
        })
    },
    [readings, username, name]
  )

  const submit = useCallback(
    (date, prices, notes) => {
      const { pmsL, agoL, lpgKg, pmsRev, agoRev, lpgRev, hasError } = grandTotals(prices)
      if (hasError) return Promise.resolve({ ok: false, error: "Fix errors before submitting" })
      if (!hasAnyReading("open") && !hasAnyReading("close")) {
        return Promise.resolve({ ok: false, error: "Enter at least one pump reading" })
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
      return post({ action: "saveDailyReport", station: STATION_KEY, username, date, data })
        .then(d => {
          if (!d.ok) {
            setSaving(false)
            return d
          }
          const failedPumps = []
          const pumpsWithReadings = PUMPS.filter(p => {
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
    [readings, username, name, grandTotals, hasAnyReading, saveOnePump, pumpLocks]
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
          { action: "savePhoto", station: STATION_KEY, username, date, session, subject, mimeType: sendMime, base64 },
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
        action: "saveEditRequest", station: STATION_KEY, username, name,
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
    refresh: () => loadForDate(selectedDate),
  }
}
