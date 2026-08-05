import React, { useEffect, useState } from "react"
import ProofPhotoViewer from "../components/cashup/ProofPhotoViewer"
import { getStation, tanksFor, pumpsFor } from "../config/stations"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useRecordsData } from "../hooks/useRecordsData"
import { useDriveImage } from "../hooks/useDriveImage"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, numberNG, litres } from "../utils/format"
import { PrintHeader, PrintWatermark } from "../components/ui/PrintElements"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"
import { getToken } from "../utils/session"

function PhotoThumb({ fileId, onClick }) {
  const { dataUri, status } = useDriveImage(fileId)
  return (
    <button type="button" onClick={onClick} className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[14px] border" style={{ borderColor: "var(--ftk-card-border)", background: "var(--ftk-bg)" }}>
      {dataUri ? (
        <img src={dataUri} alt="" className="h-full w-full object-cover" />
      ) : status === "error" ? (
        <i className="bi bi-image" style={{ color: "var(--ftk-ink-faint)" }} />
      ) : (
        <span className="h-4 w-4 animate-spin-fast rounded-full border-2" style={{ borderColor: "var(--ftk-cyan)", borderTopColor: "transparent" }} />
      )}
    </button>
  )
}

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function liveDiff(report, tankId) {
  const open = Number(report[`${tankId}_opening`]) || 0
  const close = Number(report[`${tankId}_closing`]) || 0
  // Same reasoning as margin: the stored diff field is computed once at
  // closing time and never revisited, so a discharge landing afterward
  // leaves it stale. Live opening/closing are the actual physical readings
  // and safe to trust directly.
  return close > 0 ? Math.max(0, Math.round((open - close) * 100) / 100) : (Number(report[`${tankId}_diff`]) || 0)
}

function tankRows(report, marginByTank) {
  return [
    { id: "TK 1", product: "PMS", opening: report.tk1_opening, closing: report.tk1_closing, diff: liveDiff(report, "tk1"), margin: marginByTank?.TK1 ?? report.tk1_margin },
    { id: "TK 2", product: "PMS", opening: report.tk2_opening, closing: report.tk2_closing, diff: liveDiff(report, "tk2"), margin: marginByTank?.TK2 ?? report.tk2_margin },
    { id: "TK 3", product: "PMS", opening: report.tk3_opening, closing: report.tk3_closing, diff: liveDiff(report, "tk3"), margin: marginByTank?.TK3 ?? report.tk3_margin },
    { id: "TK 4", product: "AGO", opening: report.tk4_opening, closing: report.tk4_closing, diff: liveDiff(report, "tk4"), margin: marginByTank?.TK4 ?? report.tk4_margin },
    ...(report.lpg_tank_opening > 0 || report.lpg_tank_closing > 0
      ? [{ id: "TK 5", product: "LPG", unit: "kg", opening: report.lpg_tank_opening, closing: report.lpg_tank_closing, diff: report.lpg_tank_diff, margin: report.lpg_tank_margin }]
      : []),
  ]
}

function pumpRows(report) {
  const map = report.pumpMetres || {}
  return Object.keys(map)
    .sort()
    .map(pump => {
      const sessions = map[pump].sessions || []
      const totalDiff = sessions.reduce((sum, s) => sum + Number(s.diff || 0), 0)
      const totalAmount = sessions.reduce((sum, s) => sum + Number(s.amount || 0), 0)
      const litresFallback = Number(map[pump].litres || 0)
      // Only worth showing as a breakdown when there's more than one
      // DISTINCT price across sessions — two sessions at the same price
      // (a supervisor just doing opening/closing normally) isn't a price
      // change and doesn't need to be shown as if it were one.
      const distinctPrices = new Set(sessions.filter(s => Number(s.diff) > 0).map(s => Number(s.price)))
      return {
        pump,
        sessionCount: sessions.length,
        diff: sessions.length ? totalDiff : litresFallback,
        amount: totalAmount,
        priceBreakdown: distinctPrices.size > 1
          ? sessions.filter(s => Number(s.diff) > 0).map(s => ({ litres: Number(s.diff), price: Number(s.price), amount: Number(s.amount) }))
          : null,
      }
    })
}

/* Same formula as Records: expected revenue (fuel sold) vs everything the
   customer could have paid with — cash, both POS terminals, both transfer
   types. Transfers were originally left out here (as they briefly were on
   Records too), which made the variance meaningless on a transfer-heavy day;
   now both pages agree.

   THE REAL BUG: expected revenue was read from report.pms_revenue /
   ago_revenue — fields stored on the daily record. But those only get
   written at specific save moments; if cash-up is submitted before dip (which
   we deliberately allow), they're written as 0 and NOTHING recalculates them
   afterward when the real pump readings come in. So a day with genuine,
   complete pump data could still show pms_revenue: 0 on the stored record —
   confirmed directly: a real check on 23 July showed full pump sessions for
   all 4 pumps with real diffs, while pms_litres/pms_revenue both sat at zero.
   Records never trusted that stored field for this reason — it computes
   expected revenue LIVE from the actual pump sessions × the day's price.
   This does the same, instead of trusting a field that can silently go
   stale. */
/* Real pump session data is the ground truth for "how much fuel actually sold
   today" — the stored litres/revenue/grand_total fields on the daily record
   only get written at specific save moments and can sit stale (confirmed
   directly: a real day showed complete pump sessions for every pump while
   pms_litres/pms_revenue/grand_total all read zero). Every figure derived
   from fuel sold — variance, the Grand Total hero, anything — uses this
   single live computation instead of trusting a field that can go stale. */
