import React, { useState } from "react"
import ProofPhotoViewer from "../components/cashup/ProofPhotoViewer"
import Sidebar from "../components/layout/Sidebar"
import Topbar from "../components/layout/Topbar"
import BottomNav from "../components/layout/BottomNav"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useRecordsData } from "../hooks/useRecordsData"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, numberNG, initials, roleLabel, litres } from "../utils/format"
/* Tanks and pumps are per-station now — M&M has no TK3, and its pumps map
   to different tanks. Reading a shared config that assumed MSO's layout would
   have collected dips for a tank that does not exist. */
import { tanksFor, pumpsFor, getStation } from "../config/stations"
import { activeStation } from "../utils/station"
/* The station comes from the signed-in user's session, not a build-time env
   var — one deployment serves both MSO and M&M. */

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

// pumpId() is the human-facing display label (two different pumps can
// legitimately share this, e.g. "P1" on Tank 2/PMS and "P1" on Tank
// 4/AGO). stateKey() is what's actually unique and what the backend
// stores PumpMetres rows under — always use this for lookups.
function pumpId(p) {
  return p.pumpId || p.id
}

function stateKey(p) {
  return p.id
}

function TankMarginRow({ tank, report }) {
  const open = report[`${tank.id.toLowerCase()}_opening`] || 0
  const close = report[`${tank.id.toLowerCase()}_closing`] || 0
  const dipDiff = report[`${tank.id.toLowerCase()}_diff`] || 0
  const margin = report[`${tank.id.toLowerCase()}_margin`] || 0
  const empty = open === 0 && close === 0

  return (
    <tr className={`border-b border-surface last:border-none ${empty ? "" : "hover:bg-[#FAFBFE]"}`}>
      <td className="px-3.5 py-2.5">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-[3px] text-[10.5px] font-bold ${
            tank.product === "AGO" ? "border-amber/25 bg-amber-light text-amber" : "border-cyan/20 bg-cyan-light text-cyan-dark"
          }`}
        >
          {tank.id}
        </span>
      </td>
      <td className={`mono px-3.5 py-2.5 font-semibold ${empty ? "text-ink-4" : ""}`}>{litres(open)}</td>
      <td className={`mono px-3.5 py-2.5 ${empty ? "text-ink-4" : ""}`}>{litres(close)}</td>
      <td className={`mono px-3.5 py-2.5 font-bold ${empty ? "text-ink-4" : "text-cyan-dark"}`}>{litres(dipDiff, { maximumFractionDigits: 2 })}</td>
      <td className={`mono px-3.5 py-2.5 font-bold ${empty ? "text-ink-4" : margin < 0 ? "text-red" : "text-amber"}`}>
        {Number(margin).toFixed(2)}L
      </td>
    </tr>
  )
}

function PumpMetreRow({ pump, pumpMetres }) {
  const key = stateKey(pump)
  const session = pumpMetres && pumpMetres[key] && pumpMetres[key].sessions && pumpMetres[key].sessions[0]
  const open = session ? session.open : 0
  const close = session ? session.close : 0
  const diff = session ? session.diff : 0
  const amount = session ? session.amount : 0
  const empty = !session || (open === 0 && close === 0)

  return (
    <tr className={`border-b border-surface last:border-none ${empty ? "" : "hover:bg-[#FAFBFE]"}`}>
      <td className="px-3.5 py-2.5">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-[3px] text-[10.5px] font-bold ${
            pump.product === "AGO" ? "border-amber/25 bg-amber-light text-amber" : "border-cyan/20 bg-cyan-light text-cyan-dark"
          }`}
        >
          {pumpId(pump)}
        </span>
      </td>
      <td className="px-3.5 py-2.5 text-[11.5px] text-ink-3">{pump.tank}</td>
      <td className={`mono px-3.5 py-2.5 ${empty ? "text-ink-4" : ""}`}>{litres(open)}</td>
      <td className={`mono px-3.5 py-2.5 ${empty ? "text-ink-4" : ""}`}>{litres(close)}</td>
      <td className={`mono px-3.5 py-2.5 font-bold ${empty ? "text-ink-4" : "text-cyan-dark"}`}>{litres(diff, { maximumFractionDigits: 2 })}</td>
      <td className={`mono px-3.5 py-2.5 font-bold ${empty ? "text-ink-4" : "text-green"}`}>{empty ? "—" : naira(amount)}</td>
    </tr>
  )
}

