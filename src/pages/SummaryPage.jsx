import React, { useEffect, useState } from "react"
import { getStation } from "../config/stations"
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

function PhotoThumb({ fileId, onClick }) {
  const { dataUri, status } = useDriveImage(fileId)
  return (
    <button type="button" onClick={onClick} className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[10px] border border-border bg-surface">
      {dataUri ? (
        <img src={dataUri} alt="" className="h-full w-full object-cover" />
      ) : status === "error" ? (
        <i className="bi bi-image text-ink-4" />
      ) : (
        <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
      )}
    </button>
  )
}

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function tankRows(report) {
  return [
    { id: "TK 1", product: "PMS", opening: report.tk1_opening, closing: report.tk1_closing, diff: report.tk1_diff, margin: report.tk1_margin },
    { id: "TK 2", product: "PMS", opening: report.tk2_opening, closing: report.tk2_closing, diff: report.tk2_diff, margin: report.tk2_margin },
    { id: "TK 3", product: "PMS", opening: report.tk3_opening, closing: report.tk3_closing, diff: report.tk3_diff, margin: report.tk3_margin },
    { id: "TK 4", product: "AGO", opening: report.tk4_opening, closing: report.tk4_closing, diff: report.tk4_diff, margin: report.tk4_margin },
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
      return {
        pump,
        sessionCount: sessions.length,
        diff: sessions.length ? totalDiff : litresFallback,
        amount: totalAmount,
      }
    })
}