function liveFuelData(report) {
  const map = report.pumpMetres || {}
  let pmsPumpLitres = 0, agoPumpLitres = 0, hasPumpSessionData = false
  Object.keys(map).forEach(pump => {
    const sessions = map[pump].sessions || []
    const diff = sessions.length
      ? sessions.reduce((sum, s) => sum + Number(s.diff || 0), 0)
      : Number(map[pump].litres || 0)
    if (sessions.some(s => Number(s.open) > 0 || Number(s.close) > 0) || diff > 0) hasPumpSessionData = true
    const isAgo = pump.toUpperCase().includes("AGO") || map[pump].product === "AGO"
    if (isAgo) agoPumpLitres += diff
    else pmsPumpLitres += diff
  })

  const hasFuelData = hasPumpSessionData || (report.pms_litres || 0) > 0 || (report.ago_litres || 0) > 0
  const pmsLitres = hasPumpSessionData ? pmsPumpLitres : (report.pms_litres || 0)
  const agoLitres = hasPumpSessionData ? agoPumpLitres : (report.ago_litres || 0)
  const pmsRevenue = pmsLitres * (report.pms_price || 0)
  const agoRevenue = agoLitres * (report.ago_price || 0)

  return { hasFuelData, pmsLitres, agoLitres, pmsRevenue, agoRevenue, fuelRevenue: pmsRevenue + agoRevenue }
}

/* Margin (tank dip diff vs what the pumps actually recorded selling) used to
   be read straight from a stored field — computed ONCE, the moment dip was
   submitted, and never touched again. If pump sales get corrected afterward
   (like a missing price-cutover session getting added back to SalesLog),
   that stored margin stays frozen at its old, now-wrong value forever —
   confirmed directly: fixing 27 July's missing session didn't move TK2/TK3's
   margin at all, because nothing ever recalculated it. This computes margin
   LIVE instead, the same formula the backend uses, straight from real pump
   session data — so it's always correct, no resubmission needed. */
function liveMarginByTank(report, station) {
  const map = report.pumpMetres || {}
  const litresByTank = {}
  pumpsFor(station).forEach(p => {
    const entry = map[p.id]
    const sessions = entry?.sessions || []
    const diff = sessions.length
      ? sessions.reduce((sum, s) => sum + Number(s.diff || 0), 0)
      : Number(entry?.litres || 0)
    litresByTank[p.tank] = (litresByTank[p.tank] || 0) + diff
  })
  const marginByTank = {}
  tanksFor(station).forEach(t => {
    const pumpLitres = litresByTank[t.id] || 0
    // dipDiff computed LIVE (opening minus closing), not trusted from the
    // stored diff field — that field is itself computed once at closing-
    // submission time and never revisited. Confirmed directly: every tank
    // that received a discharge AFTER its closing was submitted showed a
    // stored diff of exactly 0, because it was calculated before the
    // discharge bumped the opening. Opening/closing themselves are safe to
    // trust — they're the actual physical readings, not derived values.
    const open = Number(report[`${t.id.toLowerCase()}_opening`]) || 0
    const close = Number(report[`${t.id.toLowerCase()}_closing`]) || 0
    const dipDiff = close > 0 ? Math.max(0, open - close) : (Number(report[`${t.id.toLowerCase()}_diff`]) || 0)
    marginByTank[t.id] = Math.round((pumpLitres - dipDiff) * 100) / 100
  })
  return marginByTank
}

function reconciliationFor(report) {
  const { fuelRevenue, hasFuelData } = liveFuelData(report)
  /* CASH is entered gross — confirmed directly: CASH minus TOTAL_EXPENSES
     consistently equals TO_BANK on every real day checked. That means the
     money later spent on expenses is already fully inside this CASH
     figure; it was never money sitting outside the count. An earlier
     version of this function added total_expenses back in here, on the
     theory that expenses needed to be "restored" to the collected total —
     that was a mistake. Since CASH already includes it, adding it again
     double-counted every expense as if it were extra income, turning
     honestly-balanced days into a false "surplus" exactly equal to
     whatever that day's expenses happened to be. Confirmed directly on a
     day that was truly balanced to within a rounding cent before the
     double-count, and showed a fabricated ₦71,445 surplus after it. */
  const collected = (report.pos_mp || 0) + (report.pos_zm || 0) + (report.cash || 0)
    + (report.trf_mp || 0) + (report.trf_zb || 0)

  return { variance: collected - fuelRevenue, hasData: hasFuelData }
}

