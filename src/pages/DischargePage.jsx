import React, { useCallback, useEffect, useMemo, useState } from "react"
import { getStation } from "../config/stations"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import ConfirmSubmitModal from "../components/ui/ConfirmSubmitModal"
import { naira, litres } from "../utils/format"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"
const PRODUCTS = ["Tank 1 (PMS)", "Tank 2 (PMS)", "Tank 3 (AGO)", "Tank 4 (AGO)"]

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
  const [pricingRow, setPricingRow] = useState(null)
  const [priceInput, setPriceInput] = useState("")

  const isSupervisor = auth.role === "supervisor" || auth.role === "cashier"
  const isGM         = auth.role === "gm"
  const isGMOrOwner  = auth.isGM || auth.isOwner || auth.role === "ceo" || auth.role === "owner"

  const resetForm = () => setForm({
    date: new Date().toISOString().split("T")[0],
    product: "", supplier: "", driverName: "",
    orderedLitres: "", actualReceived: "", shortage: "",
    truckNumber: "", waybillNo: "", notes: "",
  })

  const pending = useMemo(() => records.filter(r => !isPriced(r)), [records])

  const [period, setPeriod] = useState("week") // "week" | "month" | "all"

  const now = useMemo(() => new Date(), [])
  const weekStart = useMemo(() => startOfWeek(now), [now])
  const monthStart = useMemo(() => startOfMonth(now), [now])

  const sumRecords = (list) => list.reduce((acc, r) => {
    acc.litres += Number(r[COL.ACTUAL]) || 0
    acc.cost   += Number(r[COL.TOTAL]) || 0
    acc.shortageAmount += Number(r[COL.SHORTAGE_AMOUNT]) || 0
    acc.count += 1
    return acc
  }, { litres: 0, cost: 0, shortageAmount: 0, count: 0 })

  const weekRecords = useMemo(() => records.filter(r => {
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
    return sumRecords(records)
  }, [period, records, weekRecords, monthRecords])

  const periodLabel = period === "week"
    ? `Since ${weekStart.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`
    : period === "month"
    ? monthStart.toLocaleDateString("en-NG", { month: "long", year: "numeric" })
    : "All recorded history"

  // Group records by date so admin can scan discharges day-by-day
  const groupedRecords = useMemo(() => {
    const groups = []
    const byDate = {}
    records.forEach(r => {
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
      resetForm()
      refresh()
      setTab("records")
    } else {
      setFeedback({ ok: false, text: res.error || "Save failed." })
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

  const handleAddPrice = async () => {
    if (!isGM) {
      setFeedback({ ok: false, text: "Only GM can add pricing." })
      return
    }
    if (!priceInput || !pricingRow) return
    setSaving(true)
    setFeedback(null)
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "addDischargePrice")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("rowIndex", pricingRow.rowIndex)
    url.searchParams.set("pricePerLitre", priceInput)
    url.searchParams.set("username", auth.username)
    url.searchParams.set("token", getToken())
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
    setSaving(false)
    if (res.ok) {
      setFeedback({ ok: true, text: res.warning ? `Price added. Total cost: ${naira(res.totalCost)}. ${res.warning}` : `Price added. Total cost: ${naira(res.totalCost)}` })
      setPricingRow(null)
      setPriceInput("")
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

        {/* ── RECORDS TAB ── */}
        {tab === "records" && (
          <>
            {/* Owner/GM summary strip — running totals by period, front and center */}
            {isGMOrOwner && !loading && records.length > 0 && (
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
                <div className="grid grid-cols-3 divide-x divide-white/10 px-1 py-4">
                  <div className="px-3 text-center">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-white/50">Total Litres</div>
                    <div className="mono mt-1 text-[15px] font-extrabold text-white">{litres(periodTotals.litres)}</div>
                  </div>
                  <div className="px-3 text-center">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-white/50">Total Amount</div>
                    <div className="mono mt-1 text-[15px] font-extrabold text-white">{naira(periodTotals.cost)}</div>
                  </div>
                  <div className="px-3 text-center">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-white/50">Variance Cost</div>
                    <div className={`mono mt-1 text-[15px] font-extrabold ${periodTotals.shortageAmount > 0 ? "text-amber" : periodTotals.shortageAmount < 0 ? "text-green" : "text-white"}`}>{periodTotals.shortageAmount < 0 ? `+${naira(Math.abs(periodTotals.shortageAmount))}` : naira(periodTotals.shortageAmount)}</div>
                  </div>
                </div>
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
            {!loading && records.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-[16px] bg-white py-16 text-center shadow-sm">
                <i className="bi bi-fuel-pump text-4xl text-ink-4" />
                <div className="text-[14px] font-bold text-ink">No discharge records yet</div>
                <div className="text-[12.5px] text-ink-4">Records will appear here once a supervisor logs a discharge.</div>
              </div>
            )}
            {!loading && records.length > 0 && (
              <div className="space-y-5">
                {groupedRecords.map((group, gi) => (
                  <div key={gi}>
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <div className="text-[11.5px] font-extrabold text-ink-2">{formatDateLabel(group.date)}</div>
                      <div className="h-px flex-1 bg-border" />
                      {isGMOrOwner && (
                        <div className="mono text-[10.5px] font-bold text-ink-4">
                          {litres(sumRecords(group.items).litres)}
                          {sumRecords(group.items).cost > 0 && <> · {naira(sumRecords(group.items).cost)}</>}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      {group.items.map((r, i) => (
                        <div key={i} className="overflow-hidden rounded-[14px] bg-white shadow-sm transition hover:shadow-md">
                          <div className="flex items-center justify-between border-b border-surface px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy/5 text-[15px] text-navy">
                                <i className={`bi ${productIcon(r[COL.PRODUCT])}`} />
                              </div>
                              <div>
                                <div className="text-[13.5px] font-bold text-ink">{r[COL.PRODUCT]}</div>
                                <div className="text-[10.5px] text-ink-4">
                                  {r[COL.SUPPLIER] && <span className="font-semibold text-ink-2">{r[COL.SUPPLIER]}</span>}
                                  {r[COL.SUPPLIER] && r[COL.DRIVER] && " · "}
                                  {r[COL.DRIVER] && <>Driver: {r[COL.DRIVER]}</>}
                                  {(r[COL.SUPPLIER] || r[COL.DRIVER]) && " · "}
                                  Submitted by {r[COL.SUBMITTED_BY]}
                                </div>
                              </div>
                            </div>
                            {isGMOrOwner && (
                              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${isPriced(r) ? "bg-green-light text-green" : "bg-amber-light text-amber"}`}>
                                <i className={`bi ${isPriced(r) ? "bi-check-circle-fill" : "bi-hourglass-split"} text-[9px]`} />
                                {isPriced(r) ? "Priced" : "Needs Price"}
                              </span>
                            )}
                          </div>

                          {/* Supervisor/cashier view — no financials, ever */}
                          {isSupervisor && (
                            <div className="grid grid-cols-2 gap-px bg-border">
                              {[["Litres Received", `${litres(r[COL.ACTUAL])}`, "text-navy"],
                                ["Variance", varianceLabel(r[COL.SHORTAGE]).text, varianceLabel(r[COL.SHORTAGE]).cls]].map(([l, v, c]) => (
                                <div key={l} className="bg-white px-3 py-2.5">
                                  <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-ink-4">{l}</div>
                                  <div className={`mono text-[13px] font-bold ${c}`}>{v}</div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* GM/Owner view — full financials */}
                          {isGMOrOwner && (
                            <div className="grid grid-cols-3 gap-px bg-border">
                              {[["Litres Received", `${litres(r[COL.ACTUAL])}`, "text-navy"],
                                ["Price/Litre", r[COL.PRICE] ? naira(r[COL.PRICE]) : "—", "text-ink"],
                                ["Total Amount", r[COL.TOTAL] ? naira(r[COL.TOTAL]) : "—", "text-ink font-extrabold"],
                                ["Variance", varianceLabel(r[COL.SHORTAGE]).text, varianceLabel(r[COL.SHORTAGE]).cls],
                                ["Variance Cost", varianceMoney(r[COL.SHORTAGE_AMOUNT]).text, varianceMoney(r[COL.SHORTAGE_AMOUNT]).cls],
                                ["Ordered", r[COL.ORDERED] ? `${litres(r[COL.ORDERED])}` : "—", "text-ink"]].map(([l, v, c]) => (
                                <div key={l} className="bg-white px-3 py-2.5">
                                  <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-ink-4">{l}</div>
                                  <div className={`mono text-[13px] font-bold ${c}`}>{v}</div>
                                </div>
                              ))}
                            </div>
                          )}

                          {(r[COL.TRUCK] || r[COL.WAYBILL]) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-surface px-4 py-2 text-[11px] text-ink-4">
                              {r[COL.TRUCK] && <span><i className="bi bi-truck mr-1 opacity-60" />Truck: <strong className="text-ink-2">{r[COL.TRUCK]}</strong></span>}
                              {r[COL.WAYBILL] && <span><i className="bi bi-receipt mr-1 opacity-60" />Waybill: <strong className="text-ink-2">{r[COL.WAYBILL]}</strong></span>}
                            </div>
                          )}
                          {r[COL.NOTES] && (
                            <div className="border-t border-surface bg-surface/50 px-4 py-2 text-[11px] text-ink-3">
                              <i className="bi bi-sticky mr-1 opacity-60" />{r[COL.NOTES]}
                            </div>
                          )}
                          {isGM && !isPriced(r) && (
                            <button type="button" onClick={() => { setPricingRow(r); setTab("pricing") }}
                              className="flex w-full items-center justify-center gap-2 border-t border-surface py-2.5 text-[12px] font-bold text-cyan-dark transition hover:bg-cyan/5">
                              <i className="bi bi-tag" /> Add Price per Litre
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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
                        {PRODUCTS.map(t => <option key={t} value={t}>{t}</option>)}
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
                  <label className="block">
                    {/* One signed field covers both directions. A separate
                        "overage" input would let someone fill in both and
                        contradict themselves. */}
                    <span className={labelCls}>Variance (L) — shortage or overage</span>
                    <input type="number" inputMode="decimal" placeholder="0" value={form.shortage} onChange={e => setForm(f => ({...f, shortage: e.target.value}))} className={inputCls} />
                    <span className="mt-1 block text-[10.5px] text-ink-4">
                      {form.orderedLitres && form.actualReceived
                        ? (() => {
                            const v = Number(form.orderedLitres) - Number(form.actualReceived)
                            if (v === 0) return "Leave blank to auto-calculate: exact match"
                            return v > 0
                              ? `Leave blank to auto-calculate: ${litres(v)} short`
                              : `Leave blank to auto-calculate: ${litres(Math.abs(v))} over`
                          })()
                        : "Leave blank to auto-calculate from Ordered − Actual"}
                    </span>
                  </label>
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
              {pending.map((r, i) => (
                <div key={i} className="overflow-hidden rounded-[14px] bg-white shadow-sm">
                  <div className="flex items-center gap-2.5 border-b border-surface px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-light text-[15px] text-amber">
                      <i className={`bi ${productIcon(r[COL.PRODUCT])}`} />
                    </div>
                    <div>
                      <div className="text-[13.5px] font-bold text-ink">{r[COL.PRODUCT]}</div>
                      <div className="text-[10.5px] text-ink-4">{formatDateLabel(r[COL.DATE])} · Submitted by {r[COL.SUBMITTED_BY]}</div>
                    </div>
                  </div>

                  {/* Full recorded detail — exactly what the supervisor logged, before GM sets a price */}
                  <div className="grid grid-cols-2 gap-px bg-border text-[12px]">
                    {[["Supplier", r[COL.SUPPLIER] || "—", "bi-shop"],
                      ["Driver", r[COL.DRIVER] || "—", "bi-person"],
                      ["Truck No.", r[COL.TRUCK] || "—", "bi-truck"],
                      ["Waybill No.", r[COL.WAYBILL] || "—", "bi-receipt"]].map(([l, v, icon]) => (
                      <div key={l} className="bg-white px-3 py-2">
                        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.5px] text-ink-4"><i className={`bi ${icon} opacity-60`} />{l}</div>
                        <div className="mt-0.5 truncate text-[12.5px] font-bold text-ink">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-border text-[12px]">
                    {[["Ordered", r[COL.ORDERED] ? `${litres(r[COL.ORDERED])}` : "—", "text-ink"],
                      ["Actual Received", `${litres(r[COL.ACTUAL])}`, "text-navy"],
                      ["Variance", varianceLabel(r[COL.SHORTAGE]).text, varianceLabel(r[COL.SHORTAGE]).cls]].map(([l, v, c]) => (
                      <div key={l} className="bg-white px-3 py-2.5">
                        <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-ink-4">{l}</div>
                        <div className={`mono text-[13px] font-bold ${c}`}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {r[COL.NOTES] && (
                    <div className="border-t border-surface bg-surface/50 px-4 py-2 text-[11px] text-ink-3">
                      <i className="bi bi-sticky mr-1 opacity-60" />{r[COL.NOTES]}
                    </div>
                  )}

                  <div className="px-4 pb-4 pt-3">
                    <label className="mb-3 block">
                      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.5px] text-ink-4">Amount Bought Per Litre (₦)</span>
                      <input type="number" inputMode="decimal" placeholder="e.g. 850"
                        value={pricingRow?.rowIndex === r.rowIndex ? priceInput : ""}
                        onFocus={() => setPricingRow(r)}
                        onChange={e => { setPricingRow(r); setPriceInput(e.target.value) }}
                        className="mono w-full rounded-[10px] border-2 border-cyan bg-surface px-3.5 py-2.5 text-[15px] font-bold text-ink outline-none focus:bg-white" />
                    </label>
                    {pricingRow?.rowIndex === r.rowIndex && priceInput && (
                      <div className="mb-3 space-y-1.5 rounded-[9px] bg-surface px-3 py-2 text-[12px] text-ink-4">
                        <div>{litres(r[COL.ACTUAL])} × {naira(Number(priceInput))} = <strong className="text-navy">{naira(Number(r[COL.ACTUAL]) * Number(priceInput))}</strong> total amount</div>
                        {Number(r[COL.SHORTAGE]) > 0 && (
                          <div>
                            {litres(Math.abs(Number(r[COL.SHORTAGE])))} {Number(r[COL.SHORTAGE]) > 0 ? "shortage" : "overage"} × {naira(Number(priceInput))} ={" "}
                            <strong className={Number(r[COL.SHORTAGE]) > 0 ? "text-red" : "text-green"}>
                              {Number(r[COL.SHORTAGE]) > 0 ? naira(Number(r[COL.SHORTAGE]) * Number(priceInput)) : `+${naira(Math.abs(Number(r[COL.SHORTAGE]) * Number(priceInput)))}`}
                            </strong>{" "}
                            {Number(r[COL.SHORTAGE]) > 0 ? "shortage cost" : "value received"}
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" onClick={handleAddPrice} disabled={saving || pricingRow?.rowIndex !== r.rowIndex || !priceInput}
                      className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-green py-3 text-[13px] font-bold text-white shadow-lift disabled:opacity-40">
                      {saving ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> : <><i className="bi bi-check2" /> Confirm Price</>}
                    </button>
                  </div>
                </div>
              ))}
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
    </div>
  )
}
