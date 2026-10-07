import React, { useEffect, useState } from "react"
import ProofPhotoViewer from "../components/cashup/ProofPhotoViewer"
import { getStation, tanksFor, pumpsFor } from "../config/stations"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useRecordsData } from "../hooks/useRecordsData"
import { useDriveImage } from "../hooks/useDriveImage"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, numberNG, litres, litresValue } from "../utils/format"
import { PrintHeader } from "../components/ui/PrintElements"

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
  const n = new Date()
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, "0")
  const d = String(n.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/* When a day was sold at more than one price (a mid-day price change), show each price band:
   litres @ price = amount. Restored — the redesign had dropped it, and it is the only place a
   price-change day is visible at a glance. Renders nothing for an ordinary single-price day. */
function PriceBands({ tiers, tone = "screen" }) {
  if (!tiers || tiers.length < 2) return null
  const print = tone === "print"
  return (
    <div className={print ? "mt-1.5 space-y-0.5 border-t border-slate-200 pt-1.5" : "mt-2 space-y-1 border-t border-slate-100 pt-2"}>
      {tiers.map((t, i) => (
        <div key={i} className={`flex justify-between ${print ? "text-[9px] text-slate-600" : "text-[10px] text-slate-500"}`}>
          <span>{litres(t.litres, { maximumFractionDigits: 2 })} @ {naira(t.price)}</span>
          <span className="ftk-mono font-semibold">{naira(t.amount)}</span>
        </div>
      ))}
    </div>
  )
}

/* The date control is a native <input type="date"> laid invisibly over a label. On a phone a tap
   opens the calendar, but desktop browsers only open it from the tiny built-in icon — clicking the
   label did nothing. showPicker() opens it wherever you click. Wrapped because some browsers
   refuse it (or lack it); the input still works by keyboard there. */
function openDatePicker(e) {
  try { if (typeof e.currentTarget.showPicker === "function") e.currentTarget.showPicker() } catch (_) { /* fall back to native behaviour */ }
}

function summaryDateLabel(value) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

function summaryDateShortLabel(value) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
}

function shiftSummaryDate(value, delta) {
  const d = new Date(`${value}T00:00:00`)
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
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
  /* Was Object.keys(map).sort() — plain alphabetical, which put LPG1
     first and scattered P1_AGO in the middle (LPG1, P1, P1_AGO, P2, P3,
     P4) — never actually the order anyone wanted. Confirmed directly:
     staff prefer P1, P2, P3, P4, P1_AGO, matching how they think about
     the pumps physically, not string order. Sorting by each pump's
     position in the station's own configured list respects that, and
     works the same way for MSO too. */
  const order = pumpsFor(activeStation()).map(p => p.id)
  return Object.keys(map)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
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
  let pmsPumpLitres = 0, agoPumpLitres = 0, pmsPumpRevenue = 0, agoPumpRevenue = 0, hasPumpSessionData = false
  Object.keys(map).forEach(pump => {
    const sessions = map[pump].sessions || []
    const upperPump = pump.toUpperCase()
    const product = map[pump].product
    /* LPG was silently falling into the PMS bucket here — this check
       only ever distinguished AGO from "everything else," so an LPG
       pump (named "LPG1", never containing "AGO") got treated as PMS by
       default. Confirmed directly against a real paper report: LPG is
       meant to stay fully separate from fuel Variance, the same as
       Lubricant — collected and remitted on its own, never part of
       Grand Total. Skipping LPG pumps entirely here, rather than
       routing them into either bucket, is what actually matches that. */
    const isLpg = upperPump.includes("LPG") || product === "LPG"
    if (isLpg) return
    const isAgo = upperPump.includes("AGO") || product === "AGO"
    if (sessions.length) {
      /* Summed per-session — a mid-day price change means later sessions
         sold the same litres at a different price, so litres-times-a-
         single-price at the end was wrong on any multi-tier day.
         Confirmed directly: a day with a second price tier came out
         ₦68,830 short here specifically, because the total litres across
         both tiers were being multiplied by only the first tier's price.
         Each session already carries its own price and amount from the
         backend — summing those directly is the only way this comes out
         right regardless of how many price changes happened that day. */
      sessions.forEach(s => {
        const diff = Number(s.diff || 0)
        const amount = Number(s.amount || 0) || diff * Number(s.price || 0)
        if (isAgo) { agoPumpLitres += diff; agoPumpRevenue += amount }
        else { pmsPumpLitres += diff; pmsPumpRevenue += amount }
      })
      if (sessions.some(s => Number(s.open) > 0 || Number(s.close) > 0 || Number(s.diff) > 0)) hasPumpSessionData = true
    } else {
      const diff = Number(map[pump].litres || 0)
      if (isAgo) agoPumpLitres += diff
      else pmsPumpLitres += diff
      if (diff > 0) hasPumpSessionData = true
    }
  })

  const hasFuelData = hasPumpSessionData || (report.pms_litres || 0) > 0 || (report.ago_litres || 0) > 0
  const pmsLitres = hasPumpSessionData ? pmsPumpLitres : (report.pms_litres || 0)
  const agoLitres = hasPumpSessionData ? agoPumpLitres : (report.ago_litres || 0)
  const pmsRevenue = hasPumpSessionData && pmsPumpRevenue > 0 ? pmsPumpRevenue : pmsLitres * (report.pms_price || 0)
  const agoRevenue = hasPumpSessionData && agoPumpRevenue > 0 ? agoPumpRevenue : agoLitres * (report.ago_price || 0)

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
  /* Every field name here needs to match the backend exactly —
     confirmed directly: trf_zb, trf_truck, and trf_md don't exist under
     those names at all. The real fields are trf_zb_amelia,
     trf_fcmb_truck, trf_fcmb_md. trf_zb (the short name) had been silently
     reading undefined -> 0 this whole time, masked only because Amelia
     transfers happened to be ₦0 on every day tested so far — this would
     have produced the exact same false-shortage bug the moment a real
     Amelia transfer occurred. trf_truck and trf_md were simply absent
     from this formula entirely until then.

     All three — Amelia, TRF Truck, and Cash to MD — were then confirmed
     directly, one at a time, to actually be expenses: money the station
     spent, not money customers paid for fuel. All three removed from
     Collected to match.

     Expenses and TRF Truck are already subtracted from Cash to produce
     To Bank — that's the only place they belong. Collected stays POS +
     Transfer + Cash, comparing money collected against fuel sold, with
     no expense-type deduction mixed in — an earlier reading of a
     request to change this was a misunderstanding, reverted once
     clarified. */
  const collected = (report.pos_mp || 0) + (report.pos_zm || 0) + (report.cash || 0)
    + (report.trf_mp || 0)

  return { variance: collected - fuelRevenue, hasData: hasFuelData }
}