function buildSummaryText(report, date) {
  const lines = [
    `${getStation(activeStation()).name} — Daily Summary`,
    `${date}`,
    ``,
    `Grand Total: ${naira(report.grand_total)}`,
    `PMS: ${numberNG(report.pms_litres, { maximumFractionDigits: 2 })}L @ ${report.pms_price > 0 ? naira(report.pms_price) : "—"}/L = ${naira(report.pms_revenue)}`,
    `AGO: ${numberNG(report.ago_litres, { maximumFractionDigits: 2 })}L @ ${report.ago_price > 0 ? naira(report.ago_price) : "—"}/L = ${naira(report.ago_revenue)}`,
    `PMS Margin: ${numberNG(report.pms_margin, { maximumFractionDigits: 2 })}L (${naira(report.pms_margin_amount)}) · AGO Margin: ${numberNG(report.ago_margin, { maximumFractionDigits: 2 })}L (${naira(report.ago_margin_amount)})`,
    ``,
    `Tank Dips:`,
    ...tankRows(report).map(
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
    `POS Charges (M.P): ${naira(report.pos_mp_charge)}`,
    `POS Charges (Z.M): ${naira(report.pos_zm_charge)}`,
    ...(report.emtl_amount ? [`EMTL: ${naira(report.emtl_amount)}`] : []),
    `Cash to Bank: ${naira(report.to_bank)}`,
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

function SummaryInner() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const { status, report } = useRecordsData(auth.username, date)
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

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
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

  return (
    <div className="min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[200] flex items-center gap-3 border-b border-border bg-white px-4 pb-2.5 shadow-[0_1px_4px_rgba(0,0,0,.04)] print:hidden" style={{ paddingTop: "max(var(--sat), 52px)" }}>
        <button
          type="button"
          onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2"
        >
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-extrabold text-ink">Daily Summary</div>
          <label className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-4">
            <i className="bi bi-calendar3" />
            <input
              type="date"
              value={date}
              max={today}
              onChange={e => e.target.value && setDate(e.target.value)}
              className="bg-transparent text-[10px] text-ink-4 outline-none [color-scheme:light]"
            />
          </label>
        </div>
        <button type="button" onClick={() => window.print()} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-3">
          <i className="bi bi-printer" />
        </button>
        <button type="button" onClick={handleShare} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-3">
          <i className="bi bi-share" />
        </button>
      </div>

      <div className="print-release mx-auto max-w-[480px] px-4 py-5">
        <PrintWatermark />
        <PrintHeader
          title="Daily Summary"
          subtitle={
            report
              ? new Date(date).toLocaleDateString("en-NG", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : undefined
          }
        />
        {status === "loading" && (
          <div className="flex items-center justify-center py-16 text-[13px] text-ink-4">
            <span className="mr-2 h-4 w-4 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
            Loading summary…
          </div>
        )}

        {status === "no-data" && (
          <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-white py-16 text-center shadow-card">
            <i className="bi bi-inbox text-3xl text-ink-4" />
            <div className="text-[14px] font-bold text-ink">
              {date === today ? "No data for today yet" : "No record found for this date"}
            </div>
            <div className="max-w-[280px] text-[12.5px] text-ink-4">
              {date === today
                ? "Once Dip and Cashup are submitted, the summary will appear here."
                : "Try a different date, or check that Dip and Cashup were submitted that day."}
            </div>
          </div>
        )}

        {status === "ready" && report && (
          <div className="overflow-hidden rounded-card border border-border bg-white shadow-card print:border-0 print:shadow-none">
            <div className="bg-navy px-5 py-5 text-white print:bg-white print:text-ink print:border-b print:border-border">
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] opacity-50">{getStation(activeStation()).name} · Daily Summary</div>
              <div className="mt-1 text-[15px] font-bold opacity-80">{new Date(date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
              <div className="mono mt-3 text-[30px] font-black tracking-tight">{naira(report.grand_total)}</div>
              <div className="text-[11px] opacity-50">Grand Total</div>
              {(report.pms_margin !== 0 || report.ago_margin !== 0) && (
                <div className="mt-3 flex gap-4 border-t border-white/10 pt-3 text-[11px] opacity-70">
                  <div>
                    <span className="opacity-60">PMS Margin: </span>
                    <span className="mono font-bold">{numberNG(report.pms_margin, { maximumFractionDigits: 2 })}L ({naira(report.pms_margin_amount)})</span>
                  </div>
                  <div>
                    <span className="opacity-60">AGO Margin: </span>
                    <span className="mono font-bold">{numberNG(report.ago_margin, { maximumFractionDigits: 2 })}L ({naira(report.ago_margin_amount)})</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-px bg-surface">
              <div className="bg-white p-4">
                <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">PMS</div>
                <div className="mono mt-1 text-[15px] font-extrabold text-ink">{numberNG(report.pms_litres, { maximumFractionDigits: 2 })}L</div>
                <div className="text-[11px] text-ink-3">{naira(report.pms_revenue)} @ {report.pms_price > 0 ? `${naira(report.pms_price)}/L` : "— /L"}</div>
                <div className="mt-1 text-[10.5px] text-ink-4">Margin: {numberNG(report.pms_margin, { maximumFractionDigits: 2 })}L · {naira(report.pms_margin_amount)}</div>
                {report.priceTiers?.PMS?.length > 1 && (
                  <div className="mt-2 space-y-0.5 border-t border-surface pt-2">
                    {report.priceTiers.PMS.map((t, i) => (
                      <div key={i} className="flex justify-between text-[10px] text-ink-4">
                        <span>{numberNG(t.litres, { maximumFractionDigits: 2 })}L @ {naira(t.price)}</span>
                        <span className="mono font-semibold text-ink-3">{naira(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white p-4">
                <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">AGO</div>
                <div className="mono mt-1 text-[15px] font-extrabold text-ink">{numberNG(report.ago_litres, { maximumFractionDigits: 2 })}L</div>
                <div className="text-[11px] text-ink-3">{naira(report.ago_revenue)} @ {report.ago_price > 0 ? `${naira(report.ago_price)}/L` : "— /L"}</div>
                <div className="mt-1 text-[10.5px] text-ink-4">Margin: {numberNG(report.ago_margin, { maximumFractionDigits: 2 })}L · {naira(report.ago_margin_amount)}</div>
                {report.priceTiers?.AGO?.length > 1 && (
                  <div className="mt-2 space-y-0.5 border-t border-surface pt-2">
                    {report.priceTiers.AGO.map((t, i) => (
                      <div key={i} className="flex justify-between text-[10px] text-ink-4">
                        <span>{numberNG(t.litres, { maximumFractionDigits: 2 })}L @ {naira(t.price)}</span>
                        <span className="mono font-semibold text-ink-3">{naira(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-surface px-5 py-4">
              <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.8px] text-ink-4">Tank Dips</div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface">
                      {["Tank", "Opening", "Closing", "Diff", "Margin"].map(h => (
                        <th key={h} className="py-1.5 pr-2 text-left text-[9px] font-bold uppercase tracking-[0.5px] text-ink-4 last:text-right">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tankRows(report).map(t => (
                      <tr key={t.id} className="border-b border-surface last:border-b-0">
                        <td className="py-2 pr-2 text-[11.5px] font-bold text-ink">
                          {t.id} <span className="font-normal text-ink-4">· {t.product}</span>
                        </td>
                        <td className="mono py-2 pr-2 text-[11.5px] text-ink-2">{numberNG(t.opening, { maximumFractionDigits: 2 })}{t.unit || "L"}</td>
                        <td className="mono py-2 pr-2 text-[11.5px] text-ink-2">{numberNG(t.closing, { maximumFractionDigits: 2 })}{t.unit || "L"}</td>
                        <td className="mono py-2 pr-2 text-[11.5px] text-ink-2">{numberNG(t.diff, { maximumFractionDigits: 2 })}{t.unit || "L"}</td>
                        <td className="mono py-2 text-right text-[11.5px] font-bold text-ink">{numberNG(t.margin, { maximumFractionDigits: 2 })}{t.unit || "L"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {pumpRows(report).length > 0 && (
              <div className="border-t border-surface px-5 py-4">
                <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.8px] text-ink-4">Pump Readings</div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface">
                        {["Pump", "Sessions", "Litres", "Amount"].map(h => (
                          <th key={h} className="py-1.5 pr-2 text-left text-[9px] font-bold uppercase tracking-[0.5px] text-ink-4 last:text-right">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pumpRows(report).map(p => (
                        <tr key={p.pump} className="border-b border-surface last:border-b-0">
                          <td className="py-2 pr-2 text-[11.5px] font-bold text-ink">{p.pump}</td>
                          <td className="py-2 pr-2 text-[11.5px] text-ink-4">{p.sessionCount || "—"}</td>
                          <td className="mono py-2 pr-2 text-[11.5px] text-ink-2">{litres(p.diff, { maximumFractionDigits: 2 })}</td>
                          <td className="mono py-2 text-right text-[11.5px] font-bold text-ink">{p.amount > 0 ? naira(p.amount) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {photos.length > 0 && (
              <div className="border-t border-surface px-5 py-4 print:hidden">
                <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.8px] text-ink-4">Photos ({photos.length})</div>
                {["Morning", "Evening"].map(session => {
                  const group = photos.filter(p => p.session === session)
                  if (group.length === 0) return null
                  return (
                    <div key={session} className="mb-3 last:mb-0">
                      <div className="mb-1.5 text-[10px] font-semibold text-ink-4">{session}</div>
                      <div className="flex flex-wrap gap-2">
                        {group.map((p, i) => (
                          <PhotoThumb key={i} fileId={p.fileId} onClick={() => setLightboxPhoto(p)} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-col gap-2.5 border-t border-surface p-5">
              {[
                ["Total POS (M.P)", report.pos_mp],
                ["Total POS (Z.M)", report.pos_zm],
                ["Total TRF (M.P)", report.trf_mp],
                ["Cash Collected", report.cash],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-ink-2">{k}</span>
                  <span className="mono font-bold text-ink">{naira(v)}</span>
                </div>
              ))}

              {(report.trf_zb_amelia > 0 || report.trf_fcmb_truck > 0 || report.trf_fcmb_md > 0) && (
                <div className="mt-1 space-y-2 border-t border-surface pt-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-ink-4">Other Transfers</div>
                  {[
                    ["TRF to Z.B Amelia", report.trf_zb_amelia],
                    ["TRF to FCMB Truck", report.trf_fcmb_truck],
                    ["TRF to FCMB M.D", report.trf_fcmb_md],
                  ].filter(([, v]) => v > 0).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-ink-2">{k}</span>
                      <span className="mono font-bold text-ink">{naira(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-[13px] text-red">
                <span>Expenses</span>
                <span className="mono font-bold">−{naira(report.total_expenses)}</span>
              </div>

              <div className="flex items-center justify-between border-t border-surface pt-2.5 text-[12.5px]">
                <span className="text-ink-3">POS Charges (MP 0.30% + ZM 0.30% + TRF M.P 0.30%)</span>
                <span className="mono font-semibold text-ink-3">−{naira(report.pos_mp_charge + report.pos_zm_charge)}</span>
              </div>
              {report.emtl_amount > 0 && (
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-ink-3">EMTL</span>
                  <span className="mono font-semibold text-ink-3">{naira(report.emtl_amount)}</span>
                </div>
              )}

              <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[13.5px] font-extrabold text-ink">Cash to Bank</span>
                <span className="mono text-[18px] font-extrabold text-green">{naira(report.to_bank)}</span>
              </div>
            </div>

            {report.lubricantItems?.length > 0 && (
              <div className="border-t border-surface p-5">
                <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.8px] text-ink-4">Lubricant (Oil) Report</div>
                <div className="space-y-1.5">
                  {report.lubricantItems.map((it, i) => (
                    <div key={i} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-ink-2">{it.product} <span className="text-ink-4">{it.qty}×{naira(it.unitPrice)}</span></span>
                      <span className="mono font-bold text-ink">{naira(it.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-surface pt-2.5">
                  <span className="text-[13px] font-extrabold text-ink">Total Amount Remitted</span>
                  <span className="mono text-[15px] font-extrabold text-ink">{naira(report.lubricant_rev)}</span>
                </div>
              </div>
            )}

            {report.lpg_kg > 0 && (
              <div className="border-t border-surface p-5">
                <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.8px] text-ink-4">LPG Report</div>
                {[
                  ["Total KG", `${report.lpg_kg}KG`],
                  ["Unit Price", naira(report.lpg_price)],
                  ["Total Sales", naira(report.lpg_revenue)],
                  ["Amount Remitted", naira(report.lpg_remitted)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-ink-2">{k}</span>
                    <span className="mono font-bold text-ink">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {report.total_cash_summary > 0 && (
              <div className="border-t border-surface p-5">
                <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.8px] text-ink-4">Sales Cash Summary</div>
                {[
                  ["PMS", report.pms_cash_summary],
                  ["OIL", report.oil_cash_summary],
                  ["GAS", report.gas_cash_summary],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-surface py-1.5 text-[12.5px]">
                    <span className="text-ink-2">{k}</span>
                    <span className="mono font-bold text-ink">{naira(v)}</span>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between pt-1.5">
                  <span className="text-[13px] font-extrabold text-ink">TOTAL</span>
                  <span className="mono text-[16px] font-extrabold text-navy">{naira(report.total_cash_summary)}</span>
                </div>
              </div>
            )}

            {(report.remarks || report.cashup_status) && (
              <div className="border-t border-surface p-5">
                {report.cashup_status && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.7px] text-ink-4">Cash Reconciliation:</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      report.cashup_status === "APPROVED" ? "bg-green-light text-green"
                      : report.cashup_status === "REJECTED" ? "bg-red-light text-red"
                      : "bg-amber-light text-amber"
                    }`}>
                      {report.cashup_status === "APPROVED" ? "✓ Approved" : report.cashup_status === "REJECTED" ? "✗ Rejected" : "⏳ Pending Approval"}
                    </span>
                  </div>
                )}
                {report.remarks && (
                  <div className="rounded-[12px] border border-amber/20 bg-amber-light px-4 py-3">
                    <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.7px] text-amber">General Remarks</div>
                    <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">{report.remarks}</div>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-surface px-5 py-3 text-center text-[11px] text-ink-4">
              Submitted by {report.submitted_by || "—"}
            </div>
          </div>
        )}
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
