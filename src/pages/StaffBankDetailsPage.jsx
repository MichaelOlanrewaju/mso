import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { getStation } from "../config/stations"
import { activeStation } from "../utils/station"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

function initials(name) {
  return (name || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
}
const AVATAR_COLORS = ["var(--brand-accent)", "#06091A", "#16A34A", "#DC2626", "#7C3AED"]
function avatarBg(name) {
  return AVATAR_COLORS[(name || " ").charCodeAt(0) % AVATAR_COLORS.length]
}

export default function StaffBankDetailsPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle(`Staff Bank Details — ${getStation(activeStation()).name}`)

  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState(null)

  useEffect(() => {
    if (!auth.username || !SCRIPT_URL) return
    setLoading(true)
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getStaffBankDetails")
    url.searchParams.set("username", auth.username)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => { if (d.ok) setStaff(d.staff || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [auth.username])

  // Same CEO/GM/Owner-only gate as Admin Dashboard, blocked at the page
  // level, not just by hiding a link to it — a direct URL visit is
  // stopped the same way a missing tile would be.
  const isAdmin = ["ceo", "owner", "gm"].includes(auth.role)
  if (!auth.loading && !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-pagebg p-6 text-center">
        <i className="bi bi-shield-lock text-4xl text-ink-4" />
        <div className="text-[15px] font-bold text-ink">CEO/Owner/GM Only</div>
        <div className="text-[13px] text-ink-4">This page isn't available for your role.</div>
        <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="mt-2 rounded-full bg-navy px-4 py-2 text-[13px] font-bold text-white">
          Back to Dashboard
        </button>
      </div>
    )
  }
  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  const copyToClipboard = (text, key) => {
    navigator.clipboard?.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const missingCount = staff.filter(s => !s.accountNumber).length

  return (
    <div className="min-h-screen bg-pagebg pb-8">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-white px-4 py-3.5">
        <button type="button"
          onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2">
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-extrabold text-ink">Staff Bank Details</div>
          <div className="text-[10px] text-ink-4">For salary payment · Supervisor &amp; Cashier</div>
        </div>
      </div>

      <div className="mx-auto max-w-[560px] px-4 py-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <span className="h-5 w-5 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
          </div>
        ) : staff.length === 0 ? (
          <div className="rounded-card border border-border bg-white p-8 text-center shadow-card">
            <i className="bi bi-people mb-2 text-3xl text-ink-4" />
            <div className="text-[13px] font-semibold text-ink-3">No Supervisor or Cashier accounts found.</div>
          </div>
        ) : (
          <>
            {missingCount > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-card border border-amber/25 bg-amber-light px-4 py-3 text-[12.5px] font-semibold text-amber">
                <i className="bi bi-exclamation-triangle-fill" />
                {missingCount} staff member{missingCount !== 1 ? "s" : ""} {missingCount !== 1 ? "haven't" : "hasn't"} added bank details yet.
              </div>
            )}
            <div className="space-y-3">
              {staff.map((s, i) => {
                const hasDetails = !!s.accountNumber
                return (
                  <div key={i} className="overflow-hidden rounded-card border border-border bg-white shadow-card">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
                        style={{ background: avatarBg(s.name) }}>
                        {initials(s.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-ink">{s.name}</div>
                        <div className="text-[11px] text-ink-4">{s.role} · {getStation(s.station).name}</div>
                      </div>
                      {!hasDetails && (
                        <span className="flex-shrink-0 rounded-full bg-amber-light px-2.5 py-1 text-[10px] font-bold text-amber">Missing</span>
                      )}
                    </div>
                    {hasDetails && (
                      <div className="border-t border-surface bg-surface px-4 py-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Bank</span>
                          <span className="text-[12.5px] font-semibold text-ink">{s.bankName || "—"}</span>
                        </div>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Account Number</span>
                          <button type="button" onClick={() => copyToClipboard(s.accountNumber, `num-${i}`)}
                            className="mono flex items-center gap-1.5 text-[13px] font-bold text-navy">
                            {s.accountNumber}
                            <i className={`bi ${copiedKey === `num-${i}` ? "bi-check2" : "bi-copy"} text-[11px] text-ink-4`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-ink-4">Account Name</span>
                          <span className="text-[12.5px] font-semibold text-ink">{s.accountName || "—"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