function buildSummaryText(report, date, canSeeMarginAmount) {
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
    canSeeMarginAmount
      ? `PMS Margin: ${litres(livePmsMargin, { maximumFractionDigits: 2 })} (${naira(livePmsMarginAmount)}) · AGO Margin: ${litres(liveAgoMargin, { maximumFractionDigits: 2 })} (${naira(liveAgoMarginAmount)})`
      : `PMS Margin: ${litres(livePmsMargin, { maximumFractionDigits: 2 })} · AGO Margin: ${litres(liveAgoMargin, { maximumFractionDigits: 2 })}`,
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

function SummaryMetric({ icon, label, value, sub, tone = "navy", compact = false }) {
  const tones = {
    navy: { bg: "rgba(6,15,90,0.07)", color: "var(--brand-primary)" },
    cyan: { bg: "rgba(14,165,233,0.10)", color: "#0284C7" },
    green: { bg: "rgba(22,163,74,0.10)", color: "#15803D" },
    red: { bg: "rgba(220,38,38,0.09)", color: "#DC2626" },
    amber: { bg: "rgba(217,119,6,0.10)", color: "#B45309" },
    violet: { bg: "rgba(124,58,237,0.09)", color: "#6D28D9" },
  }
  /* "navy" and "cyan" are the brand's two colours, so they follow the station:
     Mobil blue for Mobil, wine and gold for M&M. */
  const brand = getStation(activeStation()).theme
  tones.navy = { bg: `${brand.primary}12`, color: brand.primary }
  tones.cyan = { bg: `${brand.accent}1F`, color: brand.accentDark }
  const t = tones[tone] || tones.navy
  return (
    <div className={`rounded-[18px] border bg-white ${compact ? "p-3.5" : "p-4"}`} style={{ borderColor: "#E8ECF3", boxShadow: "0 6px 24px rgba(15,23,42,0.045)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.75px] text-slate-400">{label}</div>
          <div className={`ftk-mono mt-1.5 font-black tracking-tight ${compact ? "text-[14px] sm:text-[16px]" : "text-[16px] sm:text-[19px]"}`} style={{ color: "#0F172A", overflowWrap: "anywhere" }}>{value}</div>
          {sub && <div className="mt-1 text-[10.5px] font-medium text-slate-400">{sub}</div>}
        </div>
        {icon && <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: t.bg, color: t.color }}><i className={`bi ${icon}`} /></div>}
      </div>
    </div>
  )
}

function SummarySection({ title, eyebrow, action, children, className = "" }) {
  return (
    <section className={`rounded-[22px] border bg-white p-4 sm:p-5 ${className}`} style={{ borderColor: "#E7EBF2", boxShadow: "0 8px 28px rgba(15,23,42,0.045)" }}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          {eyebrow && <div className="mb-1 text-[9px] font-extrabold uppercase tracking-[1px] text-slate-400">{eyebrow}</div>}
          <h2 className="text-[14px] font-black tracking-[-0.2px] text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function SummaryStatus({ label, tone = "neutral" }) {
  const styles = {
    good: ["#ECFDF3", "#15803D", "bi-check-circle-fill"],
    warning: ["#FFF7ED", "#B45309", "bi-exclamation-circle-fill"],
    danger: ["#FEF2F2", "#DC2626", "bi-x-circle-fill"],
    neutral: ["#F1F5F9", "#64748B", "bi-clock-fill"],
  }[tone] || ["#F1F5F9", "#64748B", "bi-clock-fill"]
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ background: styles[0], color: styles[1] }}><i className={`bi ${styles[2]}`} />{label}</span>
}

function MiniBar({ value, max, tone = "cyan" }) {
  const width = max > 0 ? Math.min(100, Math.max(3, (value / max) * 100)) : 3
  const color = tone === "violet" ? "#7C3AED" : tone === "amber" ? "#D97706" : tone === "green" ? "#16A34A" : getStation(activeStation()).theme.accentDark
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} /></div>
}

function ExceptionRow({ icon, title, detail, tone = "warning" }) {
  const colors = { warning: ["#FFF7ED", "#B45309"], danger: ["#FEF2F2", "#DC2626"], good: ["#ECFDF3", "#15803D"] }[tone]
  return (
    <div className="flex items-start gap-3 rounded-[15px] border p-3" style={{ borderColor: "#EEF1F5", background: "#FBFCFE" }}>
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px]" style={{ background: colors[0], color: colors[1] }}><i className={`bi ${icon}`} /></div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-extrabold text-slate-800">{title}</div>
        <div className="mt-0.5 text-[10.5px] leading-relaxed text-slate-400">{detail}</div>
      </div>
    </div>
  )
}


class SummaryErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: "" }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "An unexpected error occurred." }
  }

  componentDidCatch(error) {
    console.error("Daily Summary failed to render:", error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-screen bg-slate-50 px-5 py-16 text-center">
        <div className="mx-auto max-w-md rounded-[24px] border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <i className="bi bi-exclamation-triangle-fill text-xl" />
          </div>
          <h1 className="mt-4 text-lg font-black text-slate-900">Daily Summary could not open</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">The report encountered an unexpected display error. Refresh the page and try again.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Reload Daily Summary</button>
          <details className="mt-5 text-left">
            <summary className="cursor-pointer text-[11px] font-bold text-slate-400">Technical detail</summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-3 text-[10px] text-slate-500">{this.state.message}</pre>
          </details>
        </div>
      </div>
    )
  }
}


