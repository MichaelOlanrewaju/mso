import { useCallback, useEffect, useRef, useState } from "react"
import { TANKS } from "../config/pumps"
import { compressImage } from "../utils/compressImage"
import { postWithProgress } from "../utils/postWithProgress"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"
/* How often to re-check whether the GM has approved an edit request. Fifteen
   seconds: fast enough that a supervisor standing at the tank isn't left
   waiting, slow enough not to hammer Apps Script. */
const LOCK_POLL_MS = 15000

export { TANKS }

function emptyTankState() {
  return { TK1: { open: 0, close: 0 }, TK2: { open: 0, close: 0 }, TK3: { open: 0, close: 0 }, TK4: { open: 0, close: 0 }, TK5: { open: 0, close: 0 } }
}

// LPG (TK5) uses a distinct backend field-naming convention
// (lpg_tank_opening, not tk5_opening) since it was added after the
// original PMS/AGO tank schema and deliberately kept separate — it has
// its own price and is measured in KG, not litres.
function fieldPrefix(tankId) {
  return tankId === "TK5" ? "lpg_tank" : tankId.toLowerCase()
}

function post(payload) {
  return fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload),
    redirect: "follow",
  }).then(res => res.json())
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
    url.searchParams.set("station", STATION_KEY)
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
      url.searchParams.set("station", STATION_KEY)
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
          TANKS.forEach(t => {
            const k = fieldPrefix(t.id)
            next[t.id] = {
              open: Number(r[`${k}_opening`]) || 0,
              close: Number(r[`${k}_closing`]) || 0,
            }
          })
          setTankState(next)

          const openDone = Number(next.TK1.open) > 0 || Number(next.TK2.open) > 0
          const closeDone = Number(next.TK1.close) > 0 || Number(next.TK2.close) > 0
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
      lockUrl.searchParams.set("station", STATION_KEY)
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
    url.searchParams.set("station", STATION_KEY)
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

  const updateTank = useCallback((tankId, field, value) => {
    setTankState(prev => ({ ...prev, [tankId]: { ...prev[tankId], [field]: Number(value) || 0 } }))
  }, [])

  const saveOpening = useCallback(
    date => {
      const hasAny = TANKS.some(t => tankState[t.id].open > 0)
      if (!hasAny) return Promise.resolve({ ok: false, error: "Enter at least one opening stock reading" })

      const data = {
        tk1_opening: tankState.TK1.open, tk2_opening: tankState.TK2.open, tk3_opening: tankState.TK3.open, tk4_opening: tankState.TK4.open,
        tk1_closing: 0, tk2_closing: 0, tk3_closing: 0, tk4_closing: 0,
        tk1_diff: 0, tk2_diff: 0, tk3_diff: 0, tk4_diff: 0,
        tk1_margin: 0, tk2_margin: 0, tk3_margin: 0, tk4_margin: 0,
        lpg_tank_opening: tankState.TK5.open, lpg_tank_closing: 0, lpg_tank_diff: 0, lpg_tank_margin: 0,
        ...preservedFields(rawReportRef.current),
      }

      return post({ action: "saveDailyReport", station: STATION_KEY, username, date, data }).then(d => {
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
      // once both Dip and Sales data exist for the date.
      const tankDiffs = {}
      let anyDiff = false

      TANKS.forEach(tk => {
        const s = tankState[tk.id]
        const diff = s.open > 0 && s.close > 0 && s.open > s.close ? s.open - s.close : 0
        tankDiffs[tk.id] = diff
        if (diff > 0) anyDiff = true
      })

      if (!anyDiff) {
        return Promise.resolve({ ok: false, error: "Enter closing stock readings first" })
      }

      // Existing margin values are preserved as-is (not recalculated
      // here) since margin depends on pump data Dip no longer touches.
      // The Records page is responsible for writing fresh margin
      // figures once pump readings are also in for this date.
      const prevReport = rawReportRef.current || {}
      const data = {
        tk1_opening: tankState.TK1.open, tk1_closing: tankState.TK1.close, tk1_diff: tankDiffs.TK1, tk1_margin: prevReport.tk1_margin || 0,
        tk2_opening: tankState.TK2.open, tk2_closing: tankState.TK2.close, tk2_diff: tankDiffs.TK2, tk2_margin: prevReport.tk2_margin || 0,
        tk3_opening: tankState.TK3.open, tk3_closing: tankState.TK3.close, tk3_diff: tankDiffs.TK3, tk3_margin: prevReport.tk3_margin || 0,
        tk4_opening: tankState.TK4.open, tk4_closing: tankState.TK4.close, tk4_diff: tankDiffs.TK4, tk4_margin: prevReport.tk4_margin || 0,
        lpg_tank_opening: tankState.TK5.open, lpg_tank_closing: tankState.TK5.close, lpg_tank_diff: tankDiffs.TK5, lpg_tank_margin: prevReport.lpg_tank_margin || 0,
        ...preservedFields(rawReportRef.current),
      }

      return post({ action: "saveDailyReport", station: STATION_KEY, username, date, data }).then(d => {
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
          { action: "savePhoto", station: STATION_KEY, username, date, session, subject, mimeType: sendMime, base64 },
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
        action: "saveEditRequest", station: STATION_KEY, username, name,
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
