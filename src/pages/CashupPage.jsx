import React, { useState } from "react"
import { activeStation } from "../utils/station"
import { getStation } from "../config/stations"
import { useNavigate } from "react-router-dom"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import DateRow from "../components/dip/DateRow"
import ConfirmSubmitModal from "../components/ui/ConfirmSubmitModal"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useLubricant } from "../hooks/useLubricant"
import { useCashupData } from "../hooks/useCashupData"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, numberNG, litres } from "../utils/format"

const RECON_STYLES = {
  pending: { grad: "var(--brand-gradient-btn)", accent: "#94A3B8", icon: "bi-hourglass-split", label: "Enter amounts to reconcile" },
  balanced: { grad: "linear-gradient(135deg,#0f7a3d 0%,#16A34A 100%)", accent: "#BBF7D0", icon: "bi-check-circle-fill", label: "Balanced" },
  short: { grad: "linear-gradient(135deg,#7f1d1d 0%,#DC2626 100%)", accent: "#FECACA", icon: "bi-exclamation-triangle-fill", label: "Short" },
  over: { grad: "linear-gradient(135deg,#0E7196 0%,var(--brand-accent) 100%)", accent: "#BEE6F5", icon: "bi-arrow-up-circle-fill", label: "Over" },
}

// A compact, single-row money input — label + input on one line, optional
// charge/net breakdown appearing inline underneath only once a value is
// entered. Replaces the earlier pattern of a full bordered card with an
// icon header for every field, which added visual weight without adding
// information.
function MoneyRow({ label, sub, value, onChange, charge, chargeLabel, net }) {
  const hasValue = Number(value) > 0
  return (
    <div className="border-b border-surface px-4 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12.5px] font-bold text-ink">{label}</div>
          {sub && <div className="text-[10px] text-ink-4">{sub}</div>}
        </div>
        <input
          type="number" inputMode="decimal" placeholder="0" min="0" step="1"
          value={value} onChange={e => onChange(e.target.value)}
          className={`mono w-[140px] rounded-[9px] border-[1.5px] px-3 py-2 text-right text-[15px] font-extrabold outline-none transition-colors ${
            hasValue ? "border-cyan/35 bg-white text-ink" : "border-border bg-surface text-ink-3"
          } focus:border-cyan focus:bg-white`}
        />
      </div>
      {hasValue && charge !== undefined && charge > 0 && (
        <div className="mt-2 flex items-center justify-end gap-3 text-[11px]">
          <span className="font-semibold text-red">−{naira(charge)} {chargeLabel || "charge"}</span>
          <span className="font-semibold text-green">{naira(net)} net</span>
        </div>
      )}
    </div>
  )
}

