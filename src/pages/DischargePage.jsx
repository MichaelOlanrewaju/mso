import React, { useCallback, useEffect, useMemo, useState } from "react"
import { getStation, tanksFor } from "../config/stations"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import ConfirmSubmitModal from "../components/ui/ConfirmSubmitModal"
import { naira, litres } from "../utils/format"
import { getToken } from "../utils/session"
import { useSettings } from "../hooks/useSettings"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"
/* Used to be a single hardcoded list ("Tank 3 (AGO)") that didn't match
   either station's real configuration — MSO's TK3 actually holds PMS, and
   M&M has no TK3 at all. Built from each station's real tank config instead,
   so the option shown always matches reality. The stored VALUE is a clean
   tank id ("TK1") rather than a decorative label — needed so a discharge can
   be reliably matched back to a specific tank later (for the dip diff fix). */
function dischargeOptionsFor(stationKey) {
  return tanksFor(stationKey)
    .filter(t => t.product !== "LPG")   // LPG is refilled by cylinder swap, not tanker discharge
    .map(t => ({ value: t.id, label: `${t.id} — ${t.product}` }))
}

// Real Discharge sheet column names — these match the live spreadsheet
// headers exactly, including the ones with parentheses/currency symbols.
const COL = {
  DATE: "Date", STATION: "Station", PRODUCT: "Product", DRIVER: "Driver Name",
  ORDERED: "Ordered Litres / KG", ACTUAL: "Actual Received", SHORTAGE: "Shortage",
  PRICE: "Price Per Litre (₦)", TOTAL: "Total Cost (₦)", WAYBILL: "Waybill No.",
  TRUCK: "Truck No.", SUPPLIER: "Supplier", APPROVED_BY: "Approved By", NOTES: "Notes",
  SUBMITTED_BY: "SubmittedBy", STATUS: "Status", SHORTAGE_AMOUNT: "ShortageAmount",
}

function get(action, extra = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false, error: "Not connected." })
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", action)
  url.searchParams.set("station", activeStation())
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
}

function useDischarge(username) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await get("getDischarge", { username: username || "", token: getToken() })
    if (res.ok) setRecords(res.discharge || [])
    setLoading(false)
  }, [username])

  useEffect(() => { load() }, [load])
  return { records, loading, refresh: load }
}

function productIcon(product) {
  const p = String(product || "").toUpperCase()
  if (p.includes("AGO")) return "bi-fuel-pump-diesel"
  return "bi-fuel-pump"
}

// Robust status check — a record only counts as priced if Status is
// explicitly "PRICED". Anything else (blank, "PENDING", unexpected
// casing from older rows saved before the schema was fully migrated)
// is treated as still needing a price, so nothing silently disappears
// from GM's queue.
function isPriced(r) {
  if (String(r[COL.STATUS] || "").trim().toUpperCase() === "PRICED") return true
  // Fallback for sheets where the Status column hasn't been migrated in yet —
  // a filled-in price is itself proof the record was priced.
  return Number(r[COL.PRICE]) > 0
}

// Sheet dates can come back either as "YYYY-MM-DD" strings or as ISO
// datetime strings (if Google Sheets auto-formatted the cell as a Date).
// This normalizes either into a real Date object for comparisons.
function parseSheetDate(v) {
  if (!v) return null
  const s = String(v)
  const d = new Date(s.length <= 10 ? s + "T00:00:00" : s)
  return isNaN(d.getTime()) ? null : d
}

function formatDateLabel(v) {
  const d = parseSheetDate(v)
  if (!d) return String(v || "—")
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
}

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day // back to Monday
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfMonth(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), 1)
  date.setHours(0, 0, 0, 0)
  return date
}

/* Discharge variance is a single signed number: positive = shortage (received
   less than ordered), negative = overage (received more). Rendering it as one
   value keeps the two impossible to contradict, and lets period totals net out
   correctly — a 600L overage genuinely offsets a 600L shortage elsewhere. */
function varianceLabel(v) {
  const n = Number(v) || 0
  if (!n) return { text: "None", cls: "text-green" }
  return n > 0
    ? { text: `${litres(n)} short`, cls: "text-red font-extrabold" }
    : { text: `${litres(Math.abs(n))} over`, cls: "text-amber font-extrabold" }
}

function varianceMoney(v) {
  const n = Number(v) || 0
  if (!n) return { text: "—", cls: "text-ink-4" }
  return n > 0
    ? { text: naira(n), cls: "text-red font-extrabold" }
    : { text: `+${naira(Math.abs(n))}`, cls: "text-green font-extrabold" }
}

