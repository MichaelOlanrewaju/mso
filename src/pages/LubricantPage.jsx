import React, { useState } from "react"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import Sidebar from "../components/layout/Sidebar"
import Topbar from "../components/layout/Topbar"
import BottomNav from "../components/layout/BottomNav"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useLubricant, useLubricantDeliveries } from "../hooks/useLubricant"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira } from "../utils/format"

/**
 * Oil — prices, stock, deliveries.
 *
 * The role split is the whole point of this page:
 *   Supervisor  sets the SELLING price and records deliveries.
 *   GM/Owner    sets the COST price from the supplier invoice.
 *   CEO         sees both, and therefore sees margin.
 *
 * A supervisor never sees cost — it's stripped from the API response, not just
 * hidden here — so what the station pays Scarlet & Snow stays between the GM and
 * the owner.
 */

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function StockPill({ stock, flag }) {
  if (flag === "oversold")
    return (
      <span
        className="rounded-full px-2 py-[3px] text-[10px] font-extrabold"
        style={{ background: "#FEE2E2", color: "#DC2626" }}
        title="Sold more than was received — a delivery is probably unlogged"
      >
        {stock} · check
      </span>
    )
  if (flag === "out")
    return <span className="rounded-full bg-surface px-2 py-[3px] text-[10px] font-extrabold text-ink-4">Out</span>
  if (flag === "low")
    return <span className="rounded-full bg-amber-light px-2 py-[3px] text-[10px] font-extrabold text-amber">{stock} left</span>
  return <span className="rounded-full bg-green-light px-2 py-[3px] text-[10px] font-extrabold text-green">{stock} in stock</span>
}

