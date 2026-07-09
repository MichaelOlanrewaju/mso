import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"
const PRODUCTS = ["PMS (Petrol)", "AGO (Diesel)", "DPK (Kerosene)"]
const STATUSES = ["PENDING","ORDERED","IN_TRANSIT","DELIVERED","CANCELLED"]

function getAPI(action, extra = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false })
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", action)
  url.searchParams.set("station", STATION_KEY)
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
}

const STATUS_STYLE = { PENDING:"bg-surface text-ink-4", ORDERED:"bg-cyan-light text-cyan-dark", IN_TRANSIT:"bg-amber-light text-amber", DELIVERED:"bg-green-light text-green", CANCELLED:"bg-red-light text-red" }

export default function OrdersPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle("Orders — MSO Limpid")
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [tab, setTab] = useState("list")
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], product: "", quantityOrdered: "", supplier: "", expectedDelivery: "", notes: "" })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getAPI("getOrders")
    if (res.ok) setOrders(res.orders || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  const handleSave = async () => {
    if (!form.product) { setFeedback({ ok: false, text: "Product is required." }); return }
    setSaving(true); setFeedback(null)
    const res = await getAPI("saveOrder", { ...form, username: auth.username })
    setSaving(false)
    if (res.ok) { setFeedback({ ok: true, text: "Order recorded." }); load(); setTab("list") }
    else setFeedback({ ok: false, text: res.error || "Save failed." })
  }

  const handleStatus = async (rowIndex, status) => {
    const res = await getAPI("updateOrderStatus", { rowIndex, status, username: auth.username })
    if (res.ok) load()
  }

  const inputCls = "w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-cyan"

  return (
    <div className="min-h-screen bg-pagebg pb-16">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[200] border-b border-border bg-white shadow-sm" style={{ paddingTop: "max(var(--sat),52px)" }}>
        <div className="flex items-center gap-3 px-4 pb-2.5">
          <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">Stock Orders</div>
            <div className="text-[10px] text-ink-4">Order tracking — MSO Limpid</div>
          </div>
        </div>
        <div className="flex border-t border-border">
          {[["list","Orders"],["new","Place Order"]].map(([k,l])=>(
            <button key={k} type="button" onClick={()=>setTab(k)}
              className={`flex-1 py-2.5 text-[12.5px] font-bold ${tab===k?"border-b-2 border-navy text-navy":"text-ink-4"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        {feedback && (
          <div className={`mb-4 flex items-center gap-2 rounded-[11px] border px-4 py-3 text-[13px] font-semibold ${feedback.ok?"border-green/20 bg-green-light text-green":"border-red/20 bg-red-light text-red"}`}>
            <i className={`bi ${feedback.ok?"bi-check-circle-fill":"bi-exclamation-circle-fill"}`} />
            <span className="flex-1">{feedback.text}</span>
            <button type="button" onClick={()=>setFeedback(null)}><i className="bi bi-x-lg text-[11px] opacity-40" /></button>
          </div>
        )}

        {tab === "list" && (
          <>
            {loading && <div className="flex justify-center py-10"><span className="h-5 w-5 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan"/></div>}
            {!loading && orders.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-[16px] bg-white py-14 text-center shadow-sm">
                <i className="bi bi-box text-4xl text-ink-4" />
                <div className="text-[14px] font-bold text-ink">No orders yet</div>
              </div>
            )}
            <div className="space-y-3">
              {orders.map((o,i)=>(
                <div key={i} className="overflow-hidden rounded-[14px] bg-white shadow-sm">
                  <div className="flex items-start justify-between px-4 py-3">
                    <div>
                      <div className="text-[13.5px] font-bold text-ink">{o.Product}</div>
                      <div className="text-[10.5px] text-ink-4">{o.Date} · {o.Supplier || "No supplier"}</div>
                      {o.QuantityOrdered && <div className="mt-0.5 text-[10.5px] text-ink-4">{Number(o.QuantityOrdered).toLocaleString("en-NG")}L ordered</div>}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${STATUS_STYLE[o.Status]||"bg-surface text-ink-4"}`}>{o.Status}</span>
                  </div>
                  {(auth.isGM || auth.isOwner) && o.Status !== "DELIVERED" && o.Status !== "CANCELLED" && (
                    <div className="flex border-t border-surface">
                      {["IN_TRANSIT","DELIVERED","CANCELLED"].filter(s => s !== o.Status).map(s => (
                        <button key={s} type="button" onClick={() => handleStatus(o.rowIndex, s)}
                          className="flex-1 py-2 text-[10.5px] font-semibold text-ink-4 border-r border-surface last:border-r-0">
                          → {s.replace("_"," ")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "new" && (
          <div className="rounded-[16px] bg-white p-5 shadow-sm space-y-3">
            <div className="text-[13.5px] font-bold text-ink mb-1">Place a Stock Order</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Date</span>
                <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Expected Delivery</span>
                <input type="date" value={form.expectedDelivery} onChange={e=>setForm(f=>({...f,expectedDelivery:e.target.value}))} className={inputCls} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Product</span>
              <select value={form.product} onChange={e=>setForm(f=>({...f,product:e.target.value}))} className={inputCls}>
                <option value="">Select…</option>
                {PRODUCTS.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Quantity (Litres)</span>
              <input type="number" inputMode="decimal" value={form.quantityOrdered} onChange={e=>setForm(f=>({...f,quantityOrdered:e.target.value}))} placeholder="0" className={inputCls+" font-bold"} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Supplier</span>
              <input type="text" value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} placeholder="Supplier name" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Notes</span>
              <textarea rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className={inputCls+" resize-none"} />
            </label>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 text-[14px] font-bold text-white shadow-lift disabled:opacity-60"
              style={{ background:"linear-gradient(135deg,#130656,#1a0875)" }}>
              {saving?<span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white"/>:<><i className="bi bi-box-arrow-in-down"/>Place Order</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
