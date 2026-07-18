import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { useStationAssignment } from "../hooks/useStationAssignment"
import { getStation, STATION_KEYS } from "../config/stations"

/* Small station chip, coloured from that station's own palette so MSO and M&M
   are distinguishable at a glance. */
function StationTag({ station }) {
  const s = getStation(station)
  const isMso = station === "mso"
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10.5px] font-bold"
      style={{
        background: isMso ? "#EEF0FB" : "#F5EBEF",
        color: isMso ? "#130656" : "#5f1f33",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: isMso ? "#179DD0" : "#eaaa18" }} />
      {s.short}
    </span>
  )
}

export default function StationAssignmentPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle("Station Assignments")
  const { staff, status, savingUser, reassign } = useStationAssignment(auth.username)
  const [feedback, setFeedback] = useState(null)

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  /* GM and owner only — this is an operational control over who works where. */
  const allowed = auth.role === "owner" || auth.role === "ceo" || auth.role === "gm"
  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pagebg p-6">
        <div className="max-w-[300px] rounded-panel border border-border bg-white px-6 py-8 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-surface">
            <i className="bi bi-lock text-[19px] text-ink-4" />
          </div>
          <p className="text-[13px] font-bold text-ink">Not your page</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-4">
            Only the GM and owner can move staff between stations.
          </p>
          <button type="button" onClick={() => window.history.back()}
            className="mt-4 rounded-[10px] border border-border px-4 py-2 text-[12px] font-bold text-ink-3">
            Go back
          </button>
        </div>
      </div>
    )
  }

  const move = (person, toStation) => {
    if (person.station === toStation) return
    setFeedback(null)
    reassign(person.username, toStation).then(d => {
      if (d.ok) {
        setFeedback({ ok: true, text: `${d.name} moved to ${getStation(d.to).name}. They'll land there next time they sign in.` })
      } else if (d.noChange) {
        setFeedback({ ok: true, text: d.message })
      } else {
        setFeedback({ ok: false, text: d.error || "Could not move that person." })
      }
    })
  }

  const supervisors = staff.filter(s => s.role === "supervisor")
  const cashiers = staff.filter(s => s.role === "cashier")

  const Section = ({ title, people }) => {
    if (!people.length) return null
    return (
      <>
        <div className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4 first:mt-0">{title}</div>
        <div className="mb-1 overflow-hidden rounded-panel border border-border bg-white shadow-card">
          {people.map((p, i) => (
            <div key={p.username}
              className={`flex items-center gap-3 px-4 py-3.5 ${i < people.length - 1 ? "border-b border-surface" : ""}`}>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface text-[13px] font-extrabold text-ink-3">
                {(p.name || p.username).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-ink">{p.name || p.username}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-[10.5px] capitalize text-ink-4">{p.role}</span>
                  <span className="text-border">·</span>
                  <span className="text-[10.5px] text-ink-4">currently</span>
                  <StationTag station={p.station} />
                </div>
              </div>
              {/* The move control: a segmented MSO / M&M switch. Tapping the other
                  station moves them. The one they're on is highlighted. */}
              <div className="flex flex-shrink-0 overflow-hidden rounded-[10px] border border-border">
                {STATION_KEYS.map(key => {
                  const active = p.station === key
                  const st = getStation(key)
                  const busy = savingUser === p.username
                  return (
                    <button key={key} type="button" disabled={busy || active}
                      onClick={() => move(p, key)}
                      className={`px-3 py-2 text-[11px] font-bold transition-colors ${
                        active ? "text-white" : "bg-white text-ink-3 hover:bg-surface disabled:opacity-50"
                      }`}
                      style={active ? { background: key === "mso" ? "#130656" : "#5f1f33" } : undefined}
                    >
                      {busy && !active ? "…" : st.short}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }

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
            <div className="text-[16px] font-extrabold text-ink">Station Assignments</div>
            <div className="text-[10px] text-ink-4">Move supervisors &amp; cashiers between stations</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        {feedback && (
          <div className={`mb-4 flex items-center gap-2 rounded-[11px] border px-4 py-3 text-[13px] font-semibold ${feedback.ok ? "border-green/20 bg-green-light text-green" : "border-red/20 bg-red-light text-red"}`}>
            <i className={`bi ${feedback.ok ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />
            <span className="flex-1">{feedback.text}</span>
            <button type="button" onClick={() => setFeedback(null)}><i className="bi bi-x-lg text-[11px] opacity-40" /></button>
          </div>
        )}

        <div className="mb-4 rounded-[12px] border border-cyan/15 bg-cyan-light/40 px-4 py-3 text-[11.5px] leading-relaxed text-ink-2">
          Moving someone changes which station they see. A supervisor moved to M&amp;M lands on
          the M&amp;M supervisor page and can't reach MSO — move them back any time.
          Owners see every station and aren't listed here.
        </div>

        {status === "loading" ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="skel h-16 w-full rounded-panel" />)}
          </div>
        ) : status === "error" ? (
          <div className="rounded-panel border border-red/20 bg-red-light px-4 py-8 text-center text-[12.5px] text-red">
            Couldn't load staff. Pull to refresh or try again.
          </div>
        ) : staff.length === 0 ? (
          <div className="rounded-panel border border-border bg-white px-4 py-10 text-center shadow-card">
            <p className="text-[12.5px] text-ink-4">No supervisors or cashiers found on either station yet.</p>
          </div>
        ) : (
          <>
            <Section title="Supervisors" people={supervisors} />
            <Section title="Cashiers" people={cashiers} />
          </>
        )}
      </div>
    </div>
  )
}
