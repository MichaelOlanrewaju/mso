import React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { activeStation } from "../utils/station"
import { getStation } from "../config/stations"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth } from "../hooks/useAuth"
import { useAttendantProfile } from "../hooks/useAttendants"
import { usePageTitle } from "../hooks/usePageTitle"
import { naira, litres } from "../utils/format"
import ProofPhotoViewer from "../components/cashup/ProofPhotoViewer"

const AVATAR_COLORS = ["var(--brand-accent)", "#06091A", "#16A34A", "#DC2626", "#7C3AED"]
function avatarBg(name) {
  return AVATAR_COLORS[(name || " ").charCodeAt(0) % AVATAR_COLORS.length]
}
function initials(name) {
  return (name || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
}

const STATUS_PILL = {
  PENDING: { bg: "bg-amber-light", text: "text-amber", label: "Pending" },
  REVIEWED: { bg: "bg-cyan-light", text: "text-cyan-dark", label: "Reviewed" },
  RESOLVED: { bg: "bg-green-light", text: "text-green", label: "Resolved" },
}

function HeadlineCard({ icon, label, value, sub, tone }) {
  return (
    <div className="rounded-card border border-border bg-white p-3.5 shadow-card">
      <div className="mb-1 flex items-center gap-1.5">
        <i className={`bi ${icon} text-[11px]`} style={{ color: tone || "var(--ink-4)" }} />
        <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-ink-4">{label}</div>
      </div>
      <div className="mono text-[18px] font-black" style={tone ? { color: tone } : { color: "var(--ink)" }}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-ink-4">{sub}</div>}
    </div>
  )
}

export default function AttendantProfilePage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const { attendantId } = useParams()
  const { status, data } = useAttendantProfile(auth.username, attendantId)
  usePageTitle(data?.attendant ? `${data.attendant.name} — Profile` : "Attendant Profile")

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-pagebg text-[13px] text-ink-4">Loading profile…</div>
  }
  if (status === "error" || !data?.attendant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-pagebg px-6 text-center">
        <i className="bi bi-exclamation-circle text-[28px] text-ink-4" />
        <div className="text-[13px] font-semibold text-ink-3">Couldn't load this attendant's profile</div>
        <button type="button" onClick={() => navigate(`/attendants/${activeStation()}`)}
          className="rounded-full bg-cyan px-4 py-2 text-[12.5px] font-bold text-white">
          Back to Attendants
        </button>
      </div>
    )
  }

  const {
    attendant, attendance, attendanceSummary, shortages, clearances,
    totalShortage, totalCleared, outstandingBalance,
    totalLitresSold, totalSalesGenerated, salesCount,
  } = data

  const attendanceRate = (attendanceSummary.present + attendanceSummary.absent) > 0
    ? Math.round((attendanceSummary.present / (attendanceSummary.present + attendanceSummary.absent)) * 100)
    : null

  return (
    <div className="min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[100] border-b border-border bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingTop: "max(var(--sat), 12px)" }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(`/attendants/${activeStation()}`)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-3">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">Attendant Dashboard</div>
            <div className="text-[10px] text-ink-4">{getStation(activeStation()).name}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[560px] px-4 py-4">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3.5 rounded-card border border-border bg-white p-4 shadow-card">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white"
            style={{ background: avatarBg(attendant.name) }}
          >
            {initials(attendant.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-extrabold text-ink">{attendant.name}</div>
            <div className="text-[12px] text-ink-4">{attendant.phone || "No phone on file"}</div>
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface px-2 py-[2px] text-[10px] font-semibold capitalize text-ink-3">
              {attendant.status}
            </div>
          </div>
        </div>

        {/* Headline stat grid — the "entire dashboard" at a glance */}
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          <HeadlineCard icon="bi-droplet-half" label="Litres Sold" value={litres(totalLitresSold)} sub={`${salesCount} sale${salesCount !== 1 ? "s" : ""} tracked`} tone="#0EA5D9" />
          <HeadlineCard icon="bi-cash-stack" label="Sales Generated" value={naira(totalSalesGenerated)} tone="#6D46E8" />
          <HeadlineCard icon="bi-calendar-check" label="Attendance Rate" value={attendanceRate !== null ? `${attendanceRate}%` : "—"} sub="this month" tone="#16A34A" />
          <HeadlineCard icon="bi-exclamation-triangle" label="Outstanding" value={naira(outstandingBalance)} tone={outstandingBalance > 0 ? "#DC2626" : "#16A34A"} />
        </div>
        {totalLitresSold === 0 && salesCount === 0 && (
          <div className="mb-4 -mt-2 text-[10.5px] text-ink-4">
            Litres and sales fill in once this attendant is selected during Sales entry, or allocated a pump on the Attendance page.
          </div>
        )}

        {/* Outstanding balance detail */}
        <div className={`mb-4 rounded-card border p-4 shadow-card ${outstandingBalance > 0 ? "border-red/25 bg-red-light" : "border-green/25 bg-green-light"}`}>
          <div className={`text-[10px] font-bold uppercase tracking-[0.5px] ${outstandingBalance > 0 ? "text-red" : "text-green"}`}>
            Shortage Balance Breakdown
          </div>
          <div className={`mono mt-1 text-[24px] font-black ${outstandingBalance > 0 ? "text-red" : "text-green"}`}>
            {naira(outstandingBalance)}
          </div>
          <div className="mt-1 text-[11px] text-ink-3">
            {naira(totalShortage)} total shortage − {naira(totalCleared)} cleared
          </div>
        </div>

        {/* Attendance — with pump allocation shown per day */}
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Attendance History</div>
          <div className="text-[10.5px] text-ink-4">{attendanceSummary.present} present · {attendanceSummary.absent} absent (this month)</div>
        </div>
        <div className="mb-5 overflow-hidden rounded-card border border-border bg-white shadow-card">
          {attendance.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-ink-4">No attendance recorded yet</div>
          ) : (
            attendance.slice(0, 14).map((a, i) => (
              <div key={i} className="flex items-center justify-between border-b border-surface px-4 py-2.5 last:border-b-0">
                <div>
                  <span className="text-[12.5px] font-medium text-ink">{a.date}</span>
                  {a.status === "Present" && a.pumps?.length > 0 && (
                    <span className="ml-2 text-[10.5px] text-ink-4">On {a.pumps.join(", ")}</span>
                  )}
                </div>
                <span className={`text-[11.5px] font-bold ${a.status === "Present" ? "text-green" : "text-red"}`}>
                  {a.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Shortage history */}
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Shortage History</div>
        <div className="mb-5 space-y-2">
          {shortages.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-white px-4 py-6 text-center text-[12px] text-ink-4">
              No shortages linked to this attendant
            </div>
          ) : (
            shortages.map(s => {
              const pill = STATUS_PILL[s.status] || STATUS_PILL.PENDING
              return (
                <div key={s.rowIndex} className="rounded-card border border-border bg-white p-3.5 shadow-card">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[12px] font-bold text-ink">{s.category}</div>
                      <div className="text-[10.5px] text-ink-4">{s.date}</div>
                    </div>
                    <span className={`rounded-full px-2 py-[2px] text-[10px] font-bold ${pill.bg} ${pill.text}`}>{pill.label}</span>
                  </div>
                  <div className="mb-2 text-[12px] leading-snug text-ink-2">{s.description}</div>
                  <div className="mono text-[13px] font-extrabold text-red">{naira(s.amount)}</div>
                </div>
              )
            })
          )}
        </div>

        {/* Cleared shortage history — the audit trail */}
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Cleared Shortage History</div>
        <div className="space-y-2">
          {clearances.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-white px-4 py-6 text-center text-[12px] text-ink-4">
              No repayments recorded yet
            </div>
          ) : (
            clearances.map((c, i) => (
              <div key={i} className="rounded-card border border-green/20 bg-green-light p-3.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-ink-3">{c.date} · {c.submittedBy}</span>
                  <span className="mono text-[14px] font-extrabold text-green">{naira(c.amountPaid)}</span>
                </div>
                {c.notes && <div className="mb-1.5 text-[11.5px] text-ink-2">{c.notes}</div>}
                {c.receiptFileId && <ProofPhotoViewer label="View receipt" fileId={c.receiptFileId} />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
