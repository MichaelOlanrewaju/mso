import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ToastProvider } from "../components/layout/ToastProvider"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useDashboardData } from "../hooks/useDashboardData"
import { useCashupData } from "../hooks/useCashupData"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, initials } from "../utils/format"

const HERO_STYLES = {
  pending: { bg: "linear-gradient(135deg, #06091A, #0D1226)", label: "Pending Cashup", sub: "Waiting for supervisor to submit dip readings" },
  balanced: { bg: "linear-gradient(135deg, #15803D, #22C55E)", label: "Balanced ✓", sub: "Within ₦500 tolerance" },
  short: { bg: "linear-gradient(135deg, #991B1B, #DC2626)", label: "SHORT", sub: "Collection is less than expected" },
  over: { bg: "linear-gradient(135deg, #B45309, #D97706)", label: "OVER", sub: "Collection exceeds expected" },
}

const QUICK_ACTIONS = [
  { icon: "bi-check2-all", bg: "#F0FDF4", color: "#16A34A", label: "Enter Reconciliation", to: "/cashup-mso" },
  { icon: "bi-receipt-cutoff", bg: "#FEF2F2", color: "#DC2626", label: "Add Expense", to: "/expenses-mso" },
  { icon: "bi-exclamation-triangle", bg: "#FFF1F2", color: "#DC2626", label: "Report Shortage", to: "/shortage-mso" },
  { icon: "bi-chat-dots", bg: "#F5F3FF", color: "#6D28D9", label: "Staff Chat", to: "/chat-mso" },
  { icon: "bi-printer", bg: "#F8FAFC", color: "#64748B", label: "Daily Summary", to: "/summary-mso" },
]

