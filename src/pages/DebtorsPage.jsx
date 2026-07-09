import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira } from "../utils/format"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

function getAPI(action, extra = {}) {
  if (!SCRIPT_URL) return Promise.resolve({ ok: false })
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", action)
  url.searchParams.set("station", STATION_KEY)
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url.toString(), { method: "GET", redirect: "follow" }).then(r => r.json())
}

export default function DebtorsPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle("Debtors — MSO Limpid")
  const [debtors, setDebtors] = useState([])
  const [totalOutstanding, setTotalOutstanding] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [tab, setTab] = useState("list")
  const [filter, setFilter] = useState("OUTSTANDING")
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], customerName: "", customerPhone: "", amount: "", product: "", litres: "", dueDate: "", notes: "" })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getAPI("getDebtors")
    if (res.ok) { setDebtors(res.debtors || []); setTotalOutstanding(res.totalOutstanding || 0) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  const handleSave = async () => {
    if (!form.customerName || !form.amount) { setFeedback({ ok: false, text: "Customer name and amount are required." }); return }
    setSaving(true); setFeedback(null)
    const res = await getAPI("saveDebtor", { ...form, username: auth.username })
    setSaving(false)
    if (res.ok) { setFeedback({ ok: true, text: "Debt recorded." }); load(); setTab("list"); setForm({ date: new Date().toISOString().split("T")[0], customerName: "", customerPhone: "", amount: "", product: "", litres: "", dueDate: "", notes: "" }) }
    else setFeedback({ ok: false, text: res.error || "Save failed." })
  }

  const handleSettle = async (rowIndex, name) => {
    if (!window.confirm(`Mark debt from ${name} as settled?`)) return
    const res = await getAPI("settleDebtor", { rowIndex, username: auth.username })
    if (res.ok) { load() } else alert(res.error || "Failed.")
  }

  const visible = debtors.filter(d => filter === "ALL" || d.Status === filter)
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
            <div className="text-[16px] font-extrabold text-ink">Debtors</div>
            <div className="text-[10px] text-ink-4">Outstanding: <span className="font-bold text-red">{naira(totalOutstanding)}</span></div>
          </div>
        </div>
        <div className="flex border-t border-border">
          {[["list","Debtor List"],["new","Add Debt"]].map(([k,l])=>(
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
            {/* Summary */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-[12px] bg-white p-3.5 shadow-sm">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Total Outstanding</div>
                <div className="mono text-[18px] font-extrabold text-red">{naira(totalOutstanding)}</div>
              </div>
              <div className="rounded-[12px] bg-white p-3.5 shadow-sm">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">Open Debts</div>
                <div className="mono text-[18px] font-extrabold text-ink">{debtors.filter(d=>d.Status==="OUTSTANDING").length}</div>
              </div>
            </div>
            {/* Filter */}
            <div className="mb-3 flex gap-2">
              {[["OUTSTANDING","Outstanding"],["SETTLED","Settled"],["ALL","All"]].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setFilter(v)}
                  className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${filter===v?"bg-navy text-white":"border border-border bg-white text-ink-4"}`}>{l}</button>
              ))}
            </div>
            {loading && <div className="flex justify-center py-10"><span className="h-5 w-5 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" /></div>}
            {!loading && visible.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-[16px] bg-white py-14 text-center shadow-sm">
                <i className="bi bi-person-check text-4xl text-ink-4" />
                <div className="text-[14px] font-bold text-ink">No {filter.toLowerCase()} debts</div>
              </div>
            )}
            <div className="space-y-3">
              {visible.map((d,i)=>(
                <div key={i} className="overflow-hidden rounded-[14px] bg-white shadow-sm">
                  <div className="flex items-start justify-between px-4 py-3">
                    <div>
                      <div className="text-[13.5px] font-bold text-ink">{d.CustomerName}</div>
                      <div className="text-[10.5px] text-ink-4">{d.Date}{d.CustomerPhone ? ` · ${d.CustomerPhone}` : ""}</div>
                      {d.Product && <div className="mt-0.5 text-[10.5px] text-ink-4">{d.Product}{d.Litres ? ` · ${d.Litres}L` : ""}</div>}
                    </div>
                    <div className="text-right">
                      <div className="mono text-[15px] font-extrabold text-red">{naira(d.Amount)}</div>
                      <span className={`text-[9.5px] font-bold ${d.Status==="SETTLED"?"text-green":"text-amber"}`}>{d.Status}</span>
                    </div>
                  </div>
                  {d.Status === "OUTSTANDING" && (auth.isGM || auth.isOwner) && (
                    <button type="button" onClick={()=>handleSettle(d.rowIndex, d.CustomerName)}
                      className="flex w-full items-center justify-center gap-2 border-t border-surface py-2.5 text-[12px] font-bold text-green">
                      <i className="bi bi-check2" /> Mark as Settled
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "new" && (
          <div className="rounded-[16px] bg-white p-5 shadow-sm space-y-3">
            <div className="text-[13.5px] font-bold text-ink mb-1">Record a Debt</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Date</span>
                <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Due Date</span>
                <input type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} className={inputCls} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Customer Name</span>
              <input type="text" value={form.customerName} onChange={e=>setForm(f=>({...f,customerName:e.target.value}))} placeholder="Full name" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Phone Number</span>
              <input type="text" value={form.customerPhone} onChange={e=>setForm(f=>({...f,customerPhone:e.target.value}))} placeholder="08012345678" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Amount Owed (₦)</span>
              <input type="number" inputMode="decimal" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0" className={inputCls+" font-bold"} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Product</span>
                <input type="text" value={form.product} onChange={e=>setForm(f=>({...f,product:e.target.value}))} placeholder="PMS / AGO" className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Litres</span>
                <input type="number" inputMode="decimal" value={form.litres} onChange={e=>setForm(f=>({...f,litres:e.target.value}))} placeholder="0" className={inputCls} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Notes</span>
              <textarea rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className={inputCls+" resize-none"} />
            </label>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 text-[14px] font-bold text-white shadow-lift disabled:opacity-60"
              style={{ background:"linear-gradient(135deg,#DC2626,#B91C1C)" }}>
              {saving?<span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white"/>:<><i className="bi bi-person-fill-exclamation"/>Record Debt</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