export default function LubricantPage() {
  const auth = useAuth({ requireAuth: true })
  usePageTitle("Oil — MSO Limpid")

  const canPrice = auth.role === "supervisor" || auth.isGM || auth.isOwner || auth.role === "ceo"
  const canCost = auth.isGM || auth.isOwner || auth.role === "ceo"

  const {
    status, products, seesCost, saving,
    setSellPrice, setCostPrice, removeProduct, recordDelivery, voidDelivery,
  } = useLubricant({ username: auth.username })
  const { status: delStatus, deliveries, refresh: refreshDeliveries } = useLubricantDeliveries()
  const canVoid = auth.isGM || auth.isOwner || auth.role === "ceo"

  const [tab, setTab] = useState("prices")
  const [editing, setEditing] = useState(null)
  const [costing, setCosting] = useState(null)
  const [delivering, setDelivering] = useState(false)
  const [msg, setMsg] = useState(null)

  const [name, setName] = useState("")
  const [sell, setSell] = useState("")
  const [cost, setCost] = useState("")
  /* One invoice header + N product lines. Your Scarlet & Snow invoice 002192 is
     seven products on one sheet of paper — entering it seven times, retyping the
     supplier and invoice number each time, is how a single delivery ends up split
     across two records that never reconcile. */
  const BLANK_LINE = { product: "", cartons: "", unitsPerCarton: "", unitCost: "" }
  const [inv, setInv] = useState({ supplier: "", invoiceNo: "", date: todayISO(), invoiceTotal: "" })
  const [lines, setLines] = useState([{ ...BLANK_LINE }])
  const [voiding, setVoiding] = useState(null)

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  const flash = (err, text) => setMsg({ err, text })

  const submitSell = () => {
    const n = name.trim(), v = Number(sell)
    if (!n) return flash(true, "Give the product a name.")
    if (!v || v <= 0) return flash(true, "Enter a selling price above zero.")
    setSellPrice({ product: n, sellPrice: v }).then(d => {
      if (d.ok) { flash(false, `${n} — selling at ${naira(v)}`); setEditing(null); setName(""); setSell("") }
      else flash(true, d.error || "Could not save.")
    })
  }

  const submitCost = () => {
    const v = Number(cost)
    if (!v || v <= 0) return flash(true, "Enter a cost price above zero.")
    setCostPrice({ product: costing.product, costPrice: v }).then(d => {
      if (d.ok) {
        // A negative margin is a real thing — a supplier raises their price and
        // nobody updates the shelf. Surface it rather than swallow it.
        flash(Boolean(d.warning), d.warning || `${costing.product} — cost ${naira(v)}, margin ${naira(d.margin || 0)}`)
        setCosting(null); setCost("")
      } else flash(true, d.error || "Could not save.")
    })
  }

  const lineUnits = l => (Number(l.cartons) || 0) * (Number(l.unitsPerCarton) || 0)
  const lineCost = l => lineUnits(l) * (Number(l.unitCost) || 0)
  const computedTotal = lines.reduce((s, l) => s + lineCost(l), 0)
  const statedTotal = Number(inv.invoiceTotal) || 0
  /* Warn on a mismatch, never block. A mistyped carton count — 20 fingered as
     200 — creates 800 phantom units and nothing else in the system would ever
     question it. But sometimes the invoice itself is wrong, or there was a
     discount nobody captured, and refusing to record oil that physically arrived
     is worse than a mismatched number. */
  const mismatch =
    statedTotal > 0 && computedTotal > 0 && Math.abs(statedTotal - computedTotal) > 1
      ? statedTotal - computedTotal
      : 0

  const setLine = (i, field, value) =>
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))
  const addLine = () => setLines(prev => [...prev, { ...BLANK_LINE }])
  const removeLine = i =>
    setLines(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))

  const resetInvoice = () => {
    setInv({ supplier: "", invoiceNo: "", date: todayISO(), invoiceTotal: "" })
    setLines([{ ...BLANK_LINE }])
    setDelivering(false)
  }

  const submitDelivery = () => {
    if (!inv.supplier.trim()) return flash(true, "Who supplied this?")
    const filled = lines.filter(l => l.product)
    if (!filled.length) return flash(true, "Add at least one product line.")
    for (let i = 0; i < filled.length; i++) {
      if (!Number(filled[i].cartons)) return flash(true, `Line ${i + 1}: how many cartons?`)
      if (!Number(filled[i].unitsPerCarton)) return flash(true, `Line ${i + 1}: how many units in a carton?`)
    }

    recordDelivery({
      supplier: inv.supplier.trim(),
      invoiceNo: inv.invoiceNo.trim(),
      date: inv.date,
      invoiceTotal: statedTotal,
      lines: filled.map(l => ({
        product: l.product,
        cartons: Number(l.cartons),
        unitsPerCarton: Number(l.unitsPerCarton),
        unitCost: Number(l.unitCost) || 0,
      })),
    }).then(d => {
      if (!d.ok) return flash(true, d.error || "Could not save.")
      if (d.mismatch) {
        flash(true,
          `Saved, but the lines add up to ${naira(d.mismatch.computed)} and you entered ${naira(d.mismatch.stated)} — a difference of ${naira(Math.abs(d.mismatch.difference))}. Check the carton counts against the invoice.`)
      } else {
        flash(false, `${d.lines} line(s) recorded — ${d.totalUnits} units, ${naira(d.totalCost)}`)
      }
      resetInvoice()
      refreshDeliveries()
    })
  }

  const submitVoid = () => {
    voidDelivery({
      invoiceNo: voiding.invoiceNo,
      supplier: voiding.supplier,
      date: voiding.date,
      reason: voiding.reason || "",
    }).then(d => {
      if (d.ok) {
        flash(false, `Delivery voided — ${d.voided} line(s) removed from stock.`)
        setVoiding(null)
        refreshDeliveries()
      } else flash(true, d.error || "Could not void.")
    })
  }

  const TABS = [
    { id: "prices", label: "Prices", icon: "bi-tag" },
    { id: "stock", label: "Stock", icon: "bi-boxes" },
    { id: "deliveries", label: "Deliveries", icon: "bi-truck" },
  ]

  const input = "w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3 py-2.5 text-[13px] font-medium text-ink outline-none transition-colors focus:border-cyan focus:bg-white"
  const label = "mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.8px] text-ink-4"

  return (
    <div className="flex min-h-screen">
      <SafeAreaDebug />
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <div className="flex-1 p-3.5 pb-[calc(14px+64px)] md:p-6 md:pb-6">
          <div className="mx-auto w-full max-w-[840px]">

            <div className="mb-5">
              <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-ink">Oil</h1>
              <p className="mt-1 text-[12px] text-ink-4">
                {canCost
                  ? "Selling prices, cost prices, stock and deliveries."
                  : "Selling prices, stock and deliveries. Cost prices are set by the GM."}
              </p>
            </div>

            <div className="mb-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {TABS.map(t => (
                <button
                  key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold transition-all active:scale-95 ${
                    tab === t.id ? "text-white" : "border border-border bg-white text-ink-3 hover:text-ink"
                  }`}
                  style={tab === t.id ? { background: "linear-gradient(135deg,#130656,#179DD0)" } : undefined}
                >
                  <i className={`bi ${t.icon} text-[11px]`} />{t.label}
                </button>
              ))}
            </div>

            {msg && (
              <div className={`enter mb-4 flex items-start gap-2.5 rounded-[14px] border px-4 py-3 ${msg.err ? "border-red/20 bg-red-light" : "border-green/20 bg-green-light"}`}>
                <i className={`bi ${msg.err ? "bi-exclamation-circle-fill text-red" : "bi-check-circle-fill text-green"} mt-px text-[13px]`} />
                <p className={`flex-1 text-[12px] font-semibold ${msg.err ? "text-red" : "text-green"}`}>{msg.text}</p>
                <button type="button" onClick={() => setMsg(null)} className="text-ink-4"><i className="bi bi-x text-[14px]" /></button>
              </div>
            )}

            {/* ── PRICES ─────────────────────────────────────── */}
            {tab === "prices" && (
              <>
                {canPrice && !editing && (
                  <button type="button" onClick={() => { setEditing("new"); setName(""); setSell("") }}
                    className="mb-4 flex w-full items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-border bg-white py-3 text-[12.5px] font-bold text-ink-3 transition-colors hover:border-cyan/40 hover:text-cyan-dark">
                    <i className="bi bi-plus-circle" /> Add an oil product
                  </button>
                )}

                {editing && (
                  <div className="enter mb-4 rounded-panel border border-cyan/25 bg-white p-4 shadow-card">
                    <h2 className="mb-3.5 text-[13px] font-extrabold text-ink">
                      {editing === "new" ? "Add product" : `Selling price · ${editing.product}`}
                    </h2>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="flex-1">
                        <label htmlFor="lp-name" className={label}>Product</label>
                        <input id="lp-name" className={input} value={name} disabled={editing !== "new"}
                          onChange={e => setName(e.target.value)} placeholder="e.g. Mobil Super 1000 20W50 (5L)" />
                      </div>
                      <div className="sm:w-[150px]">
                        <label htmlFor="lp-sell" className={label}>Sells for (₦)</label>
                        <input id="lp-sell" type="number" min="0" inputMode="numeric" className={`${input} mono text-right`}
                          value={sell} onChange={e => setSell(e.target.value)} placeholder="0" />
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={submitSell} disabled={saving}
                        className="flex-1 rounded-[10px] py-2.5 text-[12.5px] font-bold text-white disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg,#130656,#179DD0)" }}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button type="button" onClick={() => setEditing(null)}
                        className="rounded-[10px] border border-border px-5 py-2.5 text-[12.5px] font-bold text-ink-3">Cancel</button>
                    </div>
                  </div>
                )}

                {costing && (
                  <div className="enter mb-4 rounded-panel border border-amber/30 bg-white p-4 shadow-card">
                    <h2 className="mb-1 text-[13px] font-extrabold text-ink">Cost price · {costing.product}</h2>
                    <p className="mb-3.5 text-[11px] text-ink-4">
                      What the station pays per unit, from the supplier invoice. Only you and the owner see this.
                    </p>
                    {/* Stacked on mobile — a fixed 150px field plus two buttons
                        on one line overflows a 375px screen. */}
                    <div>
                      <label htmlFor="lp-cost" className={label}>Cost per unit (₦)</label>
                      <input id="lp-cost" type="number" min="0" inputMode="numeric" className={`${input} mono text-right sm:max-w-[180px]`}
                        value={cost} onChange={e => setCost(e.target.value)} placeholder="0" autoFocus />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={submitCost} disabled={saving}
                        className="flex-1 rounded-[10px] py-2.5 text-[12.5px] font-bold text-white disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg,#130656,#179DD0)" }}>
                        {saving ? "Saving…" : "Save cost"}
                      </button>
                      <button type="button" onClick={() => setCosting(null)}
                        className="rounded-[10px] border border-border px-5 py-2.5 text-[12.5px] font-bold text-ink-3">Cancel</button>
                    </div>
                  </div>
                )}

                <div className="overflow-hidden rounded-panel border border-border bg-white shadow-card">
                  {status === "loading" ? (
                    <div className="space-y-3 p-4">{[0,1,2].map(i => <span key={i} className="skel block h-10 w-full" />)}</div>
                  ) : products.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-amber-light">
                        <i className="bi bi-droplet text-[19px] text-amber" />
                      </div>
                      <p className="text-[13px] font-bold text-ink">No oil products yet</p>
                      <p className="mx-auto mt-1.5 max-w-[300px] text-[11.5px] leading-relaxed text-ink-4">
                        Until something is priced here, cashiers cannot record an oil sale — there is no price for them to sell at.
                      </p>
                    </div>
                  ) : products.map(p => (
                    /* Mobile: name gets its own line, prices wrap beneath it, and
                       the actions drop to a full-width row — three 32px buttons
                       plus a long product name never fit on one line at 375px. */
                    <div key={p.product} className="border-b border-surface px-4 py-3.5 last:border-none transition-colors hover:bg-surface/40">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-amber-light">
                          <i className="bi bi-droplet-fill text-[15px] text-amber" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold leading-snug text-ink">{p.product}</div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                            <span className="mono text-[13px] font-extrabold text-ink">{naira(p.sellPrice)}</span>

                            {seesCost && (
                              p.costPrice ? (
                                <>
                                  <span className="mono text-[11px] text-ink-4">cost {naira(p.costPrice)}</span>
                                  <span className={`mono rounded-full px-1.5 py-[2px] text-[10px] font-extrabold ${
                                    p.margin > 0 ? "bg-green-light text-green" : "bg-red-light text-red"
                                  }`}>
                                    {p.margin > 0 ? "+" : ""}{naira(p.margin)}
                                  </span>
                                </>
                              ) : (
                                <span className="rounded-full bg-amber-light px-2 py-[2px] text-[10px] font-bold text-amber">
                                  No cost set
                                </span>
                              )
                            )}

                            <StockPill stock={p.stock} flag={p.stock < 0 ? "oversold" : p.stock === 0 ? "out" : p.stock <= 5 ? "low" : null} />
                          </div>
                        </div>

                        {/* Desktop: icon buttons alongside. */}
                        <div className="hidden flex-shrink-0 gap-1.5 sm:flex">
                          {canPrice && (
                            <button type="button" onClick={() => { setEditing(p); setName(p.product); setSell(String(p.sellPrice)) }}
                              aria-label={`Change selling price of ${p.product}`}
                              className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-border text-ink-3 transition-colors hover:border-cyan hover:text-cyan-dark active:scale-90">
                              <i className="bi bi-tag text-[13px]" />
                            </button>
                          )}
                          {canCost && (
                            <button type="button" onClick={() => { setCosting(p); setCost(p.costPrice ? String(p.costPrice) : "") }}
                              aria-label={`Set cost price of ${p.product}`}
                              className={`flex h-8 w-8 items-center justify-center rounded-[10px] border transition-colors active:scale-90 ${
                                p.costPrice ? "border-border text-ink-3 hover:border-amber hover:text-amber" : "border-amber/40 bg-amber-light text-amber"
                              }`}>
                              <i className="bi bi-receipt text-[13px]" />
                            </button>
                          )}
                          {canPrice && (
                            <button type="button"
                              onClick={() => {
                                if (window.confirm(`Remove ${p.product}?\n\nIt stops appearing for cashiers. Past sales are kept.`))
                                  removeProduct(p.product).then(d => flash(!d.ok, d.ok ? `${p.product} removed.` : d.error))
                              }}
                              aria-label={`Remove ${p.product}`}
                              className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-border text-ink-4 transition-colors hover:border-red hover:bg-red-light hover:text-red active:scale-90">
                              <i className="bi bi-trash text-[13px]" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mobile: labelled buttons on their own row. Icons alone are
                          ambiguous at this size — "tag" vs "receipt" tells nobody
                          which one sets which price. */}
                      <div className="mt-3 flex gap-2 sm:hidden">
                        {canPrice && (
                          <button type="button" onClick={() => { setEditing(p); setName(p.product); setSell(String(p.sellPrice)) }}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border py-2 text-[11px] font-bold text-ink-3 active:scale-95">
                            <i className="bi bi-tag text-[12px]" /> Price
                          </button>
                        )}
                        {canCost && (
                          <button type="button" onClick={() => { setCosting(p); setCost(p.costPrice ? String(p.costPrice) : "") }}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border py-2 text-[11px] font-bold active:scale-95 ${
                              p.costPrice ? "border-border text-ink-3" : "border-amber/40 bg-amber-light text-amber"
                            }`}>
                            <i className="bi bi-receipt text-[12px]" /> Cost
                          </button>
                        )}
                        {canPrice && (
                          <button type="button"
                            onClick={() => {
                              if (window.confirm(`Remove ${p.product}?\n\nIt stops appearing for cashiers. Past sales are kept.`))
                                removeProduct(p.product).then(d => flash(!d.ok, d.ok ? `${p.product} removed.` : d.error))
                            }}
                            aria-label={`Remove ${p.product}`}
                            className="flex w-11 flex-shrink-0 items-center justify-center rounded-[10px] border border-border text-ink-4 active:scale-95">
                            <i className="bi bi-trash text-[12px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── STOCK ──────────────────────────────────────── */}
            {tab === "stock" && (
              <div className="overflow-hidden rounded-panel border border-border bg-white shadow-card">
                {/* A four-column table cannot survive a 375px phone: the product
                    names here run to "Mobil Super 1000 20W50 (5L)" and three
                    number columns leave nothing for them. So it's a table from
                    sm up, and stacked cards below — same data, no truncation,
                    no horizontal scroll. */}
                <div className="hidden border-b border-surface bg-surface px-4 py-2.5 text-[9.5px] font-extrabold uppercase tracking-[0.8px] text-ink-4 sm:grid sm:grid-cols-[1fr_64px_64px_80px] sm:gap-2">
                  <span>Product</span>
                  <span className="text-right">In</span>
                  <span className="text-right">Sold</span>
                  <span className="text-right">Balance</span>
                </div>

                {status === "loading" ? (
                  <div className="space-y-3 p-4">{[0,1,2].map(i => <span key={i} className="skel block h-10 w-full" />)}</div>
                ) : products.length === 0 ? (
                  <p className="px-4 py-10 text-center text-[12px] text-ink-4">Nothing to show yet.</p>
                ) : (
                  [...products].sort((a,b) => a.stock - b.stock).map(p => {
                    const tone = p.stock < 0 ? "text-red" : p.stock === 0 ? "text-ink-4" : p.stock <= 5 ? "text-amber" : "text-green"
                    return (
                      <div key={p.product} className="border-b border-surface px-4 py-3 last:border-none sm:grid sm:grid-cols-[1fr_64px_64px_80px] sm:items-center sm:gap-2">
                        {/* Mobile: name on its own line so it can breathe */}
                        <div className="mb-2 min-w-0 sm:mb-0">
                          <div className="text-[12.5px] font-bold leading-snug text-ink sm:truncate">{p.product}</div>
                        </div>

                        {/* Mobile: a labelled row of three. Desktop: table cells. */}
                        <div className="flex items-center justify-between gap-3 sm:hidden">
                          <span className="text-[10.5px] text-ink-4">
                            <span className="mono font-bold text-ink-3">{p.received}</span> in
                            <span className="mx-1.5 text-border">·</span>
                            <span className="mono font-bold text-ink-3">{p.sold}</span> sold
                          </span>
                          <span className={`mono text-[14px] font-extrabold tabular-nums ${tone}`}>
                            {p.stock} left
                          </span>
                        </div>

                        <span className="mono hidden text-right text-[12px] tabular-nums text-ink-3 sm:block">{p.received}</span>
                        <span className="mono hidden text-right text-[12px] tabular-nums text-ink-3 sm:block">{p.sold}</span>
                        <span className={`mono hidden text-right text-[13px] font-extrabold tabular-nums sm:block ${tone}`}>{p.stock}</span>
                      </div>
                    )
                  })
                )}

                <p className="border-t border-surface px-4 py-3 text-[10.5px] leading-relaxed text-ink-4">
                  Balance is deliveries minus sales. A negative balance almost always means a delivery wasn&rsquo;t recorded — not that stock went missing.
                </p>
              </div>
            )}

            {/* ── DELIVERIES ─────────────────────────────────── */}
            {tab === "deliveries" && (
              <>
                {canPrice && !delivering && (
                  <button type="button" onClick={() => setDelivering(true)}
                    className="mb-4 flex w-full items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-border bg-white py-3 text-[12.5px] font-bold text-ink-3 transition-colors hover:border-cyan/40 hover:text-cyan-dark">
                    <i className="bi bi-truck" /> Record a delivery
                  </button>
                )}

                {delivering && (
                  <div className="enter mb-4 rounded-panel border border-cyan/25 bg-white shadow-card">
                    <div className="border-b border-surface px-4 py-3.5">
                      <h2 className="text-[13px] font-extrabold text-ink">Oil delivery</h2>
                      <p className="mt-0.5 text-[11px] text-ink-4">
                        One invoice, however many products are on it.
                      </p>
                    </div>

                    {/* Invoice header — entered once, not once per product. */}
                    <div className="grid grid-cols-2 gap-3 border-b border-surface p-4">
                      <div className="col-span-2 sm:col-span-1">
                        <label htmlFor="iv-s" className={label}>Supplier</label>
                        <input id="iv-s" className={input} value={inv.supplier} placeholder="Scarlet &amp; Snow"
                          onChange={e => setInv({ ...inv, supplier: e.target.value })} />
                      </div>
                      <div>
                        <label htmlFor="iv-i" className={label}>Invoice no.</label>
                        <input id="iv-i" className={input} value={inv.invoiceNo} placeholder="002192"
                          onChange={e => setInv({ ...inv, invoiceNo: e.target.value })} />
                      </div>
                      <div>
                        <label htmlFor="iv-d" className={label}>Date</label>
                        <input id="iv-d" type="date" className={input} value={inv.date}
                          onChange={e => setInv({ ...inv, date: e.target.value })} />
                      </div>
                    </div>

                    {/* Product lines */}
                    <div className="p-4">
                      <div className={`${label} mb-2.5`}>Products on this invoice</div>

                      {lines.map((l, i) => (
                        <div key={i} className="mb-3 rounded-[12px] border border-border bg-surface/40 p-3 last:mb-0">
                          <div className="mb-2.5 flex items-center gap-2">
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[8px] bg-white text-[10px] font-extrabold text-ink-4">
                              {i + 1}
                            </span>
                            <select
                              aria-label={`Product for line ${i + 1}`}
                              className="min-w-0 flex-1 rounded-[10px] border-[1.5px] border-border bg-white px-3 py-2 text-[12.5px] font-medium text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-cyan focus:ring-[3px] focus:ring-cyan/15"
                              value={l.product} onChange={e => setLine(i, "product", e.target.value)}
                            >
                              <option value="">Select product…</option>
                              {products.map(p => <option key={p.product} value={p.product}>{p.product}</option>)}
                            </select>
                            {lines.length > 1 && (
                              <button type="button" onClick={() => removeLine(i)} aria-label={`Remove line ${i + 1}`}
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] border border-[#FECACA] bg-red-light text-red active:scale-90">
                                <i className="bi bi-trash text-[12px]" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="mb-1 block text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Cartons</label>
                              <input type="number" min="0" inputMode="numeric" placeholder="20"
                                aria-label={`Cartons for line ${i + 1}`}
                                className="mono w-full rounded-[8px] border-[1.5px] border-border bg-white px-2 py-2 text-right text-[12.5px] font-bold text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-cyan focus:ring-[3px] focus:ring-cyan/15"
                                value={l.cartons} onChange={e => setLine(i, "cartons", e.target.value)} />
                            </div>
                            <div>
                              <label className="mb-1 block text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Units/ctn</label>
                              <input type="number" min="0" inputMode="numeric" placeholder="4"
                                aria-label={`Units per carton for line ${i + 1}`}
                                className="mono w-full rounded-[8px] border-[1.5px] border-border bg-white px-2 py-2 text-right text-[12.5px] font-bold text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-cyan focus:ring-[3px] focus:ring-cyan/15"
                                value={l.unitsPerCarton} onChange={e => setLine(i, "unitsPerCarton", e.target.value)} />
                            </div>
                            <div>
                              <label className="mb-1 block text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">₦/unit</label>
                              <input type="number" min="0" inputMode="numeric" placeholder="23700"
                                aria-label={`Cost per unit for line ${i + 1}`}
                                className="mono w-full rounded-[8px] border-[1.5px] border-border bg-white px-2 py-2 text-right text-[12.5px] font-bold text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-cyan focus:ring-[3px] focus:ring-cyan/15"
                                value={l.unitCost} onChange={e => setLine(i, "unitCost", e.target.value)} />
                            </div>
                          </div>

                          {lineUnits(l) > 0 && (
                            <div className="mono mt-2 text-right text-[11px] font-bold text-ink-4">
                              {lineUnits(l)} units{lineCost(l) > 0 ? ` · ${naira(lineCost(l))}` : ""}
                            </div>
                          )}
                        </div>
                      ))}

                      <button type="button" onClick={addLine}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-border py-2.5 text-[12px] font-bold text-ink-3 hover:border-cyan/40 hover:text-cyan-dark">
                        <i className="bi bi-plus-circle" /> Add another product
                      </button>
                    </div>

                    {/* Invoice total check */}
                    <div className="border-t border-surface bg-surface/50 p-4">
                      <div className="mb-3 flex flex-wrap items-end gap-3">
                        <div className="min-w-[140px] flex-1">
                          <label htmlFor="iv-t" className={label}>Invoice total (₦)</label>
                          <input id="iv-t" type="number" min="0" inputMode="numeric" placeholder="From the paper"
                            className={`${input} mono text-right`}
                            value={inv.invoiceTotal} onChange={e => setInv({ ...inv, invoiceTotal: e.target.value })} />
                        </div>
                        <div className="text-right">
                          <div className="text-[9.5px] font-bold uppercase tracking-[0.7px] text-ink-4">These lines</div>
                          <div className="mono mt-1 text-[15px] font-extrabold text-ink">{naira(computedTotal)}</div>
                        </div>
                      </div>

                      {mismatch !== 0 && (
                        <div className="mb-3 flex items-start gap-2 rounded-[10px] border border-amber/30 bg-amber-light px-3 py-2.5">
                          <i className="bi bi-exclamation-triangle-fill mt-px text-[12px] text-amber" />
                          <p className="text-[11px] leading-relaxed text-ink-2">
                            Off by <strong>{naira(Math.abs(mismatch))}</strong>. Usually a carton count —
                            check each line against the invoice. You can still save.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button type="button" onClick={submitDelivery} disabled={saving}
                          className="flex-1 rounded-[10px] py-2.5 text-[12.5px] font-bold text-white disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg,#130656,#179DD0)" }}>
                          {saving ? "Saving…" : "Record delivery"}
                        </button>
                        <button type="button" onClick={resetInvoice}
                          className="rounded-[10px] border border-border px-5 py-2.5 text-[12.5px] font-bold text-ink-3">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                {voiding && (
                  <div className="enter mb-4 rounded-panel border border-red/25 bg-white p-4 shadow-card">
                    <h2 className="text-[13px] font-extrabold text-ink">
                      Void {voiding.invoiceNo ? `invoice #${voiding.invoiceNo}` : `${voiding.supplier} · ${voiding.date}`}?
                    </h2>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-4">
                      The record stays as history, but stops counting toward stock. Re-enter the
                      delivery correctly afterwards.
                    </p>
                    <input className={`${input} mt-3`} placeholder="Why? (e.g. wrong carton count)"
                      aria-label="Reason for voiding"
                      value={voiding.reason || ""} onChange={e => setVoiding({ ...voiding, reason: e.target.value })} />
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={submitVoid} disabled={saving}
                        className="flex-1 rounded-[10px] bg-red py-2.5 text-[12.5px] font-bold text-white disabled:opacity-50">
                        {saving ? "Voiding…" : "Void delivery"}
                      </button>
                      <button type="button" onClick={() => setVoiding(null)}
                        className="rounded-[10px] border border-border px-5 py-2.5 text-[12.5px] font-bold text-ink-3">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Grouped by invoice — one Scarlet & Snow drop is seven rows in
                    the sheet but ONE delivery in the real world. */}
                <div className="space-y-3">
                  {delStatus === "loading" ? (
                    [0,1].map(i => <span key={i} className="skel block h-20 w-full rounded-panel" />)
                  ) : deliveries.length === 0 ? (
                    <div className="rounded-panel border border-border bg-white px-4 py-10 text-center shadow-card">
                      <p className="text-[12px] text-ink-4">No deliveries recorded yet.</p>
                    </div>
                  ) : deliveries.map(d => (
                    <div key={d.key} className="overflow-hidden rounded-panel border border-border bg-white shadow-card">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-surface px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-extrabold text-ink">{d.supplier}</span>
                            {d.invoiceNo && (
                              <span className="mono rounded-full bg-surface px-2 py-[2px] text-[10px] font-bold text-ink-4">
                                #{d.invoiceNo}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[10.5px] text-ink-4">
                            {d.date} · {d.lines.length} product{d.lines.length === 1 ? "" : "s"}
                            {d.receivedBy ? ` · ${d.receivedBy}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="text-right">
                            <div className="mono text-[13px] font-extrabold text-ink">{d.totalUnits} units</div>
                            {seesCost && d.totalCost > 0 && (
                              <div className="mono mt-0.5 text-[10px] text-ink-4">{naira(d.totalCost)}</div>
                            )}
                          </div>
                          {canVoid && (
                            <button type="button"
                              onClick={() => setVoiding({ invoiceNo: d.invoiceNo, supplier: d.supplier, date: d.date, reason: "" })}
                              aria-label="Void this delivery"
                              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border border-border text-ink-4 hover:border-red hover:bg-red-light hover:text-red active:scale-90">
                              <i className="bi bi-x-lg text-[12px]" />
                            </button>
                          )}
                        </div>
                      </div>

                      {d.lines.map((l, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 border-b border-surface px-4 py-2.5 last:border-none">
                          <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-ink-2">{l.product}</span>
                          <span className="mono flex-shrink-0 text-[11px] text-ink-4">
                            {l.cartons}×{l.unitsPerCarton}
                          </span>
                          <span className="mono w-[62px] flex-shrink-0 text-right text-[12px] font-bold text-ink">
                            {l.units}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <BottomNav homePath={dashboardPathFor({ role: auth.role, station: auth.station })} />
    </div>
  )
}