function CashierInner() {
  const auth = useAuth({ requireAuth: true })
  const { data, loading, refresh } = useDashboardData(auth.username)
  const { lpgKg, setLpgKg, lpgPrice, setLpgPrice, lpgRemitted, setLpgRemitted, lpgSales, lpgVariance } = useCashupData(auth.username)
  const navigate = useNavigate()
  usePageTitle("Cashier — MSO Limpid")

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }

  const gt = Number(data?.grandTotal || 0)
  const posMP = Number(data?.posMP || 0)
  const posZM = Number(data?.posZM || 0)
  const cash = Number(data?.cash || 0)
  const expenses = Number(data?.expenses || 0)
  const mpCharge = Number(data?.posMPCharge || Math.round(posMP * 0.0025))
  const zmCharge = Number(data?.posZMCharge || Math.round(posZM * 0.003))
  const mpNet = posMP - mpCharge
  const zmNet = posZM - zmCharge
  const gross = posMP + posZM + cash
  const totalCharges = mpCharge + zmCharge
  const toBank = Math.max(0, cash - expenses - totalCharges)
  const collected = mpNet + zmNet + cash - expenses
  const variance = collected - gt

  const hasAnyPayment = posMP > 0 || posZM > 0 || cash > 0
  let heroStatus = "pending"
  if (gt > 0 && hasAnyPayment) {
    if (Math.abs(variance) <= 500) heroStatus = "balanced"
    else if (variance < 0) heroStatus = "short"
    else heroStatus = "over"
  }
  const hero = HERO_STYLES[heroStatus]

  return (
    <div className="min-h-screen bg-pagebg pb-[100px]">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[200] flex items-center justify-between gap-3 border-b border-border bg-white px-4 pb-2.5 shadow-[0_1px_4px_rgba(0,0,0,.04)]" style={{ paddingTop: "max(var(--sat), 52px)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-extrabold text-white" style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}>
            {initials(auth.name || auth.username)}
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-ink">{auth.name || auth.username}</div>
            <div className="text-[10px] text-ink-4">Cashier · MSO</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-medium text-ink-3">{new Date().toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}</div>
          <button type="button" onClick={refresh} className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-3">
            <i className={`bi bi-arrow-clockwise ${loading ? "animate-spin-fast" : ""}`} />
          </button>
          <button type="button" onClick={auth.logout} className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface text-red">
            <i className="bi bi-box-arrow-right" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[540px] px-4 py-4">
        <div className="relative mb-4 overflow-hidden rounded-[18px] p-5" style={{ background: hero.bg }}>
          <div className="relative z-[1] mb-2 text-[10px] font-bold uppercase tracking-[1.5px] text-white/50">Today's Reconciliation</div>
          <div className="relative z-[1] mb-1 text-[22px] font-black tracking-tight text-white">{gt > 0 ? hero.label : "Awaiting Data"}</div>
          <div className="relative z-[1] text-[12px] text-white/55">{gt > 0 ? hero.sub : "Waiting for supervisor to submit dip readings"}</div>
          <div className="relative z-[1] mt-4 grid grid-cols-3 gap-2.5">
            <div>
              <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.8px] text-white/40">Expected</div>
              <div className="mono text-[15px] font-extrabold text-white">{gt > 0 ? naira(gt) : "₦—"}</div>
            </div>
            <div>
              <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.8px] text-white/40">Collected</div>
              <div className="mono text-[15px] font-extrabold text-white">{gt > 0 ? naira(collected) : "₦—"}</div>
            </div>
            <div>
              <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.8px] text-white/40">Variance</div>
              <div className="mono text-[15px] font-extrabold text-white">{gt > 0 ? `${variance >= 0 ? "+" : ""}${naira(Math.abs(variance))}` : "₦—"}</div>
            </div>
          </div>
        </div>

        <div className="mb-1.5 mt-5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Today's Collections</div>
        <div className="mb-3.5 overflow-hidden rounded-card border border-border bg-white shadow-card">
          <div className="border-b border-surface bg-surface px-4 py-3 text-[13px] font-extrabold text-ink">Payment Breakdown</div>
          <div className="p-4">
            <div className="flex items-center justify-between border-b border-surface py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: "#1188B5" }} />
                <div>
                  <div className="text-[13px] font-semibold text-ink">POS — MP Terminal</div>
                  <div className="text-[10.5px] text-ink-4">0.25% charge applies</div>
                </div>
              </div>
              <div className="text-right">
                <div className="mono text-[14px] font-extrabold text-ink">{hasAnyPayment ? naira(posMP) : "₦—"}</div>
                <div className="mono text-[10px] text-red">{hasAnyPayment ? `Charge: ${naira(mpCharge)}` : ""}</div>
                <div className="mono text-[11px] text-green">{hasAnyPayment ? `Net: ${naira(mpNet)}` : ""}</div>
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-surface py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: "#7C3AED" }} />
                <div>
                  <div className="text-[13px] font-semibold text-ink">POS — ZM Terminal</div>
                  <div className="text-[10.5px] text-ink-4">0.30% charge applies</div>
                </div>
              </div>
              <div className="text-right">
                <div className="mono text-[14px] font-extrabold text-ink">{hasAnyPayment ? naira(posZM) : "₦—"}</div>
                <div className="mono text-[10px] text-red">{hasAnyPayment ? `Charge: ${naira(zmCharge)}` : ""}</div>
                <div className="mono text-[11px] text-green">{hasAnyPayment ? `Net: ${naira(zmNet)}` : ""}</div>
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: "#16A34A" }} />
                <div>
                  <div className="text-[13px] font-semibold text-ink">Cash</div>
                  <div className="text-[10.5px] text-ink-4">Physical cash collected</div>
                </div>
              </div>
              <div className="mono text-[14px] font-extrabold text-ink">{hasAnyPayment ? naira(cash) : "₦—"}</div>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5">
              <span className="text-[11.5px] font-semibold text-ink-3">Gross Total</span>
              <span className="mono text-[15px] font-extrabold text-ink">{hasAnyPayment ? naira(gross) : "₦—"}</span>
            </div>
          </div>
        </div>

        <div className="mb-3.5 flex items-center justify-between rounded-[12px] border border-[#FECACA] bg-red-light px-4 py-3">
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-red">
            <i className="bi bi-dash-circle-fill" /> Total POS Charges Deducted
          </span>
          <span className="mono text-[15px] font-extrabold text-red">{hasAnyPayment ? naira(totalCharges) : "₦—"}</span>
        </div>

        <div className="mb-3.5 overflow-hidden rounded-card border border-border bg-white shadow-card">
          <div className="border-b border-surface bg-surface px-4 py-3 text-[13px] font-extrabold text-ink">Expenses</div>
          <div className="p-4">
            {expenses > 0 ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px] bg-red" />
                  <div className="text-[13px] font-semibold text-ink">Total Expenses</div>
                </div>
                <div className="mono text-[14px] font-extrabold text-red">{naira(expenses)}</div>
              </div>
            ) : (
              <div className="py-3.5 text-center text-[12.5px] text-ink-4">
                <i className="mb-1.5 block text-[22px] opacity-30 bi bi-check-circle" />
                No expenses recorded
              </div>
            )}
          </div>
        </div>

        <div className="mb-5 rounded-card border-2 border-[#BBF7D0] bg-green-light p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1px] text-green">
            <i className="bi bi-safe" /> Cash to Bank
          </div>
          <div className="mono text-[28px] font-black tracking-tight text-green">{hasAnyPayment ? naira(toBank) : "₦—"}</div>
          <div className="mt-1 text-[11px] text-ink-3">Cash − Expenses − POS charges</div>
        </div>

        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">LPG Report</div>
        <div className="mb-5 overflow-hidden rounded-card border border-border bg-white shadow-card">
          <div className="border-b border-surface bg-surface px-4 py-3 text-[13px] font-extrabold text-ink">Gas Sales Today</div>
          <div className="p-4">
            <div className="mb-2.5 grid grid-cols-2 gap-2.5">
              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Total KG</div>
                <input
                  type="number" placeholder="0.0" min="0" step="0.1" value={lpgKg} onChange={e => setLpgKg(e.target.value)}
                  className="mono w-full rounded-[9px] border-[1.5px] border-border bg-surface px-2.5 py-2.5 text-[15px] font-bold text-ink outline-none focus:border-cyan focus:bg-white"
                />
              </div>
              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Unit Price (₦/kg)</div>
                <input
                  type="number" placeholder="1250" min="0" step="1" value={lpgPrice} onChange={e => setLpgPrice(e.target.value)}
                  className="mono w-full rounded-[9px] border-[1.5px] border-border bg-surface px-2.5 py-2.5 text-[15px] font-bold text-ink outline-none focus:border-cyan focus:bg-white"
                />
              </div>
              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Total Sales</div>
                <input
                  type="number" placeholder="auto" readOnly value={lpgSales > 0 ? Math.round(lpgSales) : ""}
                  className="mono w-full rounded-[9px] border-[1.5px] border-cyan/25 bg-cyan-light px-2.5 py-2.5 text-[15px] font-bold text-cyan-dark outline-none"
                />
              </div>
              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.8px] text-ink-4">Amount Remitted</div>
                <input
                  type="number" placeholder="0" min="0" step="1" value={lpgRemitted} onChange={e => setLpgRemitted(e.target.value)}
                  className="mono w-full rounded-[9px] border-[1.5px] border-border bg-surface px-2.5 py-2.5 text-[15px] font-bold text-ink outline-none focus:border-cyan focus:bg-white"
                />
              </div>
            </div>
            <div
              className="flex items-center justify-between rounded-[10px] px-3.5 py-2.5"
              style={{
                background: lpgVariance === null ? "#F8FAFC" : Math.abs(lpgVariance) <= 100 ? "#F0FDF4" : lpgVariance < 0 ? "#FEF2F2" : "#FFFBEB",
                border: `1px solid ${lpgVariance === null ? "#E8EDF5" : Math.abs(lpgVariance) <= 100 ? "#BBF7D0" : lpgVariance < 0 ? "#FECACA" : "#FDE68A"}`,
              }}
            >
              <span className="text-[12px] font-semibold text-ink-3">LPG Variance</span>
              <span
                className="mono text-[14px] font-extrabold"
                style={{ color: lpgVariance === null ? "#94A3B8" : Math.abs(lpgVariance) <= 100 ? "#16A34A" : lpgVariance < 0 ? "#DC2626" : "#D97706" }}
              >
                {lpgVariance === null ? "₦—" : `${lpgVariance >= 0 ? "+" : ""}${naira(Math.abs(lpgVariance))}`}
              </span>
            </div>
            <div className="mt-2.5 text-center text-[10.5px] text-ink-4">LPG figures are saved together with your cash reconciliation</div>
          </div>
        </div>

        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Actions</div>
        <div className="mb-5 grid grid-cols-2 gap-2.5">
          {QUICK_ACTIONS.map(qa => (
            <button
              key={qa.label}
              type="button"
              onClick={() => navigate(qa.to)}
              className="flex flex-col items-center gap-2 rounded-[13px] border border-border bg-white p-3.5 text-center shadow-card"
            >
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px]" style={{ background: qa.bg }}>
                <i className={`bi ${qa.icon}`} style={{ color: qa.color }} />
              </div>
              <span className="text-[12.5px] font-bold text-ink">{qa.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="fixed bottom-[66px] left-0 right-0 z-[300] border-t border-border bg-white/90 px-4 py-2.5 backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate("/cashup-mso")}
          className="mx-auto flex h-[52px] w-full max-w-[540px] items-center justify-center gap-2 rounded-[13px] bg-green text-[15px] font-extrabold text-white shadow-[0_4px_18px_rgba(22,163,74,.3)]"
        >
          <i className="bi bi-shield-check" /> Submit Cash Reconciliation
        </button>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-[700] flex justify-around px-1 py-1.5 shadow-[0_-2px_14px_rgba(0,0,0,.07)]"
        style={{ paddingBottom: "calc(7px + var(--sab))", background: "#fff", borderTop: "1px solid #E8EDF5" }}
      >
        <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] border border-cyan/[0.18] bg-cyan-light px-2.5 py-[5px] text-[9.5px] font-semibold text-cyan">
          <i className="bi bi-grid-1x2-fill text-xl" /> Home
        </button>
        <button type="button" onClick={() => navigate("/cashup-mso")} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] px-2.5 py-[5px] text-[9.5px] font-semibold text-ink-4">
          <i className="bi bi-cash-coin text-xl" /> Cashup
        </button>
        <button type="button" onClick={() => navigate("/expenses-mso")} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] px-2.5 py-[5px] text-[9.5px] font-semibold text-ink-4">
          <i className="bi bi-receipt-cutoff text-xl" /> Expenses
        </button>
        <button type="button" onClick={() => navigate("/chat-mso")} className="flex flex-1 flex-col items-center gap-[3px] rounded-[10px] px-2.5 py-[5px] text-[9.5px] font-semibold text-ink-4">
          <i className="bi bi-chat-dots text-xl" /> Chat
        </button>
      </nav>
    </div>
  )
}

export default function CashierDashboardPage() {
  return (
    <ToastProvider>
      <CashierInner />
    </ToastProvider>
  )
}