function DailySummaryPrint({ report, date, canSeeMarginAmount, station, dateLabel, displayGrandTotal, pmsLitres, agoLitres, pmsRevenue, agoRevenue, livePmsMargin, liveAgoMargin, livePmsMarginAmount, liveAgoMarginAmount, tankData, paymentTotal, expenses, bank, variance, varianceLabel, varianceValue, attention }) {
  const row = (label, value, strong = false) => (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-1.5 last:border-0">
      <span className="text-[10px] text-slate-600">{label}</span>
      <span className={`ftk-mono text-right text-[10px] ${strong ? "font-black" : "font-semibold"} text-slate-900`}>{value}</span>
    </div>
  )

  return (
    <div className="print-document hidden print:block" style={{ "--pd-primary": getStation(station).theme.primary, "--pd-accent": getStation(station).theme.accent, "--pd-tint": getStation(station).theme.primaryLight }}>
      <div className="pd-hero mb-3 rounded-[12px] border pd-border p-4">
        <div className="text-[9px] font-extrabold uppercase tracking-[1px] pd-label">{getStation(station).name} · Daily Operations</div>
        <div className="mt-1 flex items-end justify-between gap-4">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.7px] text-slate-500">Fuel sales</div>
            <div className="ftk-mono mt-1 text-[25px] font-black text-slate-950">{naira(displayGrandTotal)}</div>
          </div>
          {canSeeMarginAmount && (
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-[0.7px] text-slate-500">Day margin</div>
              <div className="ftk-mono mt-1 text-[18px] font-black text-slate-950">{naira(livePmsMarginAmount + liveAgoMarginAmount)}</div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-[10px] border pd-border p-3">
          <div className="text-[9px] font-extrabold uppercase tracking-[0.7px] pd-label">PMS</div>
          <div className="ftk-mono mt-1 text-[16px] font-black text-slate-950">{litres(pmsLitres, { maximumFractionDigits: 2 })}</div>
          <div className="mt-0.5 text-[9.5px] text-slate-600">{naira(pmsRevenue)}</div>
          <div className="mt-1 text-[9px] text-slate-500">Margin: {litres(livePmsMargin, { maximumFractionDigits: 2 })}{canSeeMarginAmount && ` · ${naira(livePmsMarginAmount)}`}</div>
          <PriceBands tiers={report.priceTiers?.PMS} tone="print" />
        </div>
        <div className="rounded-[10px] border pd-border p-3">
          <div className="text-[9px] font-extrabold uppercase tracking-[0.7px] pd-label">AGO</div>
          <div className="ftk-mono mt-1 text-[16px] font-black text-slate-950">{litres(agoLitres, { maximumFractionDigits: 2 })}</div>
          <div className="mt-0.5 text-[9.5px] text-slate-600">{naira(agoRevenue)}</div>
          <div className="mt-1 text-[9px] text-slate-500">Margin: {litres(liveAgoMargin, { maximumFractionDigits: 2 })}{canSeeMarginAmount && ` · ${naira(liveAgoMarginAmount)}`}</div>
          <PriceBands tiers={report.priceTiers?.AGO} tone="print" />
        </div>
      </div>

      <div className="mb-3 rounded-[10px] border pd-border p-3">
        <div className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.8px] pd-label">Tank Dips</div>
        <table className="w-full border-collapse">
          <thead><tr className="border-b pd-border"><th className="py-1 text-left text-[8.5px] font-extrabold uppercase text-slate-500">Tank</th><th className="py-1 text-right text-[8.5px] font-extrabold uppercase text-slate-500">Opening</th><th className="py-1 text-right text-[8.5px] font-extrabold uppercase text-slate-500">Closing</th><th className="py-1 text-right text-[8.5px] font-extrabold uppercase text-slate-500">Diff</th><th className="py-1 text-right text-[8.5px] font-extrabold uppercase text-slate-500">Margin</th></tr></thead>
          <tbody>{tankData.map(t => <tr key={t.id} className="border-b border-slate-100 last:border-0"><td className="py-1 text-[9px] font-bold text-slate-800">{t.id} · {t.product}</td><td className="ftk-mono py-1 text-right text-[9px] text-slate-700">{numberNG(t.opening, { maximumFractionDigits: 2 })}{t.unit || "L"}</td><td className="ftk-mono py-1 text-right text-[9px] text-slate-700">{numberNG(t.closing, { maximumFractionDigits: 2 })}{t.unit || "L"}</td><td className="ftk-mono py-1 text-right text-[9px] text-slate-700">{numberNG(t.diff, { maximumFractionDigits: 2 })}{t.unit || "L"}</td><td className="ftk-mono py-1 text-right text-[9px] text-slate-700">{numberNG(t.margin, { maximumFractionDigits: 2 })}{t.unit || "L"}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-[10px] border pd-border p-3">
          <div className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.8px] pd-label">Cash & Reconciliation</div>
          {row("Collected", naira(paymentTotal), true)}
          {row("Expenses", naira(expenses))}
          {row("POS charges", naira((report.pos_mp_charge || 0) + (report.pos_zm_charge || 0)))}
          {row("Cash to bank", naira(bank), true)}
          {(report.excess_items || []).length > 0 && row("Excess (to Cash At Hand)", `+${naira(report.excess_items.reduce((sum, e) => sum + (Number(e.amount) || 0), 0))}`)}
          {(report.excess_items || []).map((e, i) => <React.Fragment key={i}>{row(`   ${e.description || "Excess"}`, `+${naira(Number(e.amount) || 0)}`)}</React.Fragment>)}
          {row("Variance", variance === null ? "—" : `${varianceValue} · ${varianceLabel}`)}
          {row("Cash-up", report.cashup_status || "Not submitted")}
        </div>
        <div className="rounded-[10px] border pd-border p-3">
          <div className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.8px] pd-label">Payment Breakdown</div>
          {row("Cash", naira(report.cash))}
          {row("POS · M.P", naira(report.pos_mp))}
          {row("POS · Z.M", naira(report.pos_zm))}
          {row("Transfer · M.P", naira(report.trf_mp))}
          {row("Transfer · Z.B Amelia", naira(report.trf_zb_amelia))}
        </div>
      </div>

      {(report.lubricant_rev || report.lpg_revenue || report.emtl_amount || report.total_cash_summary) && (
        <div className="mb-3 rounded-[10px] border pd-border p-3">
          <div className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.8px] pd-label">Other Operations</div>
          {row("Lubricant", naira(report.lubricant_rev))}
          {row("LPG", naira(report.lpg_revenue))}
          {row("EMTL", naira(report.emtl_amount))}
          {report.total_cash_summary ? row("Sales cash total", naira(report.total_cash_summary), true) : null}
        </div>
      )}

      <div className="mb-3 rounded-[10px] border pd-border p-3">
        <div className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.8px] pd-label">Daily Status</div>
        <div className="grid grid-cols-3 gap-3 text-[9px]">
          <div><div className="text-slate-500">Day health</div><div className="mt-0.5 font-black text-slate-900">{varianceLabel}</div></div>
          <div><div className="text-slate-500">Margin litres</div><div className="mt-0.5 ftk-mono font-black text-slate-900">{litres(livePmsMargin + liveAgoMargin, { maximumFractionDigits: 2 })}</div></div>
          <div><div className="text-slate-500">Margin %</div><div className="mt-0.5 ftk-mono font-black text-slate-900">{displayGrandTotal > 0 ? `${((livePmsMarginAmount + liveAgoMarginAmount) / displayGrandTotal * 100).toFixed(1)}%` : "—"}</div></div>
        </div>
      </div>

      {attention?.length > 0 && (
        <div className="mb-3 rounded-[10px] border pd-border p-3">
          <div className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.8px] pd-label">Attention</div>
          {attention.map((a, i) => <div key={i} className="py-1 text-[9px] text-slate-700"><b>{a.title}</b> — {a.detail}</div>)}
        </div>
      )}

      {report.remarks && <div className="mb-3 rounded-[10px] border pd-border p-3"><div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.8px] pd-label">Manager Notes</div><div className="whitespace-pre-wrap text-[9.5px] leading-relaxed text-slate-700">{report.remarks}</div></div>}

      <div className="flex items-center justify-between border-t-2 pd-rule pt-2 text-[9px] text-slate-600">
        <span>Submitted by: <b className="text-slate-900">{report.submitted_by || "—"}</b></span>
        <span>Report date: <b className="text-slate-900">{dateLabel}</b></span>
      </div>
    </div>
  )
}

