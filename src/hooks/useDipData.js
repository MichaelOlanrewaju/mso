import { useCallback, useEffect, useRef, useState } from "react"
import { getCurrentCoords } from "../utils/geolocation"
/* Tanks and pumps are per-station now — M&M has no TK3, and its pumps map
   to different tanks. Reading a shared config that assumed MSO's layout would
   have collected dips for a tank that does not exist. */
import { tanksFor, pumpsFor } from "../config/stations"
import { activeStation } from "../utils/station"
import { getToken } from "../utils/session"
import { compressImage } from "../utils/compressImage"
import { postWithProgress } from "../utils/postWithProgress"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */

/* How often to re-check whether the GM has approved an edit request. Fifteen
   seconds: fast enough that a supervisor standing at the tank isn't left
   waiting, slow enough not to hammer Apps Script. */
const LOCK_POLL_MS = 15000

/* Built from the station's real tank list. Hardcoding TK1..TK5 would create a
   TK3 entry at M&M — a tank that doesn't exist — and every `tankState[t.id]`
   lookup elsewhere would then quietly read and write a phantom reading. */
/* Fields start BLANK ("") rather than 0. Seeding 0 meant every tank arrived
   already claiming to have been measured as empty, so a supervisor typing a
   genuine 0 changed nothing and had no way to tell whether it registered. */
function emptyTankState() {
  const state = {}
  tanksFor(activeStation()).forEach(t => { state[t.id] = { open: "", close: "" } })
  return state
}

// LPG (TK5) uses a distinct backend field-naming convention
// (lpg_tank_opening, not tk5_opening) since it was added after the
// original PMS/AGO tank schema and deliberately kept separate — it has
// its own price and is measured in KG, not litres.
function fieldPrefix(tankId) {
  return tankId === "TK5" ? "lpg_tank" : tankId.toLowerCase()
}

/* Attaches the device's GPS coordinates to every save — CEO policy requires
   dip/pump/cash-up submissions to happen physically at the station, and the
   backend verifies this using lat/lng from here. A location that can't be
   obtained is sent as-is (null); the backend treats that as "not verified"
   and rejects with a clear message, rather than this function silently
   deciding what to do about it. */
/* A stalled network used to leave this hanging indefinitely — no timeout,
   no error, just a spinner that never resolved and no way to know whether
   anything actually saved. Same fix as sales entry: fails clearly after
   25 seconds instead of an indefinite wait. */
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

function preservedFields(rawReport) {
  // Every field saveDailyReport writes that ISN'T a tank-stock field —
  // pulled from the existing row so a dip save never zeroes out
  // pump-metre, cash/POS/expense/LPG data that Sales or a cashier
  // already submitted for this date. saveDailyReport does a full
  // 50-column row overwrite, not a merge, so this matters every time.
  const r = rawReport || {}
  return {
    pms_margin: r.pms_margin || 0,
    pms_litres: r.pms_litres || 0,
    pms_price: r.pms_price || 0,
    pms_revenue: r.pms_revenue || 0,
    ago_margin: r.ago_margin || 0,
    ago_litres: r.ago_litres || 0,
    ago_price: r.ago_price || 0,
    ago_revenue: r.ago_revenue || 0,
    grand_total: r.grand_total || 0,
    pos_mp: r.pos_mp || 0,
    pos_zm: r.pos_zm || 0,
    trf_mp: r.trf_mp || 0,
    trf_zb_amelia: r.trf_zb_amelia || 0,
    trf_fcmb_truck: r.trf_fcmb_truck || 0,
    trf_fcmb_md: r.trf_fcmb_md || 0,
    cash: r.cash || 0,
    total_expenses: r.total_expenses || 0,
    to_bank: r.to_bank || 0,
    pos_mp_charge: r.pos_mp_charge || 0,
    pos_zm_charge: r.pos_zm_charge || 0,
    emtl_counts: r.emtl_counts || 0,
    lubricant_rev: r.lubricant_rev || 0,
    lpg_kg: r.lpg_kg || 0,
    lpg_price: r.lpg_price || 0,
    lpg_revenue: r.lpg_revenue || 0,
    lpg_remitted: r.lpg_remitted || 0,
    pms_cash_summary: r.pms_cash_summary || 0,
    oil_cash_summary: r.oil_cash_summary || 0,
    gas_cash_summary: r.gas_cash_summary || 0,
    total_cash_summary: r.total_cash_summary || 0,
  }
}