function SectionCard({ title, sub, children }) {
  return (
    <div className="mb-4 overflow-hidden rounded-card border border-border bg-white shadow-card">
      {title && (
        <div className="border-b border-surface px-4 py-3">
          <div className="text-[12.5px] font-extrabold text-ink">{title}</div>
          {sub && <div className="mt-0.5 text-[10.5px] text-ink-4">{sub}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

function CashupInner() {
  const auth = useAuth({ requireAuth: true })
  const toast = useToast()
  const navigate = useNavigate()
  usePageTitle(`Cash Reconciliation — ${getStation(activeStation()).name}`)

  const {
    date, setDate,
    expected, loadingExpected, refreshExpected,
    posMP, setPosMP, posZM, setPosZM, cashAmt, setCashAmt,
    trfMP, setTrfMP, trfZBAmelia, setTrfZBAmelia, trfFCMBTruck, setTrfFCMBTruck, trfFCMBMD, setTrfFCMBMD, trfTotal,
    emtlCount, setEmtlCount, emtlAmount,
    expenses, addExpense, updateExpense, removeExpense,
    lubricantItems, addLubricant, updateLubricant, removeLubricant, lubricantTotal, setLubricantPrices,
    lpgRemitted, setLpgRemitted, lpgSales, lpgVariance,
    remarks, setRemarks,
    cashupStatus, cashupLocked, requestEdit, requestingEdit,
    mpCharge, zmCharge, trfMPCharge, mpNet, zmNet, trfMPNet, totalCharges, totalExpenses,
    collected, cashToBank, variance, reconStatus, cashSummary, submit, saving,
  } = useCashupData(auth.username, auth.name)
  /* The oil price list. The cashier reads it; only supervisors/GM/owner write it. */
  const {
    status: lubProductsStatus,
    products: lubProducts,
    priceOf: lubPriceOf,
  } = useLubricant({ username: auth.username })

  /* Feed catalogue prices into the cash-up hook so its running total matches
     exactly what the server will record. Without this the cashier would
     reconcile against a total of zero. */
  React.useEffect(() => {
    if (lubProductsStatus !== "ready") return
    setLubricantPrices(
      Object.fromEntries(lubProducts.map(p => [p.product, p.sellPrice]))
    )
  }, [lubProductsStatus, lubProducts, setLubricantPrices])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [tab, setTab] = useState("payments")
  const [editRequested, setEditRequested] = useState(false)

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }

  const recon = RECON_STYLES[reconStatus]
  const locked = !loadingExpected && !expected.closingDipDone

  const doSubmit = async () => {
    setConfirmOpen(false)
    const result = await submit()
    if (!result.ok) {
      toast.showToast("Could not save", result.error || "Please try again", "err")
      return
    }
    if (navigator.vibrate) navigator.vibrate([50, 30, 80])
    toast.showToast("Saved", "Reconciliation saved successfully", "ok")
    setTimeout(() => navigate(dashboardPathFor({ role: auth.role, station: auth.station })), 1200)
  }

  const handleSubmit = () => setConfirmOpen(true)

  const reviewRows = [
    { label: "POS (MP)", value: naira(Number(posMP) || 0) },
    { label: "POS (ZM)", value: naira(Number(posZM) || 0) },
    { label: "Cash", value: naira(Number(cashAmt) || 0), warn: Number(cashAmt) === 0 },
    ...(trfTotal > 0 ? [{ label: "Bank Transfers (total)", value: naira(trfTotal) }] : []),
    { label: "POS Charges (MP+ZM+TRF MP, 0.3% each)", value: `−${naira(totalCharges)}` },
    { label: "Expenses (total)", value: naira(totalExpenses) },
    ...(lubricantTotal > 0 ? [{ label: "Lubricant (total)", value: naira(lubricantTotal) }] : []),
    ...(Number(lpgRemitted) > 0 ? [{ label: "LPG Remitted", value: naira(Number(lpgRemitted)) }] : []),
    ...(emtlAmount > 0 ? [{ label: "EMTL", value: naira(emtlAmount) }] : []),
    { label: "Cash to Bank", value: naira(cashToBank) },
    { label: "Reconciliation", value: recon.label, warn: reconStatus === "short" || reconStatus === "over" },
    ...(remarks.trim() ? [{ label: "Remarks", value: remarks.trim() }] : []),
  ]
  const reviewWarnings = []
  if (reconStatus === "short") reviewWarnings.push(`This is SHORT by ${naira(Math.abs(variance || 0))} against expected sales — if this is a customer who bought on credit, add a note in Remarks so GM/CEO sees it before approving.`)
  if (reconStatus === "over") reviewWarnings.push(`This is OVER by ${naira(Math.abs(variance || 0))} against expected sales — double-check before saving.`)
  if (Number(posMP) === 0 && Number(posZM) === 0 && Number(cashAmt) === 0 && trfTotal === 0) {
    reviewWarnings.push("No payment amounts entered at all.")
  }

  const TABS = [
    ["payments", "Payments", "bi-credit-card"],
    ["deductions", "Deductions", "bi-receipt-cutoff"],
    ["products", "Products", "bi-droplet-half"],
  ]

  return (
    <div className="min-h-screen bg-pagebg">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[200] flex items-center gap-3 border-b border-border bg-white px-4 pb-2.5 shadow-[0_1px_4px_rgba(0,0,0,.04)]" style={{ paddingTop: "max(var(--sat), 52px)" }}>
        <button
          type="button"
          onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2"
        >
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-extrabold text-ink">Cash Reconciliation</div>
          <div className="text-[10px] text-ink-4">Balance today's or a past day's cash-up</div>
        </div>
        <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[#DDD6FE] bg-[#EDE9FE] px-2.5 py-1 text-[10.5px] font-bold text-[#6D28D9]">
          <i className="bi bi-shield-check text-[11px]" /> Cashier
        </span>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4 pb-[120px]">
        <DateRow date={date} onChange={setDate} supName={auth.name || auth.username} roleLabel={auth.role === "supervisor" ? "Supervisor" : "Cashier"} />

        {/* ── STATUS HERO — the one number that matters most, always visible,
            never repeated three times across the page like before ── */}
        <div className="relative mb-4 overflow-hidden rounded-card p-5" style={{ background: recon.grad }}>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.5px] text-white/50">
            <i className={`bi ${recon.icon}`} /> {recon.label}
            <button type="button" onClick={refreshExpected} className="ml-auto flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border border-white/15 bg-white/10 text-white/60">
              <i className={`bi bi-arrow-clockwise ${loadingExpected ? "animate-spin-fast" : ""}`} />
            </button>
          </div>

          <div className="mono mt-2 text-[36px] font-black leading-none tracking-tight text-white">
            {expected.hasData ? `${variance >= 0 ? "+" : "−"}${naira(Math.abs(variance || 0))}` : "₦—"}
          </div>
          <div className="mt-1 text-[11px] text-white/60">Variance — Collected vs Expected</div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3.5">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.7px] text-white/40">Expected (dip)</div>
              <div className="mono mt-0.5 text-[15px] font-extrabold text-white">{loadingExpected ? "…" : expected.hasData ? naira(expected.grandTotal) : "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.7px] text-white/40">Collected</div>
              <div className="mono mt-0.5 text-[15px] font-extrabold text-white">{naira(collected)}</div>
            </div>
          </div>

          {locked && (
            <div className="mt-3.5 flex items-center gap-2 rounded-[10px] bg-black/20 px-3.5 py-2.5 text-[12px] font-medium text-white">
              <i className="bi bi-lock-fill" /> Closing Dip hasn't been submitted yet — locked until it is.
            </div>
          )}
          {!loadingExpected && expected.closingDipDone && !expected.hasData && (
            <div className="mt-3.5 flex items-center gap-2 rounded-[10px] bg-black/20 px-3.5 py-2.5 text-[12px] font-medium text-white">
              <i className="bi bi-exclamation-triangle-fill" /> Supervisor has not submitted dip readings yet.
            </div>
          )}
          {!locked && cashupStatus === "PENDING" && (
            <div className="mt-3.5 flex items-center gap-2 rounded-[10px] bg-black/20 px-3.5 py-2.5 text-[12px] font-medium text-white">
              <i className="bi bi-hourglass-split" /> Submitted — awaiting GM/CEO approval.
            </div>
          )}
          {!locked && cashupStatus === "REJECTED" && (
            <div className="mt-3.5 flex items-center gap-2 rounded-[10px] bg-black/20 px-3.5 py-2.5 text-[12px] font-medium text-white">
              <i className="bi bi-x-circle-fill" /> This was rejected — please review and resubmit.
            </div>
          )}
          {!locked && cashupLocked && (
            <div className="mt-3.5 rounded-[10px] bg-black/20 px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-[12px] font-medium text-white">
                <i className="bi bi-shield-check" /> Approved — locked. Request an edit to change it.
              </div>
              {editRequested ? (
                <div className="mt-2 flex items-center gap-2 text-[11.5px] font-semibold text-white/70">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70" /> Edit requested — waiting for approval
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await requestEdit()
                    if (res.ok) setEditRequested(true)
                  }}
                  disabled={requestingEdit}
                  className="mt-2 rounded-[8px] bg-white/15 px-3 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-60"
                >
                  {requestingEdit ? "Sending…" : "Request Edit"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* PMS/AGO reference strip — compact, secondary to the hero above */}
        {expected.hasData && (
          <div className="mb-5 grid grid-cols-2 gap-2.5">
            <div className="rounded-[12px] border border-border bg-white px-3.5 py-2.5">
              <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-ink-4">PMS Expected</div>
              <div className="mono mt-0.5 text-[13.5px] font-extrabold text-ink">{litres(expected.pmsLitres, { maximumFractionDigits: 2 })}</div>
              <div className="text-[10px] text-ink-4">{naira(expected.pmsRevenue)} @ {naira(expected.pmsPrice)}/L</div>
            </div>
            <div className="rounded-[12px] border border-border bg-white px-3.5 py-2.5">
              <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-ink-4">AGO Expected</div>
              <div className="mono mt-0.5 text-[13.5px] font-extrabold text-ink">{litres(expected.agoLitres, { maximumFractionDigits: 2 })}</div>
              <div className="text-[10px] text-ink-4">{naira(expected.agoRevenue)} @ {naira(expected.agoPrice)}/L</div>
            </div>
          </div>
        )}

        {/* ── TAB NAV — three focused groups instead of one long undifferentiated scroll ── */}
        <div className="mb-4 flex gap-1 rounded-[12px] border border-border bg-white p-1 shadow-card">
          {TABS.map(([key, label, icon]) => (
            <button
              key={key} type="button" onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2.5 text-[12px] font-bold transition-colors ${
                tab === key ? "bg-navy text-white" : "text-ink-3"
              }`}
            >
              <i className={`bi ${icon}`} /> {label}
            </button>
          ))}
        </div>

        {/* ── PAYMENTS TAB ── */}
        {tab === "payments" && (
          <>
            <SectionCard title="POS Terminals">
              <MoneyRow label="MP Terminal" sub="Total POS (M.P)" value={posMP} onChange={setPosMP} charge={mpCharge} net={mpNet} />
              <MoneyRow label="ZM Terminal" sub="Total POS (Z.M)" value={posZM} onChange={setPosZM} charge={zmCharge} net={zmNet} />
            </SectionCard>

            <SectionCard title="Bank Transfers" sub="TRF (M.P) carries a 0.3% charge — the others don't">
              <MoneyRow label="TRF (M.P)" value={trfMP} onChange={setTrfMP} charge={trfMPCharge} net={trfMPNet} />
              <MoneyRow label="TRF to Z.B Amelia" value={trfZBAmelia} onChange={setTrfZBAmelia} />
              <MoneyRow label="TRF to FCMB Truck" value={trfFCMBTruck} onChange={setTrfFCMBTruck} />
              <MoneyRow label="TRF to FCMB M.D" value={trfFCMBMD} onChange={setTrfFCMBMD} />
              {trfTotal > 0 && (
                <div className="flex items-center justify-between bg-surface px-4 py-2.5">
                  <span className="text-[11px] font-semibold text-ink-3">Total Transfers</span>
                  <span className="mono text-[13.5px] font-extrabold text-ink">{naira(trfTotal)}</span>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Cash" sub="Count carefully — exact amount">
              <MoneyRow label="Physical Cash Collected" value={cashAmt} onChange={setCashAmt} />
            </SectionCard>
          </>
        )}

        {/* ── DEDUCTIONS TAB ── */}
        {tab === "deductions" && (
          <>
            <SectionCard title="Today's Expenses" sub="Deducted from cash to bank">
              <div className="p-4">
                {expenses.map((e, i) => (
                  <div key={i} className="mb-2 flex items-center gap-2 last:mb-0">
                    <input
                      type="text" placeholder="Description (e.g. Logistics to bank)"
                      value={e.desc} onChange={ev => updateExpense(i, "desc", ev.target.value)}
                      className="flex-1 rounded-[9px] border-[1.5px] border-border bg-surface px-3 py-2.5 text-[13px] font-medium text-ink outline-none focus:border-cyan focus:bg-white"
                    />
                    <input
                      type="number" placeholder="₦0" min="0" step="1"
                      value={e.amt} onChange={ev => updateExpense(i, "amt", ev.target.value)}
                      className="mono w-[110px] rounded-[9px] border-[1.5px] border-border bg-surface px-3 py-2.5 text-right text-[13px] font-bold text-ink outline-none focus:border-cyan focus:bg-white"
                    />
                    <button type="button" onClick={() => removeExpense(i)} className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[8px] border border-[#FECACA] bg-red-light text-red">
                      <i className="bi bi-trash text-[13px]" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addExpense} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[9px] border-[1.5px] border-dashed border-border bg-surface py-2.5 text-[12.5px] font-semibold text-ink-3">
                  <i className="bi bi-plus-circle" /> Add Expense
                </button>
                <div className="mt-2.5 flex items-center justify-between rounded-[9px] border border-border bg-surface px-3.5 py-2.5">
                  <span className="text-[11px] font-semibold text-ink-3">Total Expenses</span>
                  <span className="mono text-[14px] font-extrabold text-ink">{naira(totalExpenses)}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="EMTL" sub="₦50 per qualifying transfer">
              <div className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Transfer Count</div>
                  <input
                    type="number" inputMode="numeric" placeholder="0" min="0" step="1"
                    value={emtlCount} onChange={e => setEmtlCount(e.target.value)}
                    className="mono w-full rounded-[9px] border-[1.5px] border-border bg-surface px-3 py-2.5 text-[15px] font-extrabold text-ink outline-none focus:border-cyan focus:bg-white"
                  />
                </div>
                <div className="pt-4 text-ink-4"><i className="bi bi-x-lg text-[11px]" /></div>
                <div className="flex-1 text-right">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Amount</div>
                  <div className="mono text-[15px] font-extrabold text-ink">{naira(emtlAmount)}</div>
                </div>
              </div>
            </SectionCard>
          </>
        )}

        {/* ── PRODUCTS TAB ── */}
        {tab === "products" && (
          <>
            {/* Oil sales — product picked from the catalogue, price locked.
                The cashier used to type BOTH the product name and its price as
                free text, which meant "Mobil 1000 1L" and "Mobil 1000 (1L)"
                became different products in the sheet, and the cashier was the
                de-facto authority on what oil cost. Now a supervisor maintains
                the price list and the cashier just picks and counts. The price
                shown here is display-only; the server stamps the real one from
                the catalogue when the sale saves, so a tampered request can't
                sell oil at a made-up price. */}
            <SectionCard
              title="Lubricant (Oil) Report"
              sub={lubProductsStatus === "ready" && lubProducts.length === 0
                ? "No oil products priced yet"
                : "Pick a product · price comes from the price list"}
            >
              <div className="p-4">
                {lubProductsStatus === "loading" ? (
                  <div className="space-y-2.5">
                    {[0, 1].map(i => <span key={i} className="skel block h-10 w-full" />)}
                  </div>
                ) : lubProducts.length === 0 ? (
                  <div className="rounded-[10px] border border-amber/25 bg-amber-light px-4 py-5 text-center">
                    <i className="bi bi-droplet text-[18px] text-amber" />
                    <p className="mt-2 text-[12.5px] font-bold text-ink">No oil prices set</p>
                    <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-ink-3">
                      A supervisor needs to add oil products and their prices before
                      you can record an oil sale.
                    </p>
                  </div>
                ) : (
                  <>
                    {lubricantItems.map((it, i) => {
                      const unit = lubPriceOf(it.product) ?? 0
                      const lineTotal = (Number(it.qty) || 0) * unit
                      return (
                        // The select carries a long product name and its price, so it
                        // gets a line of its own on mobile — sharing one row with qty,
                        // total and a delete button squeezed it to a few unreadable
                        // characters at 375px.
                        <div key={i} className="mb-3 rounded-[10px] border border-border bg-surface/50 p-2 last:mb-0 sm:mb-2.5 sm:flex sm:items-center sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0">
                          <select
                            value={it.product}
                            onChange={ev => updateLubricant(i, "product", ev.target.value)}
                            aria-label="Oil product"
                            className="mb-2 w-full min-w-0 rounded-[9px] border-[1.5px] border-border bg-white px-3 py-2.5 text-[13px] font-medium text-ink outline-none focus:border-cyan sm:mb-0 sm:flex-1 sm:bg-surface sm:focus:bg-white"
                          >
                            <option value="">Select product…</option>
                            {lubProducts.map(p => (
                              <option key={p.product} value={p.product}>
                                {p.product} — {naira(p.sellPrice)}
                                {p.stock > 0 ? ` · ${p.stock} left` : p.stock === 0 ? " · out of stock" : ""}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-2 sm:contents">
                          <input
                            type="number" placeholder="Qty" min="0" step="1" inputMode="numeric"
                            value={it.qty}
                            onChange={ev => updateLubricant(i, "qty", ev.target.value)}
                            aria-label="Quantity sold"
                            className="mono w-[58px] flex-shrink-0 rounded-[9px] border-[1.5px] border-border bg-white px-2 py-2.5 text-right text-[13px] font-bold text-ink outline-none focus:border-cyan sm:bg-surface sm:focus:bg-white"
                          />

                          {/* Read-only. The price is not the cashier's to set. */}
                          <div
                            className="mono flex flex-1 items-center justify-end rounded-[9px] border border-border bg-white px-2 py-2.5 text-[12.5px] font-extrabold tabular-nums text-ink sm:w-[86px] sm:flex-none"
                            title={it.product ? `${naira(unit)} each` : "Pick a product first"}
                          >
                            {it.product ? naira(lineTotal) : "—"}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeLubricant(i)}
                            aria-label="Remove this line"
                            className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[8px] border border-[#FECACA] bg-red-light text-red transition-transform active:scale-90 sm:h-[30px] sm:w-[30px]"
                          >
                            <i className="bi bi-trash text-[13px]" />
                          </button>
                          </div>
                        </div>
                      )
                    })}

                    <button
                      type="button"
                      onClick={addLubricant}
                      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[9px] border-[1.5px] border-dashed border-border bg-surface py-2.5 text-[12.5px] font-semibold text-ink-3 transition-colors hover:border-cyan/40 hover:text-cyan-dark"
                    >
                      <i className="bi bi-plus-circle" /> Add Product
                    </button>

                    {/* Warn, never block. If stock says 3 and the cashier really
                        sold 5, blocking would mean real money that really came in
                        cannot be recorded and the day won't reconcile — a control
                        that stops real work is worse than the discrepancy. The
                        sale goes through; the GM sees the flag. */}
                    {lubricantItems.some(it => {
                      const p = lubProducts.find(x => x.product === it.product)
                      return p && Number(it.qty) > 0 && Number(it.qty) > p.stock
                    }) && (
                      <div className="mt-2.5 flex items-start gap-2 rounded-[9px] border border-amber/30 bg-amber-light px-3.5 py-2.5">
                        <i className="bi bi-exclamation-triangle-fill mt-px text-[12px] text-amber" />
                        <p className="text-[11px] leading-relaxed text-ink-2">
                          You&rsquo;re selling more than the recorded stock. That&rsquo;s fine — the sale
                          still saves — but it usually means a delivery wasn&rsquo;t logged. Mention it
                          to your supervisor.
                        </p>
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between rounded-[9px] border border-border bg-surface px-3.5 py-2.5">
                      <span className="text-[11px] font-semibold text-ink-3">Total Amount Remitted</span>
                      <span className="mono text-[14px] font-extrabold text-ink">{naira(lubricantTotal)}</span>
                    </div>
                  </>
                )}
              </div>
            </SectionCard>

            <SectionCard title="LPG Report" sub="KG and Price now come from Sales pump readings">
              <div className="grid grid-cols-2 gap-3 p-4">
                <div className="rounded-[9px] border border-border bg-surface px-3.5 py-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-[0.7px] text-ink-4">Expected KG</div>
                  <div className="mono mt-0.5 text-[14px] font-extrabold text-ink">{expected.lpgKg ? expected.lpgKg.toLocaleString("en-NG", { maximumFractionDigits: 2 }) : "—"}kg</div>
                </div>
                <div className="rounded-[9px] border border-border bg-surface px-3.5 py-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-[0.7px] text-ink-4">Unit Price</div>
                  <div className="mono mt-0.5 text-[14px] font-extrabold text-ink">{expected.lpgPrice ? naira(expected.lpgPrice) : "—"}</div>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-[9px] border border-border bg-surface px-3.5 py-2.5">
                  <span className="text-[11px] font-semibold text-ink-3">Expected Sales</span>
                  <span className="mono text-[14px] font-extrabold text-ink">{naira(lpgSales)}</span>
                </div>
                <label className="col-span-2 block">
                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.7px] text-ink-4">Amount Remitted (₦)</span>
                  <input
                    type="number" inputMode="decimal" placeholder="0" min="0" step="1"
                    value={lpgRemitted} onChange={e => setLpgRemitted(e.target.value)}
                    className="mono w-full rounded-[9px] border-[1.5px] border-border bg-surface px-3 py-2.5 text-[14px] font-extrabold text-ink outline-none focus:border-cyan focus:bg-white"
                  />
                </label>
                {lpgVariance !== null && lpgVariance !== 0 && (
                  <div className="col-span-2 flex items-center gap-2 rounded-[9px] border border-red/25 bg-red-light px-3.5 py-2.5 text-[11.5px] font-semibold text-red">
                    <i className="bi bi-exclamation-triangle-fill" />
                    Remitted {lpgVariance > 0 ? "exceeds" : "is short of"} sales by {naira(Math.abs(lpgVariance))}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="General Remarks" sub="Anything worth flagging for GM/CEO — e.g. a customer who bought on credit">
              <div className="p-4">
                <textarea
                  rows={3} value={remarks} onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Chief Bode took ₦15,000 PMS on credit, promised to pay tomorrow."
                  className="w-full resize-none rounded-[10px] border-[1.5px] border-border bg-surface px-3.5 py-3 text-[13px] text-ink outline-none focus:border-cyan focus:bg-white"
                />
              </div>
            </SectionCard>
          </>
        )}

        {/* ── FINAL SUMMARY — one consolidated card, not three separate ones ── */}
        <div className="mt-2 overflow-hidden rounded-card border-2 border-[#BBF7D0] bg-white">
          <div className="p-5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1px] text-green">
              <i className="bi bi-safe" /> Cash to Bank
            </div>
            <div className="mono text-[32px] font-black tracking-tight text-green">{naira(cashToBank)}</div>
            <div className="mt-1.5 text-[11.5px] text-ink-3">Physical cash − expenses. POS/Transfer charges don't touch physical cash, so they don't reduce this figure.</div>
          </div>
          <div className="border-t border-surface bg-surface/50 p-5">
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[1px] text-ink-4">Sales Cash Summary</div>
            {[
              ["PMS", cashSummary.pms],
              ["OIL", cashSummary.oil],
              ["GAS", cashSummary.gas],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between border-b border-border/60 py-1.5">
                <span className="text-[12.5px] font-semibold text-ink-2">{k}</span>
                <span className="mono text-[14px] font-bold text-ink">{naira(v)}</span>
              </div>
            ))}
            <div className="mt-1 flex items-baseline justify-between pt-1.5">
              <span className="text-[13px] font-extrabold text-ink">TOTAL</span>
              <span className="mono text-[17px] font-extrabold text-navy">{naira(cashSummary.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[300] border-t border-border bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,.08)]" style={{ paddingBottom: "calc(12px + var(--sab))" }}>
        <div className="mx-auto flex max-w-[640px] gap-2.5">
          <button type="button" onClick={refreshExpected} className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[13px] border-[1.5px] border-border bg-surface text-ink-3">
            <i className="bi bi-arrow-clockwise" />
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || locked || cashupLocked}
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[13px] bg-green text-[15px] font-extrabold text-white shadow-[0_4px_18px_rgba(22,163,74,.3)] disabled:opacity-60"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" />
            ) : locked || cashupLocked ? (
              <i className="bi bi-lock-fill" />
            ) : (
              <i className="bi bi-check2-all" />
            )}
            {saving ? "Saving…" : locked ? "Locked — Complete Closing Dip First" : cashupLocked ? "Locked — Approved" : "Save Reconciliation"}
          </button>
        </div>
      </div>

      <ConfirmSubmitModal
        open={confirmOpen}
        title="Confirm Cash Reconciliation"
        subtitle={`Review before saving — ${date}`}
        rows={reviewRows}
        warnings={reviewWarnings}
        confirming={saving}
        onConfirm={doSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

export default function CashupPage() {
  return (
    <ToastProvider>
      <CashupInner />
    </ToastProvider>
  )
}