function buildSummaryText(report, date) {
  const { hasFuelData, pmsLitres, agoLitres, pmsRevenue, agoRevenue, fuelRevenue } = liveFuelData(report)
  const displayGrandTotal = hasFuelData ? fuelRevenue : (report.grand_total || 0)
  const station = activeStation()
  const marginByTank = liveMarginByTank(report, station)
  let livePmsMargin = 0, liveAgoMargin = 0
  tanksFor(station).forEach(t => {
    if (t.product === "PMS") livePmsMargin += marginByTank[t.id] || 0
    else if (t.product === "AGO") liveAgoMargin += marginByTank[t.id] || 0
  })
  livePmsMargin = Math.round(livePmsMargin * 100) / 100
  liveAgoMargin = Math.round(liveAgoMargin * 100) / 100
  const livePmsMarginAmount = Math.round(livePmsMargin * (report.pms_price || 0) * 100) / 100
  const liveAgoMarginAmount = Math.round(liveAgoMargin * (report.ago_price || 0) * 100) / 100
  const lines = [
    `${getStation(activeStation()).name} — Daily Summary`,
    `${date}`,
    ``,
    `Grand Total: ${naira(displayGrandTotal)}`,
    `PMS: ${litres(pmsLitres, { maximumFractionDigits: 2 })} @ ${report.pms_price > 0 ? naira(report.pms_price) : "—"}/L = ${naira(pmsRevenue)}`,
    `AGO: ${litres(agoLitres, { maximumFractionDigits: 2 })} @ ${report.ago_price > 0 ? naira(report.ago_price) : "—"}/L = ${naira(agoRevenue)}`,
    `PMS Margin: ${litres(livePmsMargin, { maximumFractionDigits: 2 })} (${naira(livePmsMarginAmount)}) · AGO Margin: ${litres(liveAgoMargin, { maximumFractionDigits: 2 })} (${naira(liveAgoMarginAmount)})`,
    ``,
    `Tank Dips:`,
    ...tankRows(report, marginByTank).map(
      t => `  ${t.id} (${t.product}): ${numberNG(t.opening, { maximumFractionDigits: 2 })}${t.unit || "L"} → ${numberNG(t.closing, { maximumFractionDigits: 2 })}${t.unit || "L"}, diff ${numberNG(t.diff, { maximumFractionDigits: 2 })}${t.unit || "L"}, margin ${numberNG(t.margin, { maximumFractionDigits: 2 })}${t.unit || "L"}`
    ),
    ``,
    `Total POS (M.P): ${naira(report.pos_mp)}`,
    `Total POS (Z.M): ${naira(report.pos_zm)}`,
    `Total TRF (M.P): ${naira(report.trf_mp)}`,
    ...(report.trf_zb_amelia || report.trf_fcmb_truck || report.trf_fcmb_md ? [
      `TRF to Z.B Amelia: ${naira(report.trf_zb_amelia)}`,
      `TRF to FCMB Truck: ${naira(report.trf_fcmb_truck)}`,
      `TRF to FCMB M.D: ${naira(report.trf_fcmb_md)}`,
    ] : []),
    `Cash Collected: ${naira(report.cash)}`,
    `Expenses: ${naira(report.total_expenses)}`,
    ...((report.expense_items || []).map(e => `  • ${e.description || "Expense"}: ${naira(Number(e.amount) || 0)}`)),
    `POS Charges (M.P): ${naira(report.pos_mp_charge)}`,
    `POS Charges (Z.M): ${naira(report.pos_zm_charge)}`,
    ...(report.emtl_amount ? [`EMTL: ${naira(report.emtl_amount)}`] : []),
    `Cash to Bank: ${naira(report.to_bank)}`,
    ...(reconciliationFor(report).hasData ? [`Variance: ${naira(reconciliationFor(report).variance)} (${reconciliationFor(report).variance < 0 ? "Shortage" : reconciliationFor(report).variance > 0 ? "Surplus" : "Balanced"})`] : []),
    ``,
    ...(report.lubricantItems?.length ? [
      `Lubricant (Oil) Report:`,
      ...report.lubricantItems.map(it => `  ${it.product} ${it.qty}*${naira(it.unitPrice)} = ${naira(it.amount)}`),
      `Total Amount Remitted: ${naira(report.lubricant_rev)}`,
      ``,
    ] : []),
    ...(report.lpg_kg ? [
      `LPG Report:`,
      `  Total KG: ${report.lpg_kg}KG`,
      `  Unit Price: ${naira(report.lpg_price)}`,
      `  Total Sales: ${naira(report.lpg_revenue)}`,
      `  Amount Remitted: ${naira(report.lpg_remitted)}`,
      ``,
    ] : []),
    ...(report.total_cash_summary ? [
      `Sales Cash Summary:`,
      `  PMS: ${naira(report.pms_cash_summary)}`,
      `  AGO: ${naira(report.ago_cash_summary)}`,
      `  OIL: ${naira(report.oil_cash_summary)}`,
      `  GAS: ${naira(report.gas_cash_summary)}`,
      `  TOTAL: ${naira(report.total_cash_summary)}`,
      ``,
    ] : []),
    ...(report.cashup_status ? [`Cash Reconciliation: ${report.cashup_status}`] : []),
    ...(report.remarks ? [``, `Remarks: ${report.remarks}`] : []),
    `Submitted by: ${report.submitted_by || "—"}`,
  ]
  return lines.join("\n")
}

/* ── small presentational helpers, in the fintech-light language ── */
function Section({ title, right, children }) {
  return (
    <div className="ftk-glass mb-4 rounded-[18px] p-4">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <span className="text-[10px] font-extrabold uppercase tracking-[0.9px]" style={{ color: "var(--ftk-ink-faint)" }}>{title}</span>}
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

function Row({ label, value, bold, tone, sub }) {
  const color = tone === "red" ? "var(--ftk-red)" : tone === "green" ? "var(--ftk-green)" : tone === "amber" ? "var(--ftk-amber)" : "var(--ftk-ink)"
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <span className={`text-[13px] ${bold ? "font-extrabold" : "font-semibold"}`} style={{ color: tone ? color : "var(--ftk-ink-dim)" }}>{label}</span>
        {sub && <div className="text-[10.5px]" style={{ color: "var(--ftk-ink-faint)" }}>{sub}</div>}
      </div>
      <span className="ftk-mono text-[13px] font-bold" style={{ color }}>{value}</span>
    </div>
  )
}