function RecordsInner() {
  const auth = useAuth({ requireAuth: true })
  const [date, setDate] = useState(todayISO())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { status, report, refresh, error } = useRecordsData(auth.username, date)

  const [exportOpen, setExportOpen] = useState(false)
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date()
    d.setDate(1) // first of this month, a sensible default range
    return d.toISOString().split("T")[0]
  })
  const [exportTo, setExportTo] = useState(todayISO())
  const [exporting, setExporting] = useState(false)

  usePageTitle(`Records — ${getStation(activeStation()).name}`)

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "getRecords")
      url.searchParams.set("station", activeStation())
      url.searchParams.set("from", exportFrom)
      url.searchParams.set("to", exportTo)
      url.searchParams.set("limit", "366") // covers any range up to a full year
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
      const rows = (res.ok ? res.records : []) || []

      if (rows.length === 0) {
        alert("No records found in that date range.")
        setExporting(false)
        return
      }

      const headers = ["Date", "Day", "Submitted By", "Grand Total", "PMS Litres", "PMS Revenue", "AGO Litres", "AGO Revenue", "Cash to Bank", "Expenses", "Status"]
      const csvEscape = v => {
        const s = String(v ?? "")
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const lines = [headers.map(csvEscape).join(",")]
      rows.forEach(r => {
        lines.push([
          r.date, r.day, r.submittedBy, r.grandTotal, r.pmsLitres, r.pmsRevenue,
          r.agoLitres, r.agoRevenue, r.cashToBank, r.expenses, r.status,
        ].map(csvEscape).join(","))
      })
      // BOM prefix so Excel opens ₦/UTF-8 characters correctly instead of
      // guessing the wrong encoding and mangling them.
      const csvContent = "\uFEFF" + lines.join("\r\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `MSO_Records_${exportFrom}_to_${exportTo}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
      setExportOpen(false)
    } catch {
      alert("Export failed — check your connection and try again.")
    } finally {
      setExporting(false)
    }
  }

  let dipDiffTotal = 0
  let pumpDiffTotal = 0
  let hasAnyPumpData = false
  let pmsPumpLitres = 0
  let agoPumpLitres = 0
  if (report) {
    tanksFor(activeStation()).forEach(t => {
      dipDiffTotal += report[`${t.id.toLowerCase()}_diff`] || 0
    })
    pumpsFor(activeStation()).forEach(p => {
      const key = stateKey(p)
      const session = report.pumpMetres && report.pumpMetres[key] && report.pumpMetres[key].sessions && report.pumpMetres[key].sessions[0]
      if (session) {
        pumpDiffTotal += session.diff || 0
        if (session.open > 0 || session.close > 0) hasAnyPumpData = true
        if (p.product === "AGO") agoPumpLitres += session.diff || 0
        else pmsPumpLitres += session.diff || 0
      }
    })
  }
  const computedMargin = dipDiffTotal - pumpDiffTotal

  // Expected revenue: litres actually dispensed (from pump metres) ×
  // the day's price — this is the figure cashier reconciliation should
  // match against, separate from the dip-vs-pump margin (which is a
  // stock/theft check, not a money check). Falls back to the report's
  // own pms_litres/ago_litres (averaged tank figures from saveDailyReport)
  // if pump-specific data isn't available yet for this date.
  const pmsLitresForRevenue = hasAnyPumpData ? pmsPumpLitres : (report && report.pms_litres) || 0
  const agoLitresForRevenue = hasAnyPumpData ? agoPumpLitres : (report && report.ago_litres) || 0
  const pmsExpected = report ? pmsLitresForRevenue * (report.pms_price || 0) : 0
  const agoExpected = report ? agoLitresForRevenue * (report.ago_price || 0) : 0
  const expectedRevenue = pmsExpected + agoExpected

  /* Money collected must include EVERY way a customer pays for fuel: cash, POS
     (both terminals), AND bank transfers. Transfers were previously omitted,
     which made the variance meaningless — on a transfer-heavy day like M&M's it
     showed a huge false shortage/surplus even when the day actually balanced. */
  const actualCollected = report
    ? (report.pos_mp || 0) + (report.pos_zm || 0) + (report.cash || 0)
      + (report.trf_mp || 0) + (report.trf_zb || 0)
    : 0
  const reconciliationVariance = actualCollected - expectedRevenue

  const expenseItems = (report && report.expense_items) || []
  const expenseTotal = expenseItems.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  return (
    <div className="flex min-h-screen">
      <SafeAreaDebug />

      <Sidebar
        isOwner={auth.isOwner}
        isGM={auth.isGM}
        name={auth.name || auth.username}
        role={roleLabel(auth.role)}
        avatarInitials={initials(auth.name || auth.username)}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={auth.logout}
        homePath={dashboardPathFor({ role: auth.role, station: auth.station })}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:ml-sidebar">
        <Topbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          loading={status === "loading"}
          onRefresh={refresh}
          title="Records"
        />

        <div className="flex-1 p-3.5 pb-[100px] md:p-[22px] md:pb-[22px]">
          <div className="mx-auto max-w-[900px]">
            <div className="mb-5 flex items-center gap-3 rounded-card border border-cyan/15 bg-white px-3.5 py-3 shadow-card">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: "var(--brand-gradient-btn)" }}>
                <i className="bi bi-calendar3 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-[9px] font-bold uppercase tracking-[1px] text-cyan-dark">Viewing Records For · tap to change</div>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  max={todayISO()}
                  className="w-full cursor-pointer border-none bg-transparent p-0 text-[14.5px] font-bold text-ink outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setExportOpen(o => !o)}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-[9px] border border-border bg-surface px-3 py-2 text-[11.5px] font-bold text-ink-2"
              >
                <i className="bi bi-download" /> Export
              </button>
            </div>

            {exportOpen && (
              <div className="mb-5 rounded-card border border-border bg-white p-4 shadow-card">
                <div className="mb-3 text-[12px] font-extrabold text-ink">Export records to CSV</div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-[0.6px] text-ink-4">From</span>
                    <input type="date" value={exportFrom} max={exportTo} onChange={e => setExportFrom(e.target.value)}
                      className="w-full rounded-[9px] border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-cyan [color-scheme:light]" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-[0.6px] text-ink-4">To</span>
                    <input type="date" value={exportTo} min={exportFrom} max={todayISO()} onChange={e => setExportTo(e.target.value)}
                      className="w-full rounded-[9px] border border-border bg-surface px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-cyan [color-scheme:light]" />
                  </label>
                </div>
                <div className="mb-3 text-[11px] text-ink-4">Opens in Excel/Google Sheets — Date, Grand Total, PMS/AGO litres & revenue, Cash to Bank, Expenses, Status per day.</div>
                <button
                  type="button" onClick={handleExport} disabled={exporting}
                  className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-navy py-2.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                >
                  {exporting ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> : <i className="bi bi-file-earmark-spreadsheet" />}
                  {exporting ? "Preparing…" : "Download CSV"}
                </button>
              </div>
            )}

            {status === "loading" && (
              <div className="flex items-center justify-center py-16 text-[13px] text-ink-4">
                <span className="mr-2 h-4 w-4 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
                Loading records for {date}…
              </div>
            )}

            {status === "no-data" && (
              <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-white py-16 text-center shadow-card">
                <i className="bi bi-inbox text-3xl text-ink-4" />
                <div className="text-[14px] font-bold text-ink">No record found for {date}</div>
                <div className="max-w-[320px] text-[12.5px] text-ink-4">
                  No Dip or Pump submission exists for this date yet.{error ? ` (${error})` : ""}
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-2 rounded-card border border-red/20 bg-red-light py-16 text-center">
                <i className="bi bi-exclamation-triangle text-3xl text-red" />
                <div className="text-[14px] font-bold text-red">Could not load records</div>
                <div className="text-[12.5px] text-red/80">Check your connection and try again.</div>
              </div>
            )}

            {status === "ready" && report && (
              <>
                <div
                  className="mb-3 overflow-hidden rounded-card shadow-card"
                  style={{ background: "var(--brand-gradient-btn)" }}
                >
                  <div className="border-b border-white/10 px-[18px] py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[1.2px] text-white/60">Cash Reconciliation</div>
                    <div className="text-[11px] text-white/40">Expected revenue (pump litres × price) vs actual collected</div>
                  </div>
                  <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-3">
                    <div className="bg-[var(--brand-primary)] p-[18px]">
                      <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-white/50">Expected Revenue</div>
                      <div className="mono mt-1 text-[19px] font-extrabold text-white">{naira(expectedRevenue)}</div>
                      <div className="mt-1 text-[10px] text-white/40">
                        PMS {naira(pmsExpected)} + AGO {naira(agoExpected)}
                      </div>
                    </div>
                    <div className="bg-[var(--brand-primary)] p-[18px]">
                      <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-white/50">Actual Collected</div>
                      <div className="mono mt-1 text-[19px] font-extrabold text-white">{naira(actualCollected)}</div>
                      <div className="mt-1 text-[10px] text-white/40">POS + Cash, before charges</div>
                    </div>
                    <div className="bg-[var(--brand-primary)] p-[18px]">
                      <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-white/50">Variance</div>
                      <div
                        className="mono mt-1 text-[19px] font-extrabold"
                        style={{ color: !hasAnyPumpData ? "rgba(255,255,255,.4)" : Math.abs(reconciliationVariance) < 1 ? "#4ADE80" : reconciliationVariance < 0 ? "#F87171" : "#3BB8E8" }}
                      >
                        {hasAnyPumpData ? naira(reconciliationVariance) : "—"}
                      </div>
                      <div className="mt-1 text-[10px] text-white/40">
                        {reconciliationVariance < 0 ? "Shortage" : reconciliationVariance > 0 ? "Surplus" : "Balanced"}
                      </div>
                    </div>
                  </div>
                  {report.pos_proof_file_id && (
                    <div className="flex flex-wrap gap-2 border-t border-white/10 p-[18px]">
                      <ProofPhotoViewer label="Moniepoint proof" fileId={report.pos_proof_file_id} />
                    </div>
                  )}
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-card border border-border bg-white p-3.5 shadow-card">
                    <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Grand Total</div>
                    <div className="mono mt-1 text-[16px] font-extrabold text-ink">{naira(report.grand_total)}</div>
                  </div>
                  <div className="rounded-card border border-border bg-white p-3.5 shadow-card">
                    <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Dip vs Pump Margin</div>
                    <div className={`mono mt-1 text-[16px] font-extrabold ${!hasAnyPumpData ? "text-ink-4" : computedMargin < 0 ? "text-red" : "text-amber"}`}>
                      {hasAnyPumpData ? `${computedMargin.toFixed(2)}L` : "Awaiting Pump"}
                    </div>
                  </div>
                  <div className="rounded-card border border-border bg-white p-3.5 shadow-card">
                    <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Cash to Bank</div>
                    <div className="mono mt-1 text-[16px] font-extrabold text-ink">{naira(report.to_bank)}</div>
                  </div>
                  <div className="rounded-card border border-border bg-white p-3.5 shadow-card">
                    <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Expenses</div>
                    <div className="mono mt-1 text-[16px] font-extrabold text-red">{naira(report.total_expenses)}</div>
                  </div>
                </div>

                {!hasAnyPumpData && report.hasClosing && (
                  <div className="mb-5 flex items-center gap-2.5 rounded-card border border-amber/25 bg-amber-light px-4 py-3">
                    <i className="bi bi-info-circle text-amber" />
                    <div className="text-[12px] text-amber">
                      Dip readings are in but no Pump metre submission exists for this date yet — margin will show once Pump is submitted.
                    </div>
                  </div>
                )}

                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Tank Dip Readings</div>
                <div className="mb-5 overflow-hidden rounded-card border border-border bg-white shadow-card">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {["Tank", "Opening", "Closing", "Dip Diff", "Margin"].map(h => (
                            <th key={h} className="whitespace-nowrap border-b border-border bg-surface px-3.5 py-[9px] text-left text-[9.5px] font-bold uppercase tracking-[1px] text-ink-4">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tanksFor(activeStation()).map(t => (
                          <TankMarginRow key={t.id} tank={t} report={report} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Pump Metre Readings</div>
                <div className="mb-5 overflow-hidden rounded-card border border-border bg-white shadow-card">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {["Pump", "Tank", "Opening", "Closing", "Diff", "Revenue"].map(h => (
                            <th key={h} className="whitespace-nowrap border-b border-border bg-surface px-3.5 py-[9px] text-left text-[9.5px] font-bold uppercase tracking-[1px] text-ink-4">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pumpsFor(activeStation()).map(p => (
                          <PumpMetreRow key={stateKey(p)} pump={p} pumpMetres={report.pumpMetres} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Revenue by Product</div>
                <div className="mb-5 overflow-hidden rounded-card border border-border bg-white shadow-card">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {["Product", "Litres", "Price/L", "Revenue", "Dip vs Pump"].map(h => (
                            <th key={h} className="whitespace-nowrap border-b border-border bg-surface px-3.5 py-[9px] text-left text-[9.5px] font-bold uppercase tracking-[1px] text-ink-4">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-surface">
                          <td className="px-3.5 py-2.5">
                            <span className="inline-flex items-center rounded-full border border-cyan/20 bg-cyan-light px-2.5 py-[3px] text-[10.5px] font-bold text-cyan-dark">PMS</span>
                          </td>
                          <td className="mono px-3.5 py-2.5">{litres(report.pms_litres, { maximumFractionDigits: 2 })}</td>
                          <td className="mono px-3.5 py-2.5">{report.pms_price > 0 ? naira(report.pms_price) : <span className="text-ink-4">—</span>}</td>
                          <td className="mono px-3.5 py-2.5 font-bold text-green">{naira(report.pms_revenue)}</td>
                          <td className={`mono px-3.5 py-2.5 font-bold ${Math.abs(report.pms_margin) > 50 ? "text-red" : "text-ink-3"}`}>{Number(report.pms_margin).toFixed(2)}L</td>
                        </tr>
                        <PriceTierRows tiers={report.priceTiers?.PMS} tone="text-cyan-dark" />
                        <tr>
                          <td className="px-3.5 py-2.5">
                            <span className="inline-flex items-center rounded-full border border-amber/25 bg-amber-light px-2.5 py-[3px] text-[10.5px] font-bold text-amber">AGO</span>
                          </td>
                          <td className="mono px-3.5 py-2.5">{litres(report.ago_litres, { maximumFractionDigits: 2 })}</td>
                          <td className="mono px-3.5 py-2.5">{report.ago_price > 0 ? naira(report.ago_price) : <span className="text-ink-4">—</span>}</td>
                          <td className="mono px-3.5 py-2.5 font-bold text-green">{naira(report.ago_revenue)}</td>
                          <td className={`mono px-3.5 py-2.5 font-bold ${Math.abs(report.ago_margin) > 50 ? "text-red" : "text-ink-3"}`}>{Number(report.ago_margin).toFixed(2)}L</td>
                        </tr>
                        <PriceTierRows tiers={report.priceTiers?.AGO} tone="text-amber" />
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-surface bg-surface/40 px-3.5 py-2.5 text-[10px] leading-relaxed text-ink-4">
                    <strong className="text-ink-3">Dip vs Pump</strong> is a stock check in litres, not money — the gap between what the tank dip lost and what the pumps sold. Near zero is healthy; a large figure means fuel left the tank without a matching sale, and is worth investigating.
                    {(report.priceTiers?.PMS?.length > 1 || report.priceTiers?.AGO?.length > 1) && (
                      <>
                        {" "}<br />
                        <strong className="text-ink-3">Price/L</strong> is the weighted average for the day because the price changed — each band is listed beneath its product.
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
                    <div className="border-b border-surface px-[18px] py-3.5 text-[13.5px] font-extrabold text-ink">Payment Summary</div>
                    <div className="flex flex-col gap-2.5 p-[18px]">
                      {[
                        { label: "POS (MP Terminal)", value: report.pos_mp },
                        { label: "POS (ZM Terminal)", value: report.pos_zm },
                        { label: "Cash", value: report.cash },
                      ]
                        .filter(p => p.value > 0)
                        .map(p => (
                          <div key={p.label} className="flex items-center justify-between text-[12.5px]">
                            <span className="text-ink-2">{p.label}</span>
                            <span className="mono font-bold text-ink">{naira(p.value)}</span>
                          </div>
                        ))}
                      {report.pos_mp <= 0 && report.pos_zm <= 0 && report.cash <= 0 && (
                        <div className="py-2 text-center text-[12px] text-ink-4">No payment data for this date</div>
                      )}
                      {(report.pos_mp_charge > 0 || report.pos_zm_charge > 0) && (
                        <div className="mt-1 flex flex-col gap-1.5 rounded-[10px] bg-red-light px-3 py-2.5">
                          <div className="text-[9.5px] font-bold uppercase tracking-[0.6px] text-red">POS Charges Deducted</div>
                          {report.pos_mp_charge > 0 && (
                            <div className="flex items-center justify-between text-[11.5px]">
                              <span className="text-red/80">MP Terminal Charge</span>
                              <span className="mono font-semibold text-red">−{naira(report.pos_mp_charge)}</span>
                            </div>
                          )}
                          {report.pos_zm_charge > 0 && (
                            <div className="flex items-center justify-between text-[11.5px]">
                              <span className="text-red/80">ZM Terminal Charge</span>
                              <span className="mono font-semibold text-red">−{naira(report.pos_zm_charge)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5">
                        <span className="text-[11px] font-semibold text-ink-3">Cash to Bank (after charges)</span>
                        <span className="mono text-[14px] font-extrabold text-green">{naira(report.to_bank)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
                    <div className="flex items-center justify-between border-b border-surface px-[18px] py-3.5">
                      <span className="text-[13.5px] font-extrabold text-ink">Expenses</span>
                      <span className="mono text-[12px] font-bold text-red">{expenseItems.length ? naira(expenseTotal) : "—"}</span>
                    </div>
                    <div className="flex flex-col gap-2 p-[18px]">
                      {expenseItems.length === 0 ? (
                        <div className="py-2 text-center text-[12px] text-ink-4">No expenses logged for this date</div>
                      ) : (
                        expenseItems.map((e, i) => (
                          <div key={i} className="flex items-center justify-between text-[12.5px]">
                            <span className="text-ink-2">{e.description || "—"}</span>
                            <span className="mono font-bold text-ink">{naira(e.amount)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {report.submitted_by && (
                  <div className="mt-4 text-center text-[11px] text-ink-4">Submitted by {report.submitted_by}</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <BottomNav homePath={dashboardPathFor({ role: auth.role, station: auth.station })} />
    </div>
  )
}

/* When a price changes mid-day the single "Price/L" figure is a weighted
   average — true, but it hides that (say) 12,000L sold at ₦940 and 3,000L at
   ₦1,100. Those bands are the actual record, so they're listed underneath.
   Only rendered when there's more than one, since a normal day needs no
   breakdown. */
function PriceTierRows({ tiers, tone }) {
  if (!tiers || tiers.length < 2) return null
  return (
    <>
      {tiers.map((t, i) => (
        <tr key={i} className="border-b border-surface bg-surface/30">
          <td className="py-1.5 pl-7 pr-3.5">
            <span className="text-[10px] text-ink-4">
              <i className="bi bi-arrow-return-right mr-1 text-[8px] opacity-50" />
              Price {i + 1}
            </span>
          </td>
          <td className="mono px-3.5 py-1.5 text-[11px] text-ink-3">
            {litres(t.litres, { maximumFractionDigits: 2 })}
          </td>
          <td className={`mono px-3.5 py-1.5 text-[11px] font-semibold ${tone}`}>{naira(t.price)}</td>
          <td className="mono px-3.5 py-1.5 text-[11px] text-ink-3">{naira(t.amount)}</td>
          <td className="px-3.5 py-1.5" />
        </tr>
      ))}
    </>
  )
}

export default function RecordsPage() {
  return <RecordsInner />
}