export function useDipData(username, selectedDate) {
  const [status, setStatus] = useState("loading")
  const [tankState, setTankState] = useState(emptyTankState())
  const [hasOpening, setHasOpening] = useState(false)
  const [hasClosing, setHasClosing] = useState(false)
  const [hasCash, setHasCash] = useState(false)
  const [dipOpeningLocked, setDipOpeningLocked] = useState(false)
  const [dipClosingLocked, setDipClosingLocked] = useState(false)
  const [requestingEdit, setRequestingEdit] = useState(false)
  const [existingPhotos, setExistingPhotos] = useState({}) // { [subject__session]: { session, fileId, submittedBy } }
  const rawReportRef = useRef(null)
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
          // Keyed by subject+session so a morning photo doesn't make an
          // evening photo for the same tank look already-captured.
          const key = `${p.subject}__${p.session}`
          map[key] = { session: p.session, fileId: p.fileId, submittedBy: p.submittedBy }
        })
        setExistingPhotos(map)
      })
      .catch(() => {
        // silent — worst case the page just shows "no photo yet" for
        // an already-captured tank, which is the prior behavior anyway
      })
  }, [])

  const loadForDate = useCallback(
    date => {
      if (!SCRIPT_URL) {
        setStatus("idle")
        return
      }
      setStatus("loading")
      setTankState(emptyTankState())
      setHasOpening(false)
      setHasClosing(false)
      setHasCash(false)
      setExistingPhotos({})
      rawReportRef.current = null

      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "getDailyReport")
      url.searchParams.set("station", activeStation())
      url.searchParams.set("date", date)
      url.searchParams.set("username", username || "")

      fetch(url.toString(), { method: "GET", redirect: "follow" })
        .then(res => res.json())
        .then(d => {
          if (!isMounted.current) return
          if (!d.ok || !d.report) {
            setStatus("ready")
            return
          }
          const r = d.report
          rawReportRef.current = r
          const next = emptyTankState()
          tanksFor(activeStation()).forEach(t => {
            const k = fieldPrefix(t.id)
            const rawOpen = r[`${k}_opening`]
            const rawClose = r[`${k}_closing`]
            next[t.id] = {
              open: rawOpen === "" || rawOpen === null || rawOpen === undefined ? "" : Number(rawOpen),
              close: rawClose === "" || rawClose === null || rawClose === undefined ? "" : Number(rawClose),
            }
          })
          setTankState(next)

          /* Any tank with a reading means that dip was done — TK1/TK2 alone
             was a single-station assumption and would throw at M&M, which has
             no TK3 and may leave TK1 empty. */
          const _tk = tanksFor(activeStation())
          const openDone = _tk.some(t => Number(next[t.id]?.open) > 0)
          const closeDone = _tk.some(t => Number(next[t.id]?.close) > 0)
          const cashDone = Number(r.to_bank || 0) > 0
          setHasOpening(openDone)
          setHasClosing(closeDone)
          setHasCash(cashDone)
          setStatus("ready")
        })
        .catch(() => {
          if (!isMounted.current) return
          setStatus("error")
        })

      // Lock status — separate call so a failure here doesn't block the
      // whole page load, just leaves fields editable-by-default rather
      // than falsely locked.
      const lockUrl = new URL(SCRIPT_URL)
      lockUrl.searchParams.set("action", "getEditLockStatus")
      lockUrl.searchParams.set("station", activeStation())
      lockUrl.searchParams.set("date", date)
      fetch(lockUrl.toString(), { method: "GET", redirect: "follow" })
        .then(res => res.json())
        .then(d => {
          if (!isMounted.current || !d.ok) return
          setDipOpeningLocked(!!d.dipOpeningLocked)
          setDipClosingLocked(!!d.dipClosingLocked)
        })
        .catch(() => {})

      loadPhotos(date)
    },
    [username, loadPhotos]
  )

  /* Re-check the locks without reloading the whole day.
     Why this exists: the lock status was fetched ONCE, on page load. So when a
     supervisor requested an edit and the GM approved it thirty seconds later,
     the supervisor's screen never found out — it sat on "Waiting for approval"
     with the fields locked, indefinitely. The only escape was to change the
     date away and back, or hard-refresh. */
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
        setDipOpeningLocked(!!d.dipOpeningLocked)
        setDipClosingLocked(!!d.dipClosingLocked)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedDate) loadForDate(selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  /* Poll the locks so an approval lands on the supervisor's screen on its own.
     Skipped while the tab is hidden — no point burning requests on a phone in
     someone's pocket — and fired immediately on return, so unlocking your phone
     shows the current state rather than a stale one. */
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

  /* An empty box and a typed 0 are different facts, and `Number(value) || 0`
     erased that distinction — which is why a genuinely empty tank could not be
     recorded. "" means not entered; 0 means measured as empty. */
  const updateTank = useCallback((tankId, field, value) => {
    const v = value === "" || value === null || value === undefined ? "" : Number(value)
    setTankState(prev => ({ ...prev, [tankId]: { ...prev[tankId], [field]: Number.isNaN(v) ? "" : v } }))
  }, [])

  /* Was this reading actually entered? 0 counts; blank does not. */
  const isEntered = v => v !== "" && v !== null && v !== undefined && !Number.isNaN(Number(v))

  const saveOpening = useCallback(
    date => {
      /* A tank measured at 0 has been read. Requiring > 0 meant an empty tank
         could never be recorded, and the whole submission was refused. */
      const hasAny = tanksFor(activeStation()).some(t => isEntered(tankState[t.id]?.open))
      if (!hasAny) return Promise.resolve({ ok: false, error: "Enter at least one opening stock reading" })

      /* Built from the station's actual tanks. Hardcoding TK1..TK4 crashed at
         M&M, which has no TK3 — tankState.TK3 is undefined there. */
      const data = { ...preservedFields(rawReportRef.current) }
      tanksFor(activeStation()).forEach(t => {
        const val = tankState[t.id]?.open
        const num = isEntered(val) ? Number(val) : 0
        if (t.id === "TK5") {
          data.lpg_tank_opening = num
          data.lpg_tank_closing = 0
          data.lpg_tank_diff = 0
          data.lpg_tank_margin = 0
        } else {
          const k = t.id.toLowerCase()
          data[`${k}_opening`] = num
          data[`${k}_closing`] = 0
          data[`${k}_diff`] = 0
          data[`${k}_margin`] = 0
        }
      })

      return post({ action: "saveDailyReport", station: activeStation(), username, date, data }).then(d => {
        if (!d.ok) return d
        rawReportRef.current = { ...rawReportRef.current, ...data }
        return d
      })
    },
    [tankState, username]
  )

  const saveClosing = useCallback(
    date => {
      // Dip only ever reports the raw stock difference now — margin
      // (dip diff minus pump diff) is computed on the Records page,
      // once both Dip and Sales data exist for the date. The opening
      // reading itself already includes any discharge received today —
      // saveDischarge bumps it directly the moment a delivery is recorded —
      // so this stays a plain opening-minus-closing, nothing special needed.
      const tankDiffs = {}
      let anyDiff = false

      /* A tank that sold everything closes at 0 — and the old `s.close > 0`
         test scored that as no sale at all, quietly dropping a full tank's
         worth of litres from the day. What matters is whether both readings
         were ENTERED, not whether they're above zero. */
      let anyClosingEntered = false
      tanksFor(activeStation()).forEach(tk => {
        const st = tankState[tk.id] || {}
        const openEntered = isEntered(st.open)
        const closeEntered = isEntered(st.close)
        if (closeEntered) anyClosingEntered = true
        const o = Number(st.open) || 0
        const c = Number(st.close) || 0
        const diff = openEntered && closeEntered && o > c ? o - c : 0
        tankDiffs[tk.id] = diff
        if (diff > 0) anyDiff = true
      })

      /* Gate on a closing reading being entered, not on it producing a
         positive difference — a day with genuinely no movement is still a day
         that was measured and should be recordable. */
      if (!anyClosingEntered) {
        return Promise.resolve({ ok: false, error: "Enter closing stock readings first" })
      }

      // Existing margin values are preserved as-is (not recalculated
      // here) since margin depends on pump data Dip no longer touches.
      // The Records page is responsible for writing fresh margin
      // figures once pump readings are also in for this date.
      const prevReport = rawReportRef.current || {}
      const data = { ...preservedFields(rawReportRef.current) }
      tanksFor(activeStation()).forEach(t => {
        const st = tankState[t.id] || {}
        const o = isEntered(st.open) ? Number(st.open) : 0
        const c = isEntered(st.close) ? Number(st.close) : 0
        if (t.id === "TK5") {
          data.lpg_tank_opening = o
          data.lpg_tank_closing = c
          data.lpg_tank_diff = tankDiffs.TK5 || 0
          data.lpg_tank_margin = prevReport.lpg_tank_margin || 0
        } else {
          const k = t.id.toLowerCase()
          data[`${k}_opening`] = o
          data[`${k}_closing`] = c
          data[`${k}_diff`] = tankDiffs[t.id] || 0
          data[`${k}_margin`] = prevReport[`${k}_margin`] || 0
        }
      })

      return post({ action: "saveDailyReport", station: activeStation(), username, date, data }).then(d => {
        if (!d.ok) return d
        rawReportRef.current = { ...rawReportRef.current, ...data }
        return d
      })
    },
    [tankState, username]
  )

  const savePhoto = useCallback(
    async (date, session, subject, dataUrl, mimeType, onProgress) => {
      let toSend = dataUrl
      let sendMime = mimeType || "image/jpeg"

      // Compress first — this is the real speed win. A 5MB camera photo
      // becomes a few hundred KB, so the upload itself (the slow part)
      // has far less data to push, on top of giving real percentage
      // feedback during whatever's left.
      try {
        const compressed = await compressImage(dataUrl)
        toSend = compressed.dataUrl
        sendMime = compressed.mimeType
      } catch (e) {
        // If compression fails for any reason, fall back to the original
        // image rather than losing the photo entirely.
      }

      const base64 = toSend.split(",")[1]
      try {
        const result = await postWithProgress(
          SCRIPT_URL,
          { action: "savePhoto", station: activeStation(), username, date, session, subject, mimeType: sendMime, base64 },
          onProgress
        )
        return result
      } catch (e) {
        return { ok: false }
      }
    },
    [username]
  )

  const requestEdit = useCallback(
    (date, type, name, message) => {
      setRequestingEdit(true)
      return post({
        action: "saveEditRequest", station: activeStation(), username, name,
        date, type, message: message || "Requesting permission to correct an entry",
      }).then(d => {
        setRequestingEdit(false)
        return d
      }).catch(() => {
        setRequestingEdit(false)
        return { ok: false, error: "Network error — check connection" }
      })
    },
    [username]
  )

  return {
    status,
    tankState,
    hasOpening,
    hasClosing,
    hasCash,
    dipOpeningLocked,
    dipClosingLocked,
    requestEdit,
    requestingEdit,
    refreshLocks,
    existingPhotos,
    updateTank,
    saveOpening,
    saveClosing,
    savePhoto,
    refresh: () => loadForDate(selectedDate || new Date().toISOString().split("T")[0]),
    configured: Boolean(SCRIPT_URL),
  }
}