function SummaryInner() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const { status, report, refresh } = useRecordsData(auth.username, date)

  /* Discharge for this specific date — same reasoning as Records: without
     this, an unusually high opening figure has no explanation anywhere on
     the summary a supervisor prints or shares. */
  const [dischargeToday, setDischargeToday] = useState([])
  useEffect(() => {
    if (!SCRIPT_URL || !date) return
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getDischarge")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("dateFrom", date)
    url.searchParams.set("dateTo", date)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => setDischargeToday(d.ok ? (d.discharge || []) : []))
      .catch(() => setDischargeToday([]))
  }, [date])
  const [photos, setPhotos] = useState([])
  const [lightboxPhoto, setLightboxPhoto] = useState(null)
  usePageTitle(`Daily Summary — ${getStation(activeStation()).name}`)

  useEffect(() => {
    if (!SCRIPT_URL || !date) return
    setPhotos([])
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getPhotos")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (d.ok) setPhotos(d.photos || [])
      })
      .catch(() => {
        // silent — the rest of the summary still works without photos
      })
  }, [date])

  const lightboxImage = useDriveImage(lightboxPhoto ? lightboxPhoto.fileId : null)

  const station = activeStation()
  const isMM = station === "mrs"
  const themeVars = isMM ? { "--ftk-cyan": "#B8860B", "--ftk-violet": "#8F3A5C" } : {}

  if (auth.loading || !auth.user) {
    return <div className="fintech-dark min-h-screen" style={{ ...themeVars }} />
  }

  const handleShare = async () => {
    if (!report) return
    const text = buildSummaryText(report, date)
    if (navigator.share) {
      try {
        await navigator.share({ title: "MSO Daily Summary", text })
      } catch (e) {
        // user cancelled the share sheet — not an error worth surfacing
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
    }
  }

  const recon = report ? reconciliationFor(report) : null

  return (
    <div className="fintech-dark relative overflow-hidden pb-16" style={{ background: "var(--ftk-bg-hero)", ...themeVars }}>
      <SafeAreaDebug />
      <div className="pointer-events-none absolute -right-16 -top-20 h-[260px] w-[260px] rounded-full opacity-[0.12] print:hidden" style={{ background: "var(--ftk-violet)", filter: "blur(60px)" }} />
      <div className="pointer-events-none absolute -left-20 top-32 h-[200px] w-[200px] rounded-full opacity-[0.10] print:hidden" style={{ background: "var(--ftk-cyan)", filter: "blur(60px)" }} />

      {/* Top bar */}
      <div
        className="sticky top-0 z-[200] flex items-center gap-3 px-4 pb-2.5 print:hidden"
        style={{ paddingTop: "max(var(--sat), 26px)", background: "rgba(244,246,251,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--ftk-card-border)" }}
      >
        <button
          type="button"
          onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px]"
          style={{ background: "var(--ftk-card)", border: "1px solid var(--ftk-card-border)", color: "var(--ftk-ink-dim)" }}
        >
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[15px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>Daily Summary</div>
          <label className="mt-0.5 flex items-center gap-1.5 text-[10.5px]" style={{ color: "var(--ftk-ink-faint)" }}>
            <i className="bi bi-calendar3" />
            <input
              type="date"
              value={date}
              max={today}
              onChange={e => e.target.value && setDate(e.target.value)}
              className="bg-transparent text-[10.5px] outline-none [color-scheme:light]"
              style={{ color: "var(--ftk-ink-faint)" }}
            />
          </label>
        </div>
        <button type="button" onClick={() => window.print()} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px]" style={{ background: "var(--ftk-card)", border: "1px solid var(--ftk-card-border)", color: "var(--ftk-ink-dim)" }}>
          <i className="bi bi-printer" />
        </button>
        <button type="button" onClick={handleShare} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px]" style={{ background: "var(--ftk-card)", border: "1px solid var(--ftk-card-border)", color: "var(--ftk-ink-dim)" }}>
          <i className="bi bi-share" />
        </button>
      </div>

      <div className="print-release relative z-10 mx-auto max-w-[560px] px-4 py-5">
        <PrintWatermark />
        <PrintHeader
          title="Daily Summary"
          subtitle={
            report
              ? new Date(date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
              : undefined
          }
        />

        {status === "loading" && (
          <div className="flex items-center justify-center py-16 text-[13px]" style={{ color: "var(--ftk-ink-faint)" }}>
            <span className="mr-2 h-4 w-4 animate-spin-fast rounded-full border-2" style={{ borderColor: "var(--ftk-cyan)", borderTopColor: "transparent" }} />
            Loading summary…
          </div>
        )}

        {/* This state existed in the data hook but had no UI here at all —
            a failed or timed-out request just showed nothing, forever,
            with no way to tell what happened or try again. Confirmed
            directly: this is what "the page isn't loading" actually was —
            not a crash, a silent failure with no visible outcome either
            way. */}
        {status === "error" && (
          <div className="ftk-glass flex flex-col items-center gap-2 rounded-[20px] py-16 text-center">
            <i className="bi bi-wifi-off text-3xl" style={{ color: "var(--ftk-ink-faint)" }} />
            <div className="text-[14px] font-bold" style={{ color: "var(--ftk-ink)" }}>
              Couldn't load this summary
            </div>
            <div className="max-w-[280px] text-[12.5px]" style={{ color: "var(--ftk-ink-faint)" }}>
              The request timed out or the connection dropped. Check your connection and try again.
            </div>
            <button
              type="button"
              onClick={refresh}
              className="mt-2 rounded-full px-4 py-2 text-[12.5px] font-bold text-white"
              style={{ background: "var(--brand-primary)" }}
            >
              <i className="bi bi-arrow-clockwise mr-1.5" /> Try again
            </button>
          </div>
        )}

        {status === "no-data" && (
          <div className="ftk-glass flex flex-col items-center gap-2 rounded-[20px] py-16 text-center">
            <i className="bi bi-inbox text-3xl" style={{ color: "var(--ftk-ink-faint)" }} />
            <div className="text-[14px] font-bold" style={{ color: "var(--ftk-ink)" }}>
              {date === today ? "No data for today yet" : "No record found for this date"}
            </div>
            <div className="max-w-[280px] text-[12.5px]" style={{ color: "var(--ftk-ink-faint)" }}>
              {date === today
                ? "Once Dip and Cashup are submitted, the summary will appear here."
                : "Try a different date, or check that Dip and Cashup were submitted that day."}
            </div>
          </div>
        )}

        {status === "ready" && report && (() => {
          const { hasFuelData, fuelRevenue, pmsLitres, agoLitres, pmsRevenue, agoRevenue } = liveFuelData(report)
          const displayGrandTotal = hasFuelData ? fuelRevenue : (report.grand_total || 0)
          // Live margin, aggregated by product from each tank's live margin —
          // replaces the stored pms_margin/ago_margin fields, which only ever
          // reflected whatever SalesLog looked like at the moment dip was
          // originally submitted.
          const marginByTank = liveMarginByTank(report, station)
          let livePmsMargin = 0, liveAgoMargin = 0
          tanksFor(station).forEach(t => {
            if (t.product === "PMS") livePmsMargin += marginByTank[t.id] || 0
            else if (t.product === "AGO") liveAgoMargin += marginByTank[t.id] || 0
          })
          livePmsMargin = Math.round(livePmsMargin * 100) / 100
          liveAgoMargin = Math.round(liveAgoMargin * 100) / 100
          const livePmsMarginAmount = Math.round(livePmsMargin * (report.pms_price || 0) * 100) / 100
          const liveAgoMarginAmount = Math.round(liveAgoMargin * (report.ago_price || 0) * 100) / 100
          return (
          <>
            {/* Hero — Grand Total */}
            <div className="mb-4 overflow-hidden rounded-[22px] text-white shadow-lift print:hidden" style={{ background: `linear-gradient(135deg, var(--ftk-cyan), var(--ftk-violet))` }}>
              <div className="p-5">
                <div className="text-[10px] font-bold uppercase tracking-[1.2px] opacity-70">{getStation(station).name} · {new Date(date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}</div>
                <div className="ftk-mono mt-1.5 text-[32px] font-black tracking-tight">{naira(displayGrandTotal)}</div>
                <div className="text-[11px] opacity-70">Grand Total</div>
                {(livePmsMargin !== 0 || liveAgoMargin !== 0) && (
                  <div className="mt-3 flex gap-4 border-t border-white/20 pt-3 text-[11px] opacity-90">
                    <div><span className="opacity-70">PMS Margin: </span><span className="ftk-mono font-bold">{litres(livePmsMargin, { maximumFractionDigits: 2 })} ({naira(livePmsMarginAmount)})</span></div>
                    <div><span className="opacity-70">AGO Margin: </span><span className="ftk-mono font-bold">{litres(liveAgoMargin, { maximumFractionDigits: 2 })} ({naira(liveAgoMarginAmount)})</span></div>
                  </div>
                )}
              </div>
            </div>

            {/* Print-only plain header (keeps printed output clean, unaffected by screen theme) */}
            <div className="hidden overflow-hidden rounded-card border border-border bg-white print:block">
              <div className="border-b border-border px-5 py-4">
                <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-ink-4">{getStation(station).name} · Daily Summary</div>
                <div className="mt-1 text-[15px] font-bold text-ink">{new Date(date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
                <div className="mono mt-2 text-[24px] font-black text-ink">{naira(displayGrandTotal)}</div>
              </div>
            </div>

            {/* PMS / AGO fuel cards */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              {[
                { label: "PMS", litres: pmsLitres, revenue: pmsRevenue, price: report.pms_price, margin: livePmsMargin, marginAmt: livePmsMarginAmount, tiers: report.priceTiers?.PMS, tint: "var(--ftk-cyan)" },
                { label: "AGO", litres: agoLitres, revenue: agoRevenue, price: report.ago_price, margin: liveAgoMargin, marginAmt: liveAgoMarginAmount, tiers: report.priceTiers?.AGO, tint: "var(--ftk-violet)" },
              ].map(f => (
                <div key={f.label} className="ftk-glass rounded-[18px] p-4">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: f.tint }} />
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.7px]" style={{ color: "var(--ftk-ink-faint)" }}>{f.label}</span>
                  </div>
                  <div className="ftk-mono text-[16px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>{litres(f.litres, { maximumFractionDigits: 2 })}</div>
                  <div className="text-[11px]" style={{ color: "var(--ftk-ink-dim)" }}>{naira(f.revenue)} @ {f.price > 0 ? `${naira(f.price)}/L` : "— /L"}</div>
                  <div className="mt-1 text-[10.5px]" style={{ color: "var(--ftk-ink-faint)" }}>Margin: {litres(f.margin, { maximumFractionDigits: 2 })} · {naira(f.marginAmt)}</div>
                  {f.tiers?.length > 1 && (
                    <div className="mt-2 space-y-0.5 border-t pt-2" style={{ borderColor: "var(--ftk-card-border)" }}>
                      {f.tiers.map((t, i) => (
                        <div key={i} className="flex justify-between text-[10px]" style={{ color: "var(--ftk-ink-faint)" }}>
                          <span>{litres(t.litres, { maximumFractionDigits: 2 })} @ {naira(t.price)}</span>
                          <span className="ftk-mono font-semibold" style={{ color: "var(--ftk-ink-dim)" }}>{naira(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Discharge received this day — explains why an opening
                reading might be higher than a plain sales day would
                produce. The stored opening already includes it (bumped
                directly the moment discharge was saved); this shows the
                story behind that number rather than leaving it unexplained
                on a summary that gets printed or shared. */}
            {dischargeToday.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.7px]" style={{ color: "var(--ftk-ink-faint)" }}>Discharge Received</div>
                <div className="ftk-glass overflow-hidden rounded-[18px]">
                  {dischargeToday.map((d, i) => {
                    const tankMatch = String(d["Product"] || "").toUpperCase().match(/TANK\s*(\d+)|TK\s*(\d+)/)
                    const tankId = tankMatch ? "TK" + (tankMatch[1] || tankMatch[2]) : null
                    const received = Number(d["Actual Received"]) || 0
                    const currentOpen = tankId ? Number(report[`${tankId.toLowerCase()}_opening`]) || 0 : 0
                    const beforeOpen = currentOpen - received
                    return (
                      <div key={i} className="flex items-center justify-between px-4 py-3" style={{ borderTop: i > 0 ? "1px solid var(--ftk-card-border)" : "none" }}>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-bold" style={{ color: "var(--ftk-ink)" }}>{d["Product"]}</div>
                          <div className="text-[10.5px]" style={{ color: "var(--ftk-ink-faint)" }}>{d["Supplier"]} · {litres(received)} received</div>
                        </div>
                        {tankId && (
                          <div className="flex-shrink-0 text-right">
                            <div className="ftk-mono text-[11px]" style={{ color: "var(--ftk-ink-faint)" }}>
                              {litres(beforeOpen)} → <span className="font-bold" style={{ color: "var(--ftk-ink)" }}>{litres(currentOpen)}</span>
                            </div>
                            <div className="text-[8.5px] uppercase tracking-[0.4px]" style={{ color: "var(--ftk-ink-faint)" }}>before → current opening</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tank dips */}
            <Section title="Tank Dips">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--ftk-card-border)" }}>
                      {["Tank", "Opening", "Closing", "Diff", "Margin"].map(h => (
                        <th key={h} className="py-1.5 pr-2 text-left text-[9px] font-bold uppercase tracking-[0.5px] last:text-right" style={{ color: "var(--ftk-ink-faint)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tankRows(report, marginByTank).map(t => (
                      <tr key={t.id} style={{ borderBottom: "1px solid var(--ftk-card-border)" }}>
                        <td className="py-2 pr-2 text-[11.5px] font-bold" style={{ color: "var(--ftk-ink)" }}>{t.id} <span className="font-normal" style={{ color: "var(--ftk-ink-faint)" }}>· {t.product}</span></td>
                        <td className="ftk-mono py-2 pr-2 text-[11.5px]" style={{ color: "var(--ftk-ink-dim)" }}>{numberNG(t.opening, { maximumFractionDigits: 2 })}{t.unit || "L"}</td>
                        <td className="ftk-mono py-2 pr-2 text-[11.5px]" style={{ color: "var(--ftk-ink-dim)" }}>{numberNG(t.closing, { maximumFractionDigits: 2 })}{t.unit || "L"}</td>
                        <td className="ftk-mono py-2 pr-2 text-[11.5px]" style={{ color: "var(--ftk-ink-dim)" }}>{numberNG(t.diff, { maximumFractionDigits: 2 })}{t.unit || "L"}</td>
                        <td className="ftk-mono py-2 text-right text-[11.5px] font-bold" style={{ color: "var(--ftk-ink)" }}>{numberNG(t.margin, { maximumFractionDigits: 2 })}{t.unit || "L"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Pump readings */}
            {pumpRows(report).length > 0 && (
              <Section title="Pump Readings">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--ftk-card-border)" }}>
                        {["Pump", "Sessions", "Litres", "Amount"].map(h => (
                          <th key={h} className="py-1.5 pr-2 text-left text-[9px] font-bold uppercase tracking-[0.5px] last:text-right" style={{ color: "var(--ftk-ink-faint)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pumpRows(report).map(p => (
                        <React.Fragment key={p.pump}>
                          <tr style={{ borderBottom: p.priceBreakdown ? "none" : "1px solid var(--ftk-card-border)" }}>
                            <td className="py-2 pr-2 text-[11.5px] font-bold" style={{ color: "var(--ftk-ink)" }}>{p.pump}</td>
                            <td className="py-2 pr-2 text-[11.5px]" style={{ color: "var(--ftk-ink-faint)" }}>{p.sessionCount || "—"}</td>
                            <td className="ftk-mono py-2 pr-2 text-[11.5px]" style={{ color: "var(--ftk-ink-dim)" }}>{litres(p.diff, { maximumFractionDigits: 2 })}</td>
                            <td className="ftk-mono py-2 text-right text-[11.5px] font-bold" style={{ color: "var(--ftk-ink)" }}>{p.amount > 0 ? naira(p.amount) : "—"}</td>
                          </tr>
                          {/* Only shown when this pump genuinely sold at more than
                              one price that day — a real price change, not just
                              a normal opening/closing pair. Broken out by price,
                              same treatment as the PMS/AGO tier breakdown above. */}
                          {p.priceBreakdown && (
                            <tr style={{ borderBottom: "1px solid var(--ftk-card-border)" }}>
                              <td colSpan={4} className="pb-2 pl-3 pr-2">
                                <div className="space-y-0.5">
                                  {p.priceBreakdown.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between text-[10px]" style={{ color: "var(--ftk-ink-faint)" }}>
                                      <span>{litres(s.litres, { maximumFractionDigits: 2 })} @ {naira(s.price)}</span>
                                      <span className="ftk-mono font-semibold" style={{ color: "var(--ftk-ink-dim)" }}>{naira(s.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <Section title={`Photos (${photos.length})`}>
                <div className="print:hidden">
                  {["Morning", "Evening"].map(session => {
                    const group = photos.filter(p => p.session === session)
                    if (group.length === 0) return null
                    return (
                      <div key={session} className="mb-3 last:mb-0">
                        <div className="mb-1.5 text-[10px] font-semibold" style={{ color: "var(--ftk-ink-faint)" }}>{session}</div>
                        <div className="flex flex-wrap gap-2">
                          {group.map((p, i) => (
                            <PhotoThumb key={i} fileId={p.fileId} onClick={() => setLightboxPhoto(p)} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}

            {/* Payments / Expenses / Variance */}
            <Section>
              <Row label="Total POS (M.P)" value={naira(report.pos_mp)} />
              <Row label="Total POS (Z.M)" value={naira(report.pos_zm)} />
              <Row label="Total TRF (M.P)" value={naira(report.trf_mp)} />
              <Row label="Cash Collected" value={naira(report.cash)} />

              {(report.trf_zb_amelia > 0 || report.trf_fcmb_truck > 0 || report.trf_fcmb_md > 0) && (
                <div className="mt-1 space-y-1 border-t pt-2.5" style={{ borderColor: "var(--ftk-card-border)" }}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.7px]" style={{ color: "var(--ftk-ink-faint)" }}>Other Transfers</div>
                  {[
                    ["TRF to Z.B Amelia", report.trf_zb_amelia],
                    ["TRF to FCMB Truck", report.trf_fcmb_truck],
                    ["TRF to FCMB M.D", report.trf_fcmb_md],
                  ].filter(([, v]) => v > 0).map(([k, v]) => (
                    <Row key={k} label={k} value={naira(v)} />
                  ))}
                </div>
              )}

              <div className="mt-1 border-t pt-2" style={{ borderColor: "var(--ftk-card-border)" }}>
                <Row label="Expenses" value={`−${naira(report.total_expenses)}`} tone="red" />
              </div>

              {/* What each expense was for — just a plain record of what was
                  typed. Whatever's entered here IS an expense; this app
                  doesn't second-guess or relabel it. A real shortage is
                  detected automatically, by comparing what fuel sales say
                  should exist against what was actually collected — never by
                  a person manually re-tagging a specific line item. */}
              {report.expense_items && report.expense_items.length > 0 && (
                <div className="ml-3 space-y-1 border-l-2 pl-3" style={{ borderColor: "rgba(220,38,38,0.2)" }}>
                  {report.expense_items.map((e, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 py-0.5 text-[12px]" style={{ color: "var(--ftk-ink-faint)" }}>
                      <span className="min-w-0 flex-1 break-words">{e.description || "Expense"}</span>
                      <span className="ftk-mono flex-shrink-0 font-semibold">−{naira(Number(e.amount) || 0)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-1 flex items-center justify-between border-t pt-2.5 text-[12.5px]" style={{ borderColor: "var(--ftk-card-border)", color: "var(--ftk-ink-dim)" }}>
                <span>POS Charges (MP 0.30% + ZM 0.30% + TRF M.P 0.30%)</span>
                <span className="ftk-mono font-semibold">−{naira(report.pos_mp_charge + report.pos_zm_charge)}</span>
              </div>
              {report.emtl_amount > 0 && <Row label="EMTL" value={naira(report.emtl_amount)} />}

              <div className="mt-1 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--ftk-card-border)" }}>
                <span className="text-[13.5px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>Cash to Bank</span>
                <span className="ftk-mono text-[19px] font-extrabold" style={{ color: "var(--ftk-green)" }}>{naira(report.to_bank)}</span>
              </div>

              {report.pos_proof_file_id && (
                <div className="mt-2 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--ftk-card-border)" }}>
                  <ProofPhotoViewer label="Moniepoint proof" fileId={report.pos_proof_file_id} />
                </div>
              )}

              {/* Variance: fuel sold vs everything collected. Same formula and
                  numbers as the Records page — this and Records should always
                  agree, since a discrepancy between the two would itself be
                  confusing. */}
              {recon && !recon.hasData && (
                <div className="mt-1 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--ftk-card-border)" }}>
                  <span className="text-[13.5px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>Variance</span>
                  <span className="text-[12px] font-semibold" style={{ color: "var(--ftk-ink-faint)" }}>Pending — awaiting dip/pump readings</span>
                </div>
              )}
              {recon && recon.hasData && (() => {
                const { variance } = recon
                const label = Math.abs(variance) < 1 ? "Balanced" : variance < 0 ? "Shortage" : "Surplus"
                const color = Math.abs(variance) < 1 ? "var(--ftk-green)" : variance < 0 ? "var(--ftk-red)" : "var(--ftk-cyan)"
                return (
                  <div className="mt-1 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--ftk-card-border)" }}>
                    <span className="text-[13.5px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>Variance</span>
                    <div className="text-right">
                      <div className="ftk-mono text-[15px] font-extrabold" style={{ color }}>{naira(variance)}</div>
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.5px]" style={{ color }}>{label}</div>
                    </div>
                  </div>
                )
              })()}
            </Section>

            {/* Lubricant */}
            {report.lubricantItems?.length > 0 && (
              <Section title="Lubricant (Oil) Report">
                {report.lubricantItems.map((it, i) => (
                  <Row key={i} label={`${it.product}`} sub={`${it.qty}×${naira(it.unitPrice)}`} value={naira(it.amount)} />
                ))}
                <div className="mt-1.5 flex items-center justify-between border-t pt-2.5" style={{ borderColor: "var(--ftk-card-border)" }}>
                  <span className="text-[13px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>Total Amount Remitted</span>
                  <span className="ftk-mono text-[15px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>{naira(report.lubricant_rev)}</span>
                </div>
              </Section>
            )}

            {/* LPG */}
            {report.lpg_kg > 0 && (
              <Section title="LPG Report">
                <Row label="Total KG" value={`${report.lpg_kg}KG`} />
                <Row label="Unit Price" value={naira(report.lpg_price)} />
                <Row label="Total Sales" value={naira(report.lpg_revenue)} />
                <Row label="Amount Remitted" value={naira(report.lpg_remitted)} />
              </Section>
            )}

            {/* Sales Cash Summary */}
            {report.total_cash_summary > 0 && (
              <Section title="Sales Cash Summary">
                {[
                  ["PMS", report.pms_cash_summary],
                  ["AGO", report.ago_cash_summary],
                  ["OIL", report.oil_cash_summary],
                  ["GAS", report.gas_cash_summary],
                ].map(([k, v]) => <Row key={k} label={k} value={naira(v)} />)}
                <div className="mt-1 flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--ftk-card-border)" }}>
                  <span className="text-[13px] font-extrabold" style={{ color: "var(--ftk-ink)" }}>TOTAL</span>
                  <span className="ftk-mono text-[17px] font-extrabold" style={{ color: "var(--ftk-cyan)" }}>{naira(report.total_cash_summary)}</span>
                </div>
              </Section>
            )}

            {/* Status + remarks */}
            {(report.remarks || report.cashup_status) && (
              <Section>
                {report.cashup_status && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.7px]" style={{ color: "var(--ftk-ink-faint)" }}>Cash Reconciliation:</span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={
                        report.cashup_status === "APPROVED" ? { background: "rgba(52,211,153,0.15)", color: "var(--ftk-green)" }
                        : report.cashup_status === "REJECTED" ? { background: "rgba(220,38,38,0.12)", color: "var(--ftk-red)" }
                        : { background: "rgba(217,119,6,0.12)", color: "var(--ftk-amber)" }
                      }
                    >
                      {report.cashup_status === "APPROVED" ? "✓ Approved" : report.cashup_status === "REJECTED" ? "✗ Rejected" : "⏳ Pending Approval"}
                    </span>
                  </div>
                )}
                {report.remarks && (
                  <div className="rounded-[14px] px-4 py-3" style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)" }}>
                    <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.7px]" style={{ color: "var(--ftk-amber)" }}>General Remarks</div>
                    <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: "var(--ftk-ink)" }}>{report.remarks}</div>
                  </div>
                )}
              </Section>
            )}

            <div className="pt-2 text-center text-[11px]" style={{ color: "var(--ftk-ink-faint)" }}>
              Submitted by {report.submitted_by || "—"}
            </div>
          </>
          )
        })()}
      </div>

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            className="absolute right-4 top-[max(16px,var(--sat))] flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm"
          >
            <i className="bi bi-x-lg" />
          </button>
          {lightboxImage.dataUri ? (
            <img src={lightboxImage.dataUri} alt={lightboxPhoto.subject} className="max-h-[80vh] max-w-full rounded-[10px] object-contain" />
          ) : (
            <span className="h-8 w-8 animate-spin-fast rounded-full border-2 border-white/20 border-t-white" />
          )}
          <div className="mt-3 text-center text-[12px] text-white/70">
            {lightboxPhoto.subject} · {lightboxPhoto.session} · {lightboxPhoto.submittedBy || "—"}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SummaryPage() {
  return <SummaryInner />
}