function SummaryInner() {
  const auth = useAuth({ requireAuth: true })
  /* Margin amount (the naira value) is a financial figure — supervisors
     and cashiers shouldn't see it, same principle already applied to
     discharge pricing. The margin in litres is fine to show, since that's
     an operational figure, not a money one. */
  const canSeeMarginAmount = ["ceo", "owner", "gm"].includes(auth.role)
  const navigate = useNavigate()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [showAllPumpData, setShowAllPumpData] = useState(false)
  const [showAllActivity, setShowAllActivity] = useState(false)
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
    /* No timeout here before — confirmed this as a real gap: a hung
       request on this call had no way to ever resolve, and could tie up
       the browser's limited connection pool for this domain, effectively
       delaying the main report fetch too even though that one was fast
       on its own. */
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    fetch(url.toString(), { method: "GET", redirect: "follow", signal: controller.signal })
      .then(r => r.json())
      .then(d => setDischargeToday(d.ok ? (d.discharge || []) : []))
      .catch(() => setDischargeToday([]))
      .finally(() => clearTimeout(timeoutId))
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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    fetch(url.toString(), { method: "GET", redirect: "follow", signal: controller.signal })
      .then(res => res.json())
      .then(d => {
        if (d.ok) setPhotos(d.photos || [])
      })
      .catch(() => {
        // silent — the rest of the summary still works without photos
      })
      .finally(() => clearTimeout(timeoutId))
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
    const text = buildSummaryText(report, date, canSeeMarginAmount)
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

      {/* Top bar — compact report navigator that works much better on desktop and mobile. */}
      <div
        className="sticky top-0 z-[200] print:hidden"
        style={{ paddingTop: "max(var(--sat), 18px)", background: "#F4F6FB", borderBottom: "1px solid var(--ftk-card-border)" }}
      >
        <div className="mx-auto flex max-w-[1120px] items-center gap-2.5 px-4 pb-3 sm:px-5 lg:px-6">
          <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--ftk-card)", border: "1px solid var(--ftk-card-border)", color: "var(--ftk-ink-dim)" }} aria-label="Back to dashboard">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-black" style={{ color: "var(--ftk-ink)" }}>Daily Summary</div>
            <div className="hidden text-[9px] font-bold uppercase tracking-[0.8px] sm:block" style={{ color: "var(--ftk-ink-faint)" }}>Station performance report</div>
          </div>
          <div className="flex items-center gap-1.5 rounded-[14px] p-1" style={{ background: "var(--ftk-card)", border: "1px solid var(--ftk-card-border)" }}>
            <button type="button" onClick={() => setDate(shiftSummaryDate(date, -1))} className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[11px] transition hover:bg-slate-100" style={{ color: "var(--ftk-ink-dim)" }} aria-label="Previous day"><i className="bi bi-chevron-left" /></button>
            <label className="relative flex min-w-0 items-center gap-1.5 px-1.5 sm:px-2">
              <i className="bi bi-calendar3 text-[11px]" style={{ color: "var(--ftk-cyan)" }} />
              <span className="hidden max-w-[170px] truncate text-[10.5px] font-bold sm:block" style={{ color: "var(--ftk-ink-dim)" }}>{date === today ? "Today" : summaryDateShortLabel(date)}</span>
              <i className="bi bi-chevron-down hidden text-[9px] sm:block" style={{ color: "var(--ftk-ink-faint)" }} />
              <input type="date" value={date} max={today} onChange={e => e.target.value && setDate(e.target.value)} onClick={openDatePicker} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Choose report date" />
            </label>
            <button type="button" onClick={() => setDate(shiftSummaryDate(date, 1))} disabled={date >= today} className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[11px] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30" style={{ color: "var(--ftk-ink-dim)" }} aria-label="Next day"><i className="bi bi-chevron-right" /></button>
          </div>
          {date !== today && <button type="button" onClick={() => setDate(today)} className="hidden rounded-[12px] px-3 py-2 text-[10px] font-extrabold sm:block" style={{ background: "var(--brand-primary)", color: "white" }}>Today</button>}
          <button type="button" onClick={() => window.print()} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--ftk-card)", border: "1px solid var(--ftk-card-border)", color: "var(--ftk-ink-dim)" }} aria-label="Print summary"><i className="bi bi-printer" /></button>
          <button type="button" onClick={handleShare} className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] sm:flex" style={{ background: "var(--ftk-card)", border: "1px solid var(--ftk-card-border)", color: "var(--ftk-ink-dim)" }} aria-label="Share summary"><i className="bi bi-share" /></button>
        </div>
      </div>

      <div className="mso-ops-page print-release relative z-10 mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-5 lg:px-6">
        <PrintHeader
          title="Daily Summary"
          subtitle={
            report
              ? summaryDateLabel(date)
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

        {status === "idle" && (
          <div className="ftk-glass flex flex-col items-center gap-2 rounded-[20px] py-16 text-center">
            <i className="bi bi-cloud-slash text-3xl" style={{ color: "var(--ftk-ink-faint)" }} />
            <div className="text-[14px] font-bold" style={{ color: "var(--ftk-ink)" }}>Summary service is not configured</div>
            <div className="max-w-[300px] text-[12.5px]" style={{ color: "var(--ftk-ink-faint)" }}>VITE_SCRIPT_URL is missing from the active environment. The application can load, but this report cannot request its daily data.</div>
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
          const payments = [
            ["Cash", Number(report.cash) || 0, "bi-cash-stack", "green"],
            ["POS · Moniepoint", Number(report.pos_mp) || 0, "bi-credit-card-2-front", "cyan"],
            ["POS · ZM", Number(report.pos_zm) || 0, "bi-credit-card", "violet"],
            ["Transfer", Number(report.trf_mp) || 0, "bi-bank", "navy"],
          ]
          const paymentTotal = payments.reduce((sum, [, value]) => sum + value, 0)
          const excessItems = report.excess_items || []
          const excessTotal = excessItems.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
          const expenses = Number(report.total_expenses) || 0
          const bank = Number(report.to_bank) || 0
          const variance = recon?.hasData ? recon.variance : null
          const varianceTone = variance === null ? "neutral" : Math.abs(variance) < 1 ? "good" : variance < 0 ? "danger" : "good"
          const varianceLabel = variance === null ? "Pending" : Math.abs(variance) < 1 ? "Balanced" : variance < 0 ? "Shortage" : "Surplus"
          const varianceValue = variance === null ? "—" : naira(Math.abs(variance))
          const tankData = tankRows(report, marginByTank)
          const pumpData = pumpRows(report)
          const maxTankDiff = Math.max(...tankData.map(t => Number(t.diff) || 0), 1)
          const maxPumpLitres = Math.max(...pumpData.map(p => Number(p.diff) || 0), 1)
          const attention = []
          if (variance !== null && variance < -1) attention.push({ icon: "bi-exclamation-triangle-fill", title: `Cash shortage ${naira(Math.abs(variance))}`, detail: "Collected value is below live fuel sales. Review reconciliation before closing the day.", tone: "danger" })
          if (report.cashup_status && report.cashup_status !== "APPROVED") attention.push({ icon: "bi-shield-exclamation", title: "Cash reconciliation not approved", detail: `Current status: ${report.cashup_status}. Complete the approval workflow.`, tone: "warning" })
          if (dischargeToday.length) attention.push({ icon: "bi-truck", title: `${dischargeToday.length} delivery${dischargeToday.length > 1 ? "ies" : "y"} received`, detail: "Tank openings were affected by a delivery. Review the receiving trail below.", tone: "good" })
          if (!hasFuelData) attention.push({ icon: "bi-fuel-pump", title: "Fuel sales readings incomplete", detail: "No live pump session data was found for this date.", tone: "warning" })
          if (!attention.length) attention.push({ icon: "bi-check2-circle", title: "No critical exceptions", detail: "The available daily figures are internally consistent.", tone: "good" })

          const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          return (
            <>
              <div className="print-screen">
              <div className="mb-5 overflow-hidden rounded-[26px] text-white" style={{ background: `linear-gradient(135deg, ${getStation(station).theme.primaryDark} 0%, ${getStation(station).theme.primary} 100%)`, boxShadow: `0 18px 50px ${getStation(station).theme.primary}2E` }}>
                <div className="relative p-5 sm:p-6 lg:p-7">
                  <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl" style={{ background: `${getStation(station).theme.accent}22` }} />
                  <div className="pointer-events-none absolute bottom-0 right-1/3 h-32 w-32 rounded-full blur-3xl" style={{ background: `${getStation(station).theme.accent}1A` }} />
                  <div className={`${canSeeMarginAmount ? "lg:grid-cols-[minmax(0,1.45fr)_minmax(250px,0.55fr)]" : ""} relative grid gap-6 lg:items-stretch`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[1px] text-white/70">Daily operations</span>
                        <span className="text-[10px] font-medium text-white/50">{dateLabel}</span>
                      </div>
                      <div className="mt-5 text-[10px] font-extrabold uppercase tracking-[1px] text-white/50">Fuel sales</div>
                      <div className="ftk-mono mt-1 break-words text-[24px] font-black tracking-[-1px] sm:text-[36px] lg:text-[42px]">{naira(displayGrandTotal)}</div>
                      <div className="mt-1 text-[11px] text-white/55">Live PMS + AGO revenue from pump sessions</div>
                      <div className="mt-5 grid max-w-[520px] grid-cols-2 gap-2 sm:gap-3">
                        <div className="rounded-[15px] border border-white/10 bg-white/[0.07] p-3 sm:p-3.5">
                          <div className="text-[9px] font-bold uppercase tracking-[0.7px] text-white/45">PMS</div>
                          <div className="ftk-mono mt-1 text-[16px] font-black sm:text-[18px]">{litres(pmsLitres, { maximumFractionDigits: 2 })}</div>
                          <div className="mt-0.5 text-[9.5px] text-white/45">{naira(pmsRevenue)}</div>
                        </div>
                        <div className="rounded-[15px] border border-white/10 bg-white/[0.07] p-3 sm:p-3.5">
                          <div className="text-[9px] font-bold uppercase tracking-[0.7px] text-white/45">AGO</div>
                          <div className="ftk-mono mt-1 text-[16px] font-black sm:text-[18px]">{litres(agoLitres, { maximumFractionDigits: 2 })}</div>
                          <div className="mt-0.5 text-[9.5px] text-white/45">{naira(agoRevenue)}</div>
                        </div>
                      </div>
                    </div>
                    {canSeeMarginAmount && (
                      <div className="flex min-w-0 flex-col justify-between rounded-[20px] border border-white/10 bg-white/[0.07] p-4 sm:p-5">
                        <div>
                          <div className="text-[9px] font-extrabold uppercase tracking-[1px] text-white/45">Day margin</div>
                          <div className="mt-2 ftk-mono break-words text-[20px] font-black tracking-[-0.5px] sm:text-[26px]">{naira(livePmsMarginAmount + liveAgoMarginAmount)}</div>
                          <div className="mt-1 text-[10.5px] text-white/50">Margin value for {date === today ? "today" : summaryDateShortLabel(date)}</div>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <div className="rounded-[13px] bg-black/10 px-3 py-2.5">
                            <div className="text-[8.5px] font-bold uppercase tracking-[0.7px] text-white/40">Margin litres</div>
                            <div className="ftk-mono mt-1 text-[14px] font-black">{litres(livePmsMargin + liveAgoMargin, { maximumFractionDigits: 2 })}</div>
                          </div>
                          <div className="rounded-[13px] bg-black/10 px-3 py-2.5">
                            <div className="text-[8.5px] font-bold uppercase tracking-[0.7px] text-white/40">Margin sales</div>
                            <div className="ftk-mono mt-1 text-[14px] font-black">{displayGrandTotal > 0 ? `${((livePmsMarginAmount + liveAgoMarginAmount) / displayGrandTotal * 100).toFixed(1)}%` : "—"}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryMetric icon="bi-wallet2" label="Collected" value={naira(paymentTotal)} sub="Cash + POS + transfer" tone="green" />
                <SummaryMetric icon="bi-bank" label="Cash to bank" value={naira(bank)} sub={bank > 0 ? "Reported deposit" : "No deposit recorded"} tone="cyan" />
                <SummaryMetric icon="bi-receipt" label="Expenses" value={naira(expenses)} sub={`${report.expense_items?.length || 0} item${(report.expense_items?.length || 0) === 1 ? "" : "s"}`} tone="amber" />
                <SummaryMetric icon="bi-fuel-pump" label="Fuel volume" value={`${litres(pmsLitres + agoLitres, { maximumFractionDigits: 2 })}`} sub="PMS + AGO litres" tone="navy" />
              </div>

              <div className="mb-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                <SummarySection title="Sales performance" eyebrow="Product mix" action={<span className="text-[10px] font-semibold text-slate-400">Live pump data</span>}>
                  <div className="space-y-5">
                    {[{ key: "PMS", litres: pmsLitres, revenue: pmsRevenue, price: report.pms_price, margin: livePmsMargin, marginAmt: livePmsMarginAmount, tiers: report.priceTiers?.PMS, tone: "cyan" }, { key: "AGO", litres: agoLitres, revenue: agoRevenue, price: report.ago_price, margin: liveAgoMargin, marginAmt: liveAgoMarginAmount, tiers: report.priceTiers?.AGO, tone: "violet" }].map(f => (
                      <div key={f.key}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[11px] font-black" style={{ background: f.key === "PMS" ? `${getStation(station).theme.accent}22` : "#EDE9FE", color: f.key === "PMS" ? getStation(station).theme.accentDark : "#6D28D9" }}>{f.key}</span><div><div className="text-[12px] font-black text-slate-800">{f.key === "PMS" ? "Premium Motor Spirit" : "Automotive Gas Oil"}</div><div className="text-[9.5px] text-slate-400">{f.tiers?.length > 1 ? "Multiple prices" : f.price > 0 ? `${naira(f.price)}/L` : "Price not recorded"}</div></div></div>
                          <div className="text-right"><div className="ftk-mono text-[14px] font-black text-slate-900">{naira(f.revenue)}</div><div className="text-[9.5px] text-slate-400">{litres(f.litres, { maximumFractionDigits: 2 })}</div></div>
                        </div>
                        <div className="mt-3"><MiniBar value={f.revenue} max={Math.max(pmsRevenue, agoRevenue, 1)} tone={f.tone} /></div>
                        <div className="mt-2 flex items-center justify-between text-[9.5px] text-slate-400"><span>Margin volume: <b className="text-slate-600">{litres(f.margin, { maximumFractionDigits: 2 })}</b></span>{canSeeMarginAmount && <span>Margin value: <b className="text-slate-600">{naira(f.marginAmt)}</b></span>}</div>
                        <PriceBands tiers={f.tiers} />
                      </div>
                    ))}
                  </div>
                </SummarySection>

                <SummarySection title="Collection mix" eyebrow="How today's money came in">
                  <div className="space-y-3">
                    {payments.map(([label, value, icon, tone]) => (
                      <div key={label}>
                        <div className="mb-1.5 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[11px] font-bold text-slate-600"><i className={`bi ${icon}`} />{label}</div><span className="ftk-mono text-[11px] font-black text-slate-800">{naira(value)}</span></div>
                        <MiniBar value={value} max={Math.max(paymentTotal, 1)} tone={tone === "green" ? "green" : tone === "violet" ? "violet" : tone === "amber" ? "amber" : "cyan"} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between rounded-[15px] bg-slate-50 px-3.5 py-3"><span className="text-[10px] font-extrabold uppercase tracking-[0.6px] text-slate-400">Total collected</span><span className="ftk-mono text-[15px] font-black text-slate-900">{naira(paymentTotal)}</span></div>
                  {report.pos_proof_file_id && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 print:hidden">
                      <ProofPhotoViewer label="Moniepoint proof" fileId={report.pos_proof_file_id} />
                    </div>
                  )}
                </SummarySection>
              </div>

              <div className="mb-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <SummarySection title="Stock movement" eyebrow="Tank dip overview" action={<span className="text-[10px] text-slate-400">Opening → closing</span>}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px]">
                      <thead><tr className="border-b border-slate-100 text-left text-[9px] font-extrabold uppercase tracking-[0.6px] text-slate-400"><th className="pb-2">Tank</th><th className="pb-2">Product</th><th className="pb-2">Opening</th><th className="pb-2">Closing</th><th className="pb-2">Sold</th><th className="pb-2 text-right">Margin</th></tr></thead>
                      <tbody>{tankData.map(t => <tr key={t.id} className="border-b border-slate-50 last:border-0"><td className="py-2.5 text-[11px] font-black text-slate-800">{t.id}</td><td className="py-2.5 text-[10.5px] text-slate-500">{t.product}</td><td className="ftk-mono py-2.5 text-[10.5px] text-slate-600">{numberNG(t.opening, { maximumFractionDigits: 2 })}{t.unit || "L"}</td><td className="ftk-mono py-2.5 text-[10.5px] text-slate-600">{numberNG(t.closing, { maximumFractionDigits: 2 })}{t.unit || "L"}</td><td className="py-2.5"><div className="flex items-center gap-2"><div className="w-16"><MiniBar value={Number(t.diff) || 0} max={maxTankDiff} tone={t.product === "AGO" ? "violet" : "cyan"} /></div><span className="ftk-mono text-[10.5px] font-bold text-slate-700">{numberNG(t.diff, { maximumFractionDigits: 2 })}{t.unit || "L"}</span></div></td><td className="ftk-mono py-2.5 text-right text-[10.5px] font-black text-slate-700">{numberNG(t.margin, { maximumFractionDigits: 2 })}{t.unit || "L"}</td></tr>)}</tbody>
                    </table>
                  </div>
                  {dischargeToday.length > 0 && <div className="mt-4 rounded-[15px] border border-emerald-100 bg-emerald-50/70 p-3"><div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.7px] text-emerald-700"><i className="bi bi-truck" /> Deliveries received today</div>{dischargeToday.map((d, i) => <div key={i} className="flex items-center justify-between gap-3 border-t border-emerald-100 py-2 text-[10.5px] text-emerald-800 first:border-0"><span className="font-bold">{d["Product"] || "Fuel delivery"}</span><span className="ftk-mono font-black">{numberNG(Number(d["Actual Received"]) || 0)} L</span></div>)}</div>}
                </SummarySection>

                <SummarySection title="What needs attention" eyebrow="Manager view">
                  <div className="space-y-2.5">{attention.slice(0, 4).map((item, i) => <ExceptionRow key={i} {...item} />)}</div>
                </SummarySection>
              </div>

              {pumpData.length > 0 && <>
                <SummarySection
                  title="Sales by pump"
                  eyebrow="Fuel performance"
                  action={pumpData.length > 3 ? (
                    <button type="button" onClick={() => setShowAllPumpData(v => !v)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-extrabold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50">
                      {showAllPumpData ? "Show less" : `View all · ${pumpData.length}`}
                    </button>
                  ) : null}
                  className="mb-4"
                >
                  <div className="space-y-1">
                    {pumpData.map((p, i) => {
                      const fuel = /AGO|DIESEL/i.test(p.pump) ? "AGO" : /LPG|GAS/i.test(p.pump) ? "LPG" : "PMS"
                      const active = Number(p.sessionCount) > 0 || Number(p.diff) > 0
                      return (
                        <div key={p.pump} className={`${!showAllPumpData && i >= 3 ? "hidden" : ""} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-[13px] px-2.5 py-2.5 transition hover:bg-slate-50 sm:grid-cols-[72px_minmax(0,1fr)_110px_118px]`}>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} aria-label={active ? "Active" : "Offline"} title={active ? "Active" : "Offline"} />
                            <span className="text-[11px] font-black text-slate-800">{p.pump}</span>
                          </div>
                          <div className="min-w-0 sm:col-auto">
                            <div className="text-[9px] font-extrabold uppercase tracking-[0.65px] text-slate-400">{fuel}</div>
                            <div className="truncate text-[10px] text-slate-500">{p.sessionCount || 0} session{p.sessionCount === 1 ? "" : "s"}</div>
                          </div>
                          <div className="text-right sm:col-auto">
                            <div className="ftk-mono text-[11px] font-black text-slate-800">{litres(p.diff, { maximumFractionDigits: 2 })}</div>
                            <div className="text-[8.5px] text-slate-400">volume</div>
                          </div>
                          <div className="text-right sm:col-auto">
                            <div className="ftk-mono text-[11px] font-black text-slate-900">{p.amount > 0 ? naira(p.amount) : "—"}</div>
                            <div className="text-[8.5px] text-slate-400">sales</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </SummarySection>

                <SummarySection
                  title="Pump activity"
                  eyebrow="Latest station activity"
                  action={pumpData.length > 3 ? <button type="button" onClick={() => setShowAllActivity(v => !v)} className="text-[10px] font-extrabold text-slate-500 hover:text-slate-800">{showAllActivity ? "Show less" : "View all"}</button> : null}
                  className="mb-5"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {pumpData.map((p, i) => {
                      const fuel = /AGO|DIESEL/i.test(p.pump) ? "AGO" : /LPG|GAS/i.test(p.pump) ? "LPG" : "PMS"
                      const active = Number(p.sessionCount) > 0 || Number(p.diff) > 0
                      const activity = active ? `${p.pump} recorded ${litres(p.diff, { maximumFractionDigits: 2 })}L` : `${p.pump} has no recorded activity`
                      return (
                        <div key={`activity-${p.pump}`} className={`${!showAllActivity && i >= 3 ? "hidden" : ""} flex min-w-0 items-center gap-3 rounded-[14px] border border-slate-100 bg-slate-50/60 px-3 py-2.5`}>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[9px] font-black ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{p.pump.replace(/[^0-9]/g, "") || "—"}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[10.5px] font-black text-slate-800">{fuel} · {active ? "Sale recorded" : "No activity"}</span>
                              <span className="shrink-0 text-[8.5px] font-semibold text-slate-400">Today</span>
                            </div>
                            <div className="mt-0.5 truncate text-[9.5px] text-slate-500">{activity}</div>
                          </div>
                          <span className="ftk-mono shrink-0 text-[10.5px] font-black text-slate-800">{p.amount > 0 ? naira(p.amount) : "—"}</span>
                        </div>
                      )
                    })}
                  </div>
                </SummarySection>
              </>}

              <div className="mb-5 grid gap-4 lg:grid-cols-3">
                <SummarySection title="Cash movement" eyebrow="End-of-day position"><div className="space-y-2.5"><Row label="Collected" value={naira(paymentTotal)} /><Row label="Expenses" value={`−${naira(expenses)}`} tone="amber" /><Row label="POS charges" value={`−${naira((report.pos_mp_charge || 0) + (report.pos_zm_charge || 0))}`} /><div className="border-t border-slate-100 pt-3"><Row label="Cash to bank" value={naira(bank)} bold tone="green" /></div>
                  {excessItems.length > 0 && (
                    <div className="border-t border-slate-100 pt-3">
                      <Row label="Excess" value={`+${naira(excessTotal)}`} tone="green" sub="Extra cash found — counts toward Cash At Hand" />
                      <div className="ml-2 mt-2 space-y-1 border-l-2 border-green-200 pl-3">
                        {excessItems.map((e, i) => (
                          <div key={i} className="flex items-start justify-between gap-3 text-[10.5px] text-slate-500">
                            <span className="min-w-0 flex-1 break-words">{e.description || "Excess"}</span>
                            <span className="ftk-mono flex-shrink-0 font-semibold text-green-600">+{naira(Number(e.amount) || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div></SummarySection>
                <SummarySection title="Other sales" eyebrow="Non-fuel operations"><div className="space-y-2.5"><Row label="Lubricant" value={naira(report.lubricant_rev)} sub={`${report.lubricantItems?.length || 0} line items`} /><Row label="LPG" value={naira(report.lpg_revenue)} sub={report.lpg_kg ? `${numberNG(report.lpg_kg)} kg` : "No LPG recorded"} /><Row label="EMTL" value={naira(report.emtl_amount)} /></div></SummarySection>
                <SummarySection title="Sales cash summary" eyebrow="Submitted allocation"><div className="space-y-2.5">{[["PMS", report.pms_cash_summary], ["AGO", report.ago_cash_summary], ["OIL", report.oil_cash_summary], ["GAS", report.gas_cash_summary]].map(([k,v]) => <Row key={k} label={k} value={naira(v)} />)}<div className="border-t border-slate-100 pt-3"><Row label="Total" value={naira(report.total_cash_summary)} bold tone="cyan" /></div></div></SummarySection>
              </div>

              {report.remarks && <SummarySection title="Manager notes" eyebrow="Daily remarks" className="mb-5"><div className="rounded-[15px] border border-amber-100 bg-amber-50/60 p-3.5 text-[11.5px] leading-relaxed text-slate-700 whitespace-pre-wrap">{report.remarks}</div></SummarySection>}

              {photos.length > 0 && <SummarySection title={`Proof & station photos (${photos.length})`} eyebrow="Supporting evidence" className="mb-5"><div className="print:hidden">{["Morning", "Evening"].map(session => { const group = photos.filter(p => p.session === session); if (!group.length) return null; return <div key={session} className="mb-3 last:mb-0"><div className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.7px] text-slate-400">{session}</div><div className="flex flex-wrap gap-2">{group.map((p,i) => <PhotoThumb key={i} fileId={p.fileId} onClick={() => setLightboxPhoto(p)} />)}</div></div> })}</div></SummarySection>}

              <SummarySection title="Day health" eyebrow="Close-out status" className="mb-5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[21px] font-black tracking-tight text-slate-900">{varianceLabel}</div>
                      <SummaryStatus label={varianceLabel} tone={varianceTone} />
                    </div>
                    <div className="mt-1 text-[10.5px] text-slate-400">{variance === null ? "Awaiting reconciliation" : variance < 0 ? "Collected below fuel sales" : variance > 0 ? "Collected above fuel sales" : "Collected matches fuel sales"}</div>
                  </div>
                  <div className="min-w-[220px] rounded-[15px] bg-slate-50 p-3.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400"><span>Variance</span><span className="ftk-mono font-black text-slate-700">{varianceValue}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full" style={{ width: variance === null ? "25%" : `${Math.min(100, Math.max(7, Math.abs(variance) / Math.max(1, paymentTotal) * 100))}%`, background: varianceTone === "danger" ? "#DC2626" : "#16A34A" }} /></div>
                  </div>
                  <div className="flex items-center justify-between rounded-[15px] border border-slate-100 px-3.5 py-3 sm:col-span-2">
                    <span className="text-[10.5px] font-semibold text-slate-400">Cash-up</span>
                    <SummaryStatus label={report.cashup_status === "APPROVED" ? "Approved" : report.cashup_status || "Not submitted"} tone={report.cashup_status === "APPROVED" ? "good" : report.cashup_status === "REJECTED" ? "danger" : "warning"} />
                  </div>
                </div>
              </SummarySection>

              <div className="mb-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3.5 text-[10.5px] text-slate-500"><div className="flex flex-wrap items-center justify-between gap-2"><span>Submitted by <b className="text-slate-700">{report.submitted_by || "—"}</b></span><span>Report date <b className="text-slate-700">{dateLabel}</b></span></div></div>

              </div>
              <DailySummaryPrint
                report={report}
                date={date}
                canSeeMarginAmount={canSeeMarginAmount}
                station={station}
                dateLabel={dateLabel}
                displayGrandTotal={displayGrandTotal}
                pmsLitres={pmsLitres}
                agoLitres={agoLitres}
                pmsRevenue={pmsRevenue}
                agoRevenue={agoRevenue}
                livePmsMargin={livePmsMargin}
                liveAgoMargin={liveAgoMargin}
                livePmsMarginAmount={livePmsMarginAmount}
                liveAgoMarginAmount={liveAgoMarginAmount}
                tankData={tankData}
                paymentTotal={paymentTotal}
                expenses={expenses}
                bank={bank}
                variance={variance}
                varianceLabel={varianceLabel}
                varianceValue={varianceValue}
                attention={attention}
              />
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
  return (
    <SummaryErrorBoundary>
      <SummaryInner />
    </SummaryErrorBoundary>
  )
}