export default function DischargePage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle(`Discharge — ${getStation(activeStation()).name}`)

  const { records, loading, refresh } = useDischarge(auth.username)
  const [tab, setTab] = useState("records")
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Supervisor form
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    product: "", supplier: "", driverName: "",
    orderedLitres: "", actualReceived: "", shortage: "",
    truckNumber: "", waybillNo: "", notes: "",
  })

  // GM price form
  const [pricingDate, setPricingDate] = useState(null)
  /* Asked immediately after a discharge is submitted, for a tank whose
     opening was already recorded today — the same question the Dip page
     asks when discharge arrives first, now asked from this side too when
     the order is reversed. Confirmed directly this gap existed: opening
     submitted first, discharge added a second time on top of it, silently. */
  const [dischargeResolutionPrompt, setDischargeResolutionPrompt] = useState(null) // { tank, actual, date, answer }
  const { settings } = useSettings()
  const dischargeEditEnabled = settings.dischargeEditEnabled !== "false"
  const [editingRecord, setEditingRecord] = useState(null) // full row being edited
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [confirmDeleteDischarge, setConfirmDeleteDischarge] = useState(null)
  const [requestingDischargeEdit, setRequestingDischargeEdit] = useState(null)
  const [priceInputs, setPriceInputs] = useState({}) // { PMS: "1229", AGO: "1649" }

  const isSupervisor = auth.role === "supervisor" || auth.role === "cashier"
  const isGM         = auth.role === "gm"
  const isGMOrOwner  = auth.isGM || auth.isOwner || auth.role === "ceo" || auth.role === "owner"

  const resetForm = () => setForm({
    date: new Date().toISOString().split("T")[0],
    product: "", supplier: "", driverName: "",
    orderedLitres: "", actualReceived: "", shortage: "",
    truckNumber: "", waybillNo: "", notes: "",
  })

  const [period, setPeriod] = useState("week") // "week" | "month" | "all"
  /* PMS and AGO are never blended into one figure — same principle as the
     fuel-stock hero never combining PMS-on-hand with AGO-on-hand. GM/CEO
     pick which one they're looking at; everything downstream (History,
     period totals, Pricing) respects that choice rather than mixing both
     products into a single misleading number. */
  const [productFilter, setProductFilter] = useState("PMS") // "PMS" | "AGO"
  const stationTanksTop = tanksFor(activeStation())
  const productForTankId = (tankId) => stationTanksTop.find(t => t.id === tankId)?.product || tankId

  const pending = useMemo(
    () => records.filter(r => !isPriced(r) && productForTankId(r[COL.PRODUCT]) === productFilter),
    [records, productFilter]
  )

  const now = useMemo(() => new Date(), [])
  const weekStart = useMemo(() => startOfWeek(now), [now])
  const monthStart = useMemo(() => startOfMonth(now), [now])

  const sumRecords = (list) => list.reduce((acc, r) => {
    acc.ordered += Number(r[COL.ORDERED]) || 0
    acc.litres += Number(r[COL.ACTUAL]) || 0
    acc.cost   += Number(r[COL.TOTAL]) || 0
    acc.shortageAmount += Number(r[COL.SHORTAGE_AMOUNT]) || 0
    acc.shortageLitres += Number(r[COL.SHORTAGE]) || 0
    acc.count += 1
    return acc
  }, { ordered: 0, litres: 0, cost: 0, shortageAmount: 0, shortageLitres: 0, count: 0 })

  /* Per-tank breakdown — the summary strip used to only ever show one
     combined total across every tank, with no way to see which tank
     actually received what. Groups by the product label as stored
     (old-style "Tank 2 (PMS)" or the newer clean form), summed separately. */
  const sumByTank = (list) => {
    const byTank = {}
    list.forEach(r => {
      const label = String(r[COL.PRODUCT] || "Unknown")
      if (!byTank[label]) byTank[label] = { label, litres: 0, cost: 0, count: 0 }
      byTank[label].litres += Number(r[COL.ACTUAL]) || 0
      byTank[label].cost   += Number(r[COL.TOTAL]) || 0
      byTank[label].count  += 1
    })
    return Object.values(byTank).sort((a, b) => b.litres - a.litres)
  }

  const productFilteredRecords = useMemo(
    () => records.filter(r => productForTankId(r[COL.PRODUCT]) === productFilter),
    [records, productFilter]
  )

  const weekRecords = useMemo(() => productFilteredRecords.filter(r => {
    const d = parseSheetDate(r[COL.DATE])
    return d && d >= weekStart
  }), [records, weekStart])

  const monthRecords = useMemo(() => records.filter(r => {
    const d = parseSheetDate(r[COL.DATE])
    return d && d >= monthStart
  }), [records, monthStart])

  const periodTotals = useMemo(() => {
    if (period === "week") return sumRecords(weekRecords)
    if (period === "month") return sumRecords(monthRecords)
    return sumRecords(productFilteredRecords)
  }, [period, productFilteredRecords, weekRecords, monthRecords])

  const periodByTank = useMemo(() => {
    if (period === "week") return sumByTank(weekRecords)
    if (period === "month") return sumByTank(monthRecords)
    return sumByTank(productFilteredRecords)
  }, [period, productFilteredRecords, weekRecords, monthRecords])

  const periodLabel = period === "week"
    ? `Since ${weekStart.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`
    : period === "month"
    ? monthStart.toLocaleDateString("en-NG", { month: "long", year: "numeric" })
    : "All recorded history"

  // Group records by date so admin can scan discharges day-by-day
  const groupedRecords = useMemo(() => {
    const groups = []
    const byDate = {}
    productFilteredRecords.forEach(r => {
      const key = String(r[COL.DATE] || "").slice(0, 10)
      if (!byDate[key]) {
        byDate[key] = { date: r[COL.DATE], items: [] }
        groups.push(byDate[key])
      }
      byDate[key].items.push(r)
    })
    return groups
  }, [records])

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  const doSubmitDischarge = async () => {
    setConfirmOpen(false)
    setSaving(true)
    setFeedback(null)
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "saveDischarge")
    url.searchParams.set("station", activeStation())
    Object.entries({ ...form, username: auth.username, token: getToken() }).forEach(([k, v]) => url.searchParams.set(k, v))
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
    setSaving(false)
    if (res.ok) {
      setFeedback({ ok: true, text: "Discharge recorded." })

      /* Check right away whether this tank's opening was already recorded
         today — if so, this discharge is sitting pending, and the person
         who just submitted it is exactly who should answer whether that
         opening already includes it, not left for whoever happens to open
         Dip entry next. */
      const tankMatch = String(form.product || "").toUpperCase().match(/TANK\s*(\d+)|TK\s*(\d+)/)
      const tankId = tankMatch ? `TK${tankMatch[1] || tankMatch[2]}` : null
      if (tankId) {
        const checkUrl = new URL(SCRIPT_URL)
        checkUrl.searchParams.set("action", "getPendingDischargeForOpening")
        checkUrl.searchParams.set("station", activeStation())
        checkUrl.searchParams.set("date", form.date)
        const pendingRes = await fetch(checkUrl.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
        const thisTankPending = pendingRes.ok && (pendingRes.pending || []).find(p => p.tank === tankId)
        if (thisTankPending) {
          setDischargeResolutionPrompt({ tank: tankId, actual: thisTankPending.actual, date: form.date, answer: null })
          resetForm()
          return // hold off on navigating away until this is resolved
        }
      }

      resetForm()
      refresh()
      setTab("records")
    } else {
      setFeedback({ ok: false, text: res.error || "Save failed." })
    }
  }

  const finishDischargeResolution = async () => {
    if (!dischargeResolutionPrompt || dischargeResolutionPrompt.answer === null) return
    setSaving(true)
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "resolveDischargeAfterEntry")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", dischargeResolutionPrompt.date)
    url.searchParams.set("tank", dischargeResolutionPrompt.tank)
    url.searchParams.set("alreadyIncludesDelivery", dischargeResolutionPrompt.answer === "yes")
    url.searchParams.set("username", auth.username)
    url.searchParams.set("token", getToken())
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
    setSaving(false)
    setDischargeResolutionPrompt(null)
    if (res.ok) {
      setFeedback({ ok: true, text: "Discharge recorded and opening confirmed." })
    } else {
      setFeedback({ ok: false, text: res.error || "Could not resolve — check the Discharge record manually." })
    }
    refresh()
    setTab("records")
  }

  const handleRequestDischargeEdit = async (r) => {
    setRequestingDischargeEdit(r.rowIndex)
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "saveEditRequest", station: activeStation(), token: getToken(), username: auth.username,
        date: r[COL.DATE], type: "discharge", message: `Correct a discharge record on ${r[COL.DATE]}`,
      }),
    }).then(r2 => r2.json()).catch(() => ({ ok: false, error: "Network error — check connection" }))
    setRequestingDischargeEdit(null)
    if (res.ok) {
      setFeedback({ ok: true, text: "Request sent — GM/CEO will be notified for approval." })
    } else {
      setFeedback({ ok: false, text: res.error || "Could not send request." })
    }
  }

  const openEditRecord = (r) => {
    setEditingRecord(r)
    setEditForm({
      driverName: r[COL.DRIVER] || "",
      orderedLitres: r[COL.ORDERED] || "",
      actualReceived: r[COL.ACTUAL] || "",
      waybillNo: r[COL.WAYBILL] || "",
      truckNo: r[COL.TRUCK] || "",
      supplier: r[COL.SUPPLIER] || "",
      notes: r[COL.NOTES] || "",
    })
  }

  const saveEditRecord = async () => {
    if (!editingRecord) return
    setSavingEdit(true)
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "updateDischarge")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("rowIndex", editingRecord.rowIndex)
    url.searchParams.set("username", auth.username)
    url.searchParams.set("role", auth.role)
    url.searchParams.set("token", getToken())
    Object.entries(editForm).forEach(([k, v]) => url.searchParams.set(k, v))
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
    setSavingEdit(false)
    if (res.ok) {
      setFeedback({ ok: true, text: "Discharge record updated." })
      setEditingRecord(null)
      refresh()
    } else {
      setFeedback({ ok: false, text: res.error || "Could not save changes." })
    }
  }

  const handleDeleteDischarge = async () => {
    if (!confirmDeleteDischarge) return
    setSavingEdit(true)
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "deleteDischarge")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("rowIndex", confirmDeleteDischarge.rowIndex)
    url.searchParams.set("username", auth.username)
    url.searchParams.set("token", getToken())
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
    setSavingEdit(false)
    setConfirmDeleteDischarge(null)
    if (res.ok) {
      setFeedback({ ok: true, text: "Discharge record deleted." })
      refresh()
    } else {
      setFeedback({ ok: false, text: res.error || "Could not delete record." })
    }
  }

  const handleSubmitDischarge = () => {
    if (!isSupervisor) {
      setFeedback({ ok: false, text: "Only supervisors can record a discharge." })
      return
    }
    if (!form.product || !form.supplier || !form.actualReceived) {
      setFeedback({ ok: false, text: "Product, supplier and actual litres received are required." })
      return
    }
    setConfirmOpen(true)
  }

  // What the review popup shows before the actual save.
  const dischargeReviewRows = [
    /* Makes the auto-bump effect impossible to miss at the exact moment of
       submission — this used to happen silently, which meant a mistaken or
       test entry could corrupt a real day's opening reading with nobody
       noticing until much later. Now it's the first thing shown. */
    { label: "⚠ This will do", value: `Add ${litres(form.actualReceived || 0)} to ${form.product}'s opening reading for ${form.date}`, warn: true },
    { label: "Product / Tank", value: form.product },
    { label: "Supplier", value: form.supplier },
    { label: "Driver", value: form.driverName || "Not entered", warn: !form.driverName },
    { label: "Actual Received", value: `${litres(form.actualReceived || 0)}` },
    ...(form.orderedLitres ? [{ label: "Ordered", value: `${litres(form.orderedLitres)}` }] : []),
    { label: "Variance",
      value: (() => {
        const v = form.shortage !== "" ? Number(form.shortage)
                : (form.orderedLitres && form.actualReceived ? Number(form.orderedLitres) - Number(form.actualReceived) : 0)
        if (!v) return "None"
        return v > 0 ? `${litres(v)} short` : `${litres(Math.abs(v))} over`
      })(),
      warn: Number(form.shortage) !== 0 },
    ...(form.truckNumber ? [{ label: "Truck No.", value: form.truckNumber }] : []),
    ...(form.waybillNo ? [{ label: "Waybill No.", value: form.waybillNo }] : []),
  ]
  const dischargeWarnings = []
  if (!form.driverName) dischargeWarnings.push("No driver name entered.")
  {
    const v = form.shortage !== "" ? Number(form.shortage)
            : (form.orderedLitres && form.actualReceived ? Number(form.orderedLitres) - Number(form.actualReceived) : 0)
    if (v > 0) {
      dischargeWarnings.push(`Shortage of ${litres(v)} recorded — this will be flagged for GM/CEO review.`)
    } else if (v < 0) {
      dischargeWarnings.push(`Overage of ${litres(Math.abs(v))} — you received more than ordered. Confirm the waybill before submitting.`)
    }
  }

  /* GM prices a whole day at once, not each tank separately — confirmed
     directly: she wants the day's total, the per-tank breakdown, and one
     price applied across all of it in a single action. */
  const handlePriceDay = async (date, productsNeeded) => {
    if (!isGM) {
      setFeedback({ ok: false, text: "Only GM can add pricing." })
      return
    }
    if (pricingDate !== date) return
    const missing = productsNeeded.filter(p => !priceInputs[p])
    if (missing.length) return
    setSaving(true)
    setFeedback(null)
    const pricesByProduct = {}
    productsNeeded.forEach(p => { pricesByProduct[p] = Number(priceInputs[p]) })
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "priceDischargeDay")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)
    url.searchParams.set("pricesByProduct", JSON.stringify(pricesByProduct))
    url.searchParams.set("username", auth.username)
    url.searchParams.set("token", getToken())
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
    setSaving(false)
    if (res.ok) {
      const byProductText = Object.entries(res.totalsByProduct || {})
        .map(([fuel, t]) => `${fuel}: ${naira(t.cost)}`)
        .join(" · ")
      setFeedback({
        ok: true,
        text: `Priced ${res.tanksPriced} tank${res.tanksPriced !== 1 ? "s" : ""} for ${formatDateLabel(date)}. ${byProductText}` +
              (res.totalShortageAmount ? ` (shortage cost ${naira(res.totalShortageAmount)})` : ""),
      })
      setPricingDate(null)
      setPriceInputs({})
      refresh()
    } else {
      setFeedback({ ok: false, text: res.error || "Failed to add price." })
    }
  }

  const inputCls = "w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition focus:border-cyan focus:bg-white focus:ring-2 focus:ring-cyan/15"
  const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-ink-4"

  return (
    <div className="min-h-screen bg-pagebg pb-16">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[200] border-b border-border bg-white shadow-sm" style={{ paddingTop: "max(var(--sat),52px)" }}>
        <div className="flex items-center gap-3 px-4 pb-2.5">
          <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2 transition hover:bg-border/40">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">Discharge</div>
            <div className="text-[10px] text-ink-4">Fuel discharge recording — {getStation(activeStation()).name}</div>
          </div>
          {isGMOrOwner && (
            <div className="flex items-center gap-1.5 rounded-full bg-navy/5 px-3 py-1.5 text-[10.5px] font-bold text-navy">
              <i className="bi bi-droplet-half" /> {litres(sumRecords(records).litres)} all-time
            </div>
          )}
        </div>
        <div className="flex border-t border-border">
          {[
            ["records", "Records", records.length],
            ...(isSupervisor ? [["record", "Record Discharge", null]] : []),
            ...(isGM ? [["pricing", pending.length > 0 ? `Price Discharge (${pending.length})` : "Price Discharge", null]] : []),
          ].map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setTab(k); setFeedback(null) }}
              className={`flex-1 py-2.5 text-[12px] font-bold transition ${tab === k ? "border-b-2 border-navy text-navy" : "text-ink-4 hover:text-ink-2"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        {/* Feedback */}
        {feedback && (
          <div className={`mb-4 flex items-start gap-2 rounded-[11px] border px-4 py-3 text-[13px] font-semibold ${feedback.ok ? "border-green/20 bg-green-light text-green" : "border-red/20 bg-red-light text-red"}`}>
            <i className={`bi mt-0.5 ${feedback.ok ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />
            <div className="flex-1">{feedback.text}</div>
            <button type="button" onClick={() => setFeedback(null)}><i className="bi bi-x-lg text-[11px] opacity-40" /></button>
          </div>
        )}

        {/* PMS/AGO toggle — never blended, same as the fuel-stock hero never
            combines PMS-on-hand with AGO-on-hand. Governs History, period
            totals, and Pricing below, whichever tab is active. */}
        {(tab === "records" || tab === "pricing") && (
          <div className="mb-4 flex gap-2">
            {["PMS", "AGO"].map(p => (
              <button
                key={p} type="button" onClick={() => setProductFilter(p)}
                className={`flex-1 rounded-[12px] py-2.5 text-[13px] font-bold transition ${
                  productFilter === p ? "bg-navy text-white shadow-lift" : "border border-border bg-white text-ink-3"
                }`}
              >
                <i className={`bi ${p === "PMS" ? "bi-fuel-pump-fill" : "bi-droplet-fill"} mr-1.5`} />{p}
              </button>
            ))}
          </div>
        )}

        {/* ── RECORDS TAB ── */}
        {tab === "records" && (
          <>
            {/* Owner/GM summary strip — running totals by period, front and center */}
            {isGMOrOwner && !loading && productFilteredRecords.length > 0 && (
              <div className="mb-4 overflow-hidden rounded-[16px] shadow-lift" style={{ background: "var(--brand-gradient-btn)" }}>
                <div className="flex gap-1 px-3 pt-3">
                  {[["week", "This Week"], ["month", "This Month"], ["all", "All Time"]].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setPeriod(k)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${period === k ? "bg-white text-navy" : "text-white/60 hover:text-white/90"}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="px-4 pb-1 pt-2 text-[10.5px] font-semibold text-white/50">{periodLabel} · {periodTotals.count} record{periodTotals.count !== 1 ? "s" : ""}</div>
                <div className="grid grid-cols-2 divide-x divide-y divide-white/10 border-t border-white/10 px-1 py-4">
                  <div className="px-3 pb-3 text-center">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-white/50">Total Expected</div>
                    <div className="mono mt-1 text-[15px] font-extrabold text-white">{periodTotals.ordered > 0 ? litres(periodTotals.ordered) : "—"}</div>
                  </div>
                  <div className="px-3 pb-3 text-center">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-white/50">Total Received</div>
                    <div className="mono mt-1 text-[15px] font-extrabold text-white">{litres(periodTotals.litres)}</div>
                  </div>
                  <div className="px-3 pt-3 text-center">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-white/50">Total Amount</div>
                    <div className="mono mt-1 text-[15px] font-extrabold text-white">{naira(periodTotals.cost)}</div>
                  </div>
                  <div className="px-3 pt-3 text-center">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-white/50">Variance Cost</div>
                    <div className={`mono mt-1 text-[15px] font-extrabold ${periodTotals.shortageAmount > 0 ? "text-amber" : periodTotals.shortageAmount < 0 ? "text-green" : "text-white"}`}>{periodTotals.shortageAmount < 0 ? `+${naira(Math.abs(periodTotals.shortageAmount))}` : naira(periodTotals.shortageAmount)}</div>
                  </div>
                </div>

                {/* Per-tank breakdown — the combined total above used to be
                    the only thing shown; no way to see which tank actually
                    received what within the period. */}
                {periodByTank.length > 0 && (
                  <div className="border-t border-white/10 px-4 py-3">
                    <div className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.5px] text-white/50">By Tank</div>
                    <div className="space-y-1.5">
                      {periodByTank.map(t => (
                        <div key={t.label} className="flex items-center justify-between text-[12px]">
                          <span className="font-semibold text-white/90">{t.label}</span>
                          <span className="mono font-bold text-white">
                            {litres(t.litres)}{t.cost > 0 ? ` · ${naira(t.cost)}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {pending.length > 0 && (
                  <div className="flex items-center gap-2 border-t border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold text-white/80">
                    <i className="bi bi-hourglass-split" /> {pending.length} record{pending.length !== 1 ? "s" : ""} awaiting price from GM
                  </div>
                )}
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center gap-2 py-16">
                <span className="h-6 w-6 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
                <div className="text-[12px] text-ink-4">Loading records…</div>
              </div>
            )}
            {!loading && productFilteredRecords.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-[16px] bg-white py-16 text-center shadow-sm">
                <i className="bi bi-fuel-pump text-4xl text-ink-4" />
                <div className="text-[14px] font-bold text-ink">No discharge records yet</div>
                <div className="text-[12.5px] text-ink-4">Records will appear here once a supervisor logs a discharge.</div>
              </div>
            )}
            {!loading && productFilteredRecords.length > 0 && (
              <div className="space-y-3">
                {groupedRecords.map((group, gi) => {
                  const daySum = sumRecords(group.items)
                  const allPriced = group.items.every(isPriced)
                  return (
                    <div key={gi} className="overflow-hidden rounded-[14px] bg-white shadow-sm">
                      {/* One card per day — the day's total is the headline,
                          not each tank buried in its own separate card. */}
                      <div className="flex items-center gap-3 border-b border-surface px-4 py-3.5">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-navy/8 text-[16px] text-navy">
                          <i className="bi bi-calendar3" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-3">
                            {formatDateLabel(group.date)} · {group.items.length} tank{group.items.length !== 1 ? "s" : ""}
                            {isGMOrOwner && (
                              <span className={`ml-auto flex items-center gap-1 rounded-full px-2 py-[2px] text-[9.5px] font-bold ${allPriced ? "bg-green-light text-green" : "bg-amber-light text-amber"}`}>
                                <i className={`bi ${allPriced ? "bi-check-circle-fill" : "bi-hourglass-split"} text-[8px]`} />
                                {allPriced ? "Priced" : "Needs Price"}
                              </span>
                            )}
                          </div>
                          {/* One line, not a redundant received-total sitting
                              right underneath an Expected figure that already
                              implies it — confirmed directly this was
                              cluttered. Also fixes a real bug here: the old
                              check only fired for positive (shortage) values,
                              so a day with an overage silently showed no
                              badge at all — same sign issue already fixed on
                              the entry form, still present here until now. */}
                          {daySum.ordered > 0 ? (
                            <>
                              <div className="text-[11px] font-semibold text-ink-4">Expected</div>
                              <div className="mono text-[22px] font-black leading-tight text-ink">
                                {litres(daySum.ordered)}
                                {daySum.shortageLitres !== 0 && (
                                  <span className={`ml-2 text-[15px] font-bold ${daySum.shortageLitres > 0 ? "text-red" : "text-green"}`}>
                                    {daySum.shortageLitres > 0 ? "−" : "+"}{litres(Math.abs(daySum.shortageLitres))}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="mono text-[22px] font-black leading-tight text-ink">{litres(daySum.litres)}</div>
                          )}
                          {isGMOrOwner && daySum.cost > 0 && (
                            <div className="mono text-[13px] font-bold text-ink-3">{naira(daySum.cost)} total</div>
                          )}
                        </div>
                      </div>

                      {/* Per-tank breakdown, consolidated — every tank that
                          received fuel this day, in one list, not separate
                          cards. Supervisor sees litres/variance only; GM/Owner
                          also sees price and amount. */}
                      <div className="divide-y divide-surface">
                        {group.items.map((r, i) => (
                          <div key={i} className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <i className={`bi ${productIcon(r[COL.PRODUCT])} flex-shrink-0 text-[13px] text-ink-4`} />
                              <div className="min-w-0 flex-1">
                                <div className="text-[12.5px] font-bold text-ink">{r[COL.PRODUCT]}</div>
                                {(r[COL.SUPPLIER] || r[COL.DRIVER]) && (
                                  <div className="truncate text-[10px] text-ink-4">
                                    {r[COL.SUPPLIER]}{r[COL.SUPPLIER] && r[COL.DRIVER] && " · "}{r[COL.DRIVER] && `Driver: ${r[COL.DRIVER]}`}
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <div className="mono text-[12.5px] font-bold text-navy">{litres(r[COL.ACTUAL])}</div>
                                {Number(r[COL.SHORTAGE]) !== 0 && (
                                  <div className={`mono text-[10px] font-bold ${Number(r[COL.SHORTAGE]) > 0 ? "text-red" : "text-green"}`}>
                                    {Number(r[COL.SHORTAGE]) > 0 ? "−" : "+"}{litres(Math.abs(Number(r[COL.SHORTAGE])))}
                                  </div>
                                )}
                              </div>
                              {isGMOrOwner && (
                                <div className="flex-shrink-0 text-right">
                                  <div className="mono text-[12.5px] font-bold text-ink">{r[COL.TOTAL] ? naira(r[COL.TOTAL]) : "—"}</div>
                                  {r[COL.PRICE] && <div className="mono text-[9.5px] text-ink-4">@{naira(r[COL.PRICE])}</div>}
                                </div>
                              )}
                              {/* Edit is supervisor-only here — GM/CEO have
                                  Delete instead, not both. Unpriced only:
                                  once GM has priced it, the total is locked
                                  to that litres figure, so editing would
                                  silently make it wrong. */}
                              {!isPriced(r) && !isGMOrOwner && dischargeEditEnabled && (
                                <button
                                  type="button"
                                  onClick={() => openEditRecord(r)}
                                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] border border-border text-ink-3"
                                >
                                  <i className="bi bi-pencil text-[10px]" />
                                </button>
                              )}
                              {/* Toggle off, supervisor — same request/approve
                                  path as everywhere else, not just a dead
                                  end. Request once; the actual Edit attempt
                                  either succeeds once GM/CEO has approved it,
                                  or the backend explains it's still locked. */}
                              {!isPriced(r) && !isGMOrOwner && !dischargeEditEnabled && (
                                <button
                                  type="button"
                                  onClick={() => handleRequestDischargeEdit(r)}
                                  disabled={requestingDischargeEdit === r.rowIndex}
                                  className="flex h-6 items-center gap-1 rounded-[6px] border border-amber/30 bg-amber-light px-2 text-[9.5px] font-bold text-amber"
                                >
                                  <i className="bi bi-hourglass-split text-[9px]" /> {requestingDischargeEdit === r.rowIndex ? "…" : "Request Edit"}
                                </button>
                              )}
                              {!isPriced(r) && !isGMOrOwner && !dischargeEditEnabled && (
                                <button
                                  type="button"
                                  onClick={() => openEditRecord(r)}
                                  title="Try editing — works once GM/CEO has approved your request"
                                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] border border-border text-ink-3"
                                >
                                  <i className="bi bi-pencil text-[10px]" />
                                </button>
                              )}
                              {/* Delete is CEO/GM/Owner-only here — a genuine
                                  mistake (wrong tank, test entry, duplicate),
                                  not something a supervisor removes
                                  themselves. No edit icon shown to this
                                  group here; they have Delete instead. */}
                              {isGMOrOwner && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteDischarge(r)}
                                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] border border-red/25 bg-red-light text-red"
                                >
                                  <i className="bi bi-trash3 text-[10px]" />
                                </button>
                              )}
                            </div>
                            {(r[COL.TRUCK] || r[COL.WAYBILL] || r[COL.NOTES]) && (
                              <div className="mt-1 pl-[21px] text-[10px] text-ink-4">
                                {r[COL.TRUCK] && <span className="mr-2"><i className="bi bi-truck mr-0.5 opacity-60" />{r[COL.TRUCK]}</span>}
                                {r[COL.WAYBILL] && <span className="mr-2"><i className="bi bi-receipt mr-0.5 opacity-60" />{r[COL.WAYBILL]}</span>}
                                {r[COL.NOTES] && <span><i className="bi bi-sticky mr-0.5 opacity-60" />{r[COL.NOTES]}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-surface px-4 py-2 text-[10px] text-ink-4">
                        Submitted by {group.items[0][COL.SUBMITTED_BY]}
                      </div>

                      {isGM && !allPriced && (
                        <button type="button" onClick={() => { setPricingDate(group.date); setTab("pricing") }}
                          className="flex w-full items-center justify-center gap-2 border-t border-surface py-2.5 text-[12px] font-bold text-cyan-dark transition hover:bg-cyan/5">
                          <i className="bi bi-tag" /> Add Price for This Day
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── RECORD DISCHARGE TAB (Supervisor only) ── */}
        {tab === "record" && isSupervisor && (
          <div className="overflow-hidden rounded-[16px] bg-white shadow-sm">
            <div className="border-b border-surface px-5 py-4">
              <div className="text-[14.5px] font-extrabold text-ink">New Discharge Record</div>
              <div className="mt-0.5 text-[11.5px] text-ink-4">Log a fuel discharge as it's received at the station</div>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.5px] text-cyan-dark">Discharge Details</div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={labelCls}>Product / Tank</span>
                      <select value={form.product} onChange={e => setForm(f => ({...f, product: e.target.value}))} className={inputCls}>
                        <option value="">Select…</option>
                        {dischargeOptionsFor(activeStation()).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className={labelCls}>Date</span>
                      <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} className={inputCls} />
                    </label>
                  </div>
                  <label className="block">
                    <span className={labelCls}>Supplier</span>
                    <input type="text" placeholder="e.g. NNPC, Ardova, MRS…" value={form.supplier} onChange={e => setForm(f => ({...f, supplier: e.target.value}))} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Driver Name</span>
                    <input type="text" placeholder="Driver's name" value={form.driverName} onChange={e => setForm(f => ({...f, driverName: e.target.value}))} className={inputCls} />
                  </label>
                </div>
              </div>

              <div className="border-t border-surface pt-4">
                <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.5px] text-cyan-dark">Quantity</div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={labelCls}>Ordered <span className="normal-case text-ink-4">(optional)</span></span>
                      <input type="number" inputMode="decimal" placeholder="0" value={form.orderedLitres} onChange={e => setForm(f => ({...f, orderedLitres: e.target.value}))} className={inputCls} />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Actual Received</span>
                      <input type="number" inputMode="decimal" placeholder="0" value={form.actualReceived} onChange={e => setForm(f => ({...f, actualReceived: e.target.value}))} className={inputCls + " font-bold"} />
                    </label>
                  </div>
                  <div className="rounded-[10px] border border-border bg-surface px-3.5 py-3">
                    {/* Auto-calculated only, never manually typed —
                        confirmed directly: a supervisor typing a positive
                        number meaning "this much extra" was silently
                        recorded as a shortage instead, since positive is
                        this system's shortage convention and there's no
                        intuitive reason a person would guess that without
                        being told. Removing the manual field removes the
                        chance of typing the sign wrong — Ordered and
                        Actual are already both entered, so this can always
                        be computed correctly instead of guessed at. */}
                    <span className={labelCls}>Variance (auto-calculated from Ordered − Actual)</span>
                    {form.orderedLitres && form.actualReceived ? (() => {
                      const v = Number(form.orderedLitres) - Number(form.actualReceived)
                      if (v === 0) return <div className="mono text-[15px] font-bold text-ink">Exact match</div>
                      return v > 0
                        ? <div className="mono text-[15px] font-bold text-red">{litres(v)} short</div>
                        : <div className="mono text-[15px] font-bold text-green">{litres(Math.abs(v))} over</div>
                    })() : (
                      <div className="text-[12.5px] text-ink-4">Enter Ordered and Actual Received above to see this</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-surface pt-4">
                <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.5px] text-cyan-dark">Documentation</div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={labelCls}>Truck No. <span className="normal-case text-ink-4">(optional)</span></span>
                      <input type="text" placeholder="e.g. LAG-123-XY" value={form.truckNumber} onChange={e => setForm(f => ({...f, truckNumber: e.target.value}))} className={inputCls} />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Waybill No. <span className="normal-case text-ink-4">(optional)</span></span>
                      <input type="text" placeholder="e.g. WB-0231" value={form.waybillNo} onChange={e => setForm(f => ({...f, waybillNo: e.target.value}))} className={inputCls} />
                    </label>
                  </div>
                  <label className="block">
                    <span className={labelCls}>Notes</span>
                    <textarea rows={2} placeholder="Any additional notes…" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className={inputCls + " resize-none"} />
                  </label>
                </div>
              </div>

              <button type="button" onClick={handleSubmitDischarge} disabled={saving || !form.product || !form.supplier || !form.actualReceived}
                className="flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 text-[14px] font-bold text-white shadow-lift transition disabled:opacity-40"
                style={{ background: "var(--brand-gradient-btn)" }}>
                {saving ? <><span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> Saving…</> : <><i className="bi bi-fuel-pump" /> Record Discharge</>}
              </button>
            </div>
          </div>
        )}

        {/* ── ADD PRICE TAB (GM only) ── */}
        {tab === "pricing" && isGM && (
          <>
            {pending.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-[16px] bg-white py-14 text-center shadow-sm">
                <i className="bi bi-check2-all text-4xl text-green" />
                <div className="text-[14px] font-bold text-ink">All records priced</div>
                <div className="text-[12.5px] text-ink-4">No pending discharge records need pricing.</div>
              </div>
            )}
            <div className="space-y-3">
              {/* Grouped by day, then by product within the day — PMS and
                  AGO are never the same price, confirmed directly this was
                  wrong to lump into one figure. A day with only PMS asks
                  for one price; a day with both asks for both, each
                  applied only to that product's own tanks. */}
              {Object.entries(
                pending.reduce((groups, r) => {
                  const d = r[COL.DATE]
                  if (!groups[d]) groups[d] = []
                  groups[d].push(r)
                  return groups
                }, {})
              ).map(([date, items]) => {
                const stationTanks = tanksFor(activeStation())
                const productFor = (tankId) => stationTanks.find(t => t.id === tankId)?.product || tankId
                const itemsByProduct = items.reduce((acc, r) => {
                  const p = productFor(r[COL.PRODUCT])
                  if (!acc[p]) acc[p] = []
                  acc[p].push(r)
                  return acc
                }, {})
                const productsNeeded = Object.keys(itemsByProduct)
                const dayTotalLitres = items.reduce((s, r) => s + (Number(r[COL.ACTUAL]) || 0), 0)
                const isPricingThisDay = pricingDate === date
                const allPricesFilled = isPricingThisDay && productsNeeded.every(p => priceInputs[p])

                return (
                  <div key={date} className="overflow-hidden rounded-[14px] bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-surface px-4 py-3.5">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-light text-[16px] text-amber">
                        <i className="bi bi-calendar3" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[12px] font-semibold text-ink-3">{formatDateLabel(date)} · {items.length} tank{items.length !== 1 ? "s" : ""}</div>
                        <div className="mono text-[22px] font-black leading-tight text-ink">{litres(dayTotalLitres)}</div>
                      </div>
                    </div>

                    {/* One block per product — its own tanks listed, its own
                        price input, its own preview. */}
                    {productsNeeded.map(product => {
                      const productItems = itemsByProduct[product]
                      const productLitres = productItems.reduce((s, r) => s + (Number(r[COL.ACTUAL]) || 0), 0)
                      const productShortage = productItems.reduce((s, r) => s + (Number(r[COL.SHORTAGE]) || 0), 0)
                      const priceVal = isPricingThisDay ? (priceInputs[product] || "") : ""
                      const previewTotal = priceVal ? productLitres * Number(priceVal) : null
                      const previewShortageCost = priceVal && productShortage > 0 ? productShortage * Number(priceVal) : null

                      return (
                        <div key={product} className="border-b border-surface">
                          <div className="divide-y divide-surface">
                            {productItems.map((r, i) => (
                              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                                <i className={`bi ${productIcon(r[COL.PRODUCT])} text-[13px] text-ink-4`} />
                                <div className="flex-1 text-[12.5px] font-semibold text-ink">{r[COL.PRODUCT]} <span className="text-ink-4">({product})</span></div>
                                <div className="mono text-[12.5px] font-bold text-navy">{litres(r[COL.ACTUAL])}</div>
                                {Number(r[COL.SHORTAGE]) !== 0 && (
                                  <span className={`rounded-full px-2 py-[2px] text-[10px] font-bold ${Number(r[COL.SHORTAGE]) > 0 ? "bg-red-light text-red" : "bg-green-light text-green"}`}>
                                    {Number(r[COL.SHORTAGE]) > 0 ? "−" : "+"}{litres(Math.abs(Number(r[COL.SHORTAGE])))}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="px-4 pb-4 pt-3">
                            <label className="mb-2 block">
                              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.5px] text-ink-4">{product} Price Per Litre (₦)</span>
                              <input type="number" inputMode="decimal" placeholder="e.g. 1229"
                                value={priceVal}
                                onFocus={() => setPricingDate(date)}
                                onChange={e => { setPricingDate(date); setPriceInputs(v => ({ ...v, [product]: e.target.value })) }}
                                className="mono w-full rounded-[10px] border-2 border-cyan bg-surface px-3.5 py-2.5 text-[15px] font-bold text-ink outline-none focus:bg-white" />
                            </label>
                            {previewTotal !== null && (
                              <div className="space-y-1 rounded-[9px] bg-surface px-3 py-2 text-[12px] text-ink-4">
                                <div>{litres(productLitres)} × {naira(Number(priceVal))} = <strong className="text-navy">{naira(previewTotal)}</strong></div>
                                {previewShortageCost !== null && (
                                  <div>{litres(productShortage)} shortage × {naira(Number(priceVal))} = <strong className="text-red">{naira(previewShortageCost)}</strong> shortage cost</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    <div className="px-4 pb-4 pt-3">
                      <button type="button" onClick={() => handlePriceDay(date, productsNeeded)} disabled={saving || !allPricesFilled}
                        className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-green py-3 text-[13px] font-bold text-white shadow-lift disabled:opacity-40">
                        {saving ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> : <><i className="bi bi-check2" /> Confirm Price{productsNeeded.length > 1 ? "s" : ""} for This Day</>}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <ConfirmSubmitModal
        open={confirmOpen}
        title="Confirm Discharge Record"
        subtitle={`Review before saving — ${form.date}`}
        rows={dischargeReviewRows}
        warnings={dischargeWarnings}
        confirming={saving}
        onConfirm={doSubmitDischarge}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* This tank's opening was already recorded today — asked right here,
          the moment it's actually decided, instead of leaving it for
          whoever next opens Dip entry. */}
      {dischargeResolutionPrompt && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-[440px] rounded-t-[20px] bg-white p-5 sm:rounded-[20px]">
            <div className="mb-1 text-[15px] font-extrabold text-ink">One more thing before this is done</div>
            <div className="mb-4 text-[12.5px] text-ink-3">
              {dischargeResolutionPrompt.tank}'s opening was already recorded today. Does that reading already include this {litres(dischargeResolutionPrompt.actual)} delivery?
            </div>
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDischargeResolutionPrompt(p => ({ ...p, answer: "yes" }))}
                className={`flex-1 rounded-[9px] border-[1.5px] py-2.5 text-[12.5px] font-bold ${
                  dischargeResolutionPrompt.answer === "yes" ? "border-cyan bg-cyan-light text-cyan-dark" : "border-border bg-surface text-ink-3"
                }`}
              >
                Yes, already included
              </button>
              <button
                type="button"
                onClick={() => setDischargeResolutionPrompt(p => ({ ...p, answer: "no" }))}
                className={`flex-1 rounded-[9px] border-[1.5px] py-2.5 text-[12.5px] font-bold ${
                  dischargeResolutionPrompt.answer === "no" ? "border-cyan bg-cyan-light text-cyan-dark" : "border-border bg-surface text-ink-3"
                }`}
              >
                No, add it
              </button>
            </div>
            <button
              type="button"
              disabled={dischargeResolutionPrompt.answer === null || saving}
              onClick={finishDischargeResolution}
              className="flex h-[48px] w-full items-center justify-center rounded-[12px] bg-green text-[14px] font-extrabold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      )}

      {editingRecord && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setEditingRecord(null)}>
          <div className="max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-t-[20px] bg-white p-5 sm:rounded-[20px]" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[15px] font-extrabold text-ink">Edit Discharge — {editingRecord[COL.PRODUCT]}</div>
              <button type="button" onClick={() => setEditingRecord(null)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink-3">
                <i className="bi bi-x-lg text-[12px]" />
              </button>
            </div>

            {[
              ["Supplier", "supplier", "text"],
              ["Driver Name", "driverName", "text"],
              ["Truck No.", "truckNo", "text"],
              ["Waybill No.", "waybillNo", "text"],
              ["Ordered Litres", "orderedLitres", "number"],
              ["Actual Received", "actualReceived", "number"],
              ["Notes", "notes", "text"],
            ].map(([label, key, type]) => (
              <label key={key} className="mb-3 block">
                <span className="mb-1 block text-[11px] font-semibold text-ink-3">{label}</span>
                <input
                  type={type} inputMode={type === "number" ? "decimal" : undefined}
                  value={editForm[key] ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none focus:border-cyan focus:bg-white"
                />
              </label>
            ))}

            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 rounded-[10px] border border-border py-2.5 text-[13px] font-semibold text-ink-3">
                Cancel
              </button>
              <button type="button" onClick={saveEditRecord} disabled={savingEdit} className="flex-1 rounded-[10px] bg-green py-2.5 text-[13px] font-bold text-white disabled:opacity-50">
                {savingEdit ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteDischarge && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setConfirmDeleteDischarge(null)}>
          <div className="w-full max-w-[400px] rounded-t-[20px] bg-white p-5 sm:rounded-[20px]" onClick={e => e.stopPropagation()}>
            <div className="mb-1 text-[15px] font-extrabold text-ink">Delete this discharge record?</div>
            <div className="mb-4 text-[12.5px] text-ink-3">
              {confirmDeleteDischarge[COL.PRODUCT]} — {litres(confirmDeleteDischarge[COL.ACTUAL])} on {formatDateLabel(confirmDeleteDischarge[COL.DATE])}. This can't be undone.
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDeleteDischarge(null)} className="flex-1 rounded-[10px] border border-border py-2.5 text-[13px] font-semibold text-ink-3">
                Cancel
              </button>
              <button type="button" onClick={handleDeleteDischarge} disabled={savingEdit} className="flex-1 rounded-[10px] bg-red py-2.5 text-[13px] font-bold text-white disabled:opacity-50">
                {savingEdit ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
