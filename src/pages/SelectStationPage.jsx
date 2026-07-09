import React, { useEffect, useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

function useClockLine() {
  const [text, setText] = useState("—")
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setText(
        n.toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) +
          "  ·  " +
          n.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })
      )
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])
  return text
}

function StationCard({ name, addr, accent, badgeLabel, pumpsLine, fuelLine, stats, onSelect }) {
  const isCyan = accent === "cyan"
  const ring = isCyan ? "border-cyan/[0.28]" : "border-amber/[0.25]"
  const hoverRing = isCyan ? "hover:border-cyan/60" : "hover:border-amber/55"
  const badgeCls = isCyan ? "bg-cyan/10 border-cyan/[0.28] text-cyan" : "bg-amber/10 border-amber/[0.28] text-amber"
  const arrowCls = isCyan ? "bg-cyan/10 text-cyan group-hover:bg-cyan/20" : "bg-amber/10 text-amber group-hover:bg-amber/20"
  const statCls = isCyan ? "text-cyan" : "text-amber"
  const nameCls = isCyan ? "text-white" : "text-[#FDE68A]"

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-[20px] border ${ring} ${hoverRing} bg-white/[0.03] p-[26px] text-left transition-all duration-200 hover:-translate-y-1`}
    >
      <div
        className={`absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 group-hover:translate-x-[3px] ${arrowCls}`}
      >
        <i className="bi bi-arrow-right text-[13px]" />
      </div>

      <div className={`mb-5 inline-flex items-center gap-2 rounded-full border px-[13px] py-[5px] text-[10.5px] font-bold uppercase tracking-[0.5px] ${badgeCls}`}>
        <span className="h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-green" style={{ boxShadow: "0 0 6px rgba(34,197,94,.8)" }} />
        {badgeLabel}
      </div>

      <div className={`mb-1.5 text-[19px] font-black tracking-[-0.03em] ${nameCls}`}>{name}</div>
      <div className="mb-5 text-[12.5px] text-white/40">{addr}</div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[10px] bg-white/[0.04] px-[13px] py-[11px]">
          <div className={`font-mono text-[17px] font-extrabold tracking-[-0.03em] ${statCls}`}>{stats.revenue}</div>
          <div className="mt-[3px] text-[10px] font-semibold uppercase tracking-[0.6px] text-white/40">Today's Revenue</div>
        </div>
        <div className="rounded-[10px] bg-white/[0.04] px-[13px] py-[11px]">
          <div className={`font-mono text-[17px] font-extrabold tracking-[-0.03em] ${statCls}`}>{stats.litres}</div>
          <div className="mt-[3px] text-[10px] font-semibold uppercase tracking-[0.6px] text-white/40">Litres Sold</div>
        </div>
        <div className="rounded-[10px] bg-white/[0.04] px-[13px] py-[11px]">
          <div className={`font-mono text-[17px] font-extrabold tracking-[-0.03em] ${statCls}`}>{pumpsLine}</div>
          <div className="mt-[3px] text-[10px] font-semibold uppercase tracking-[0.6px] text-white/40">PMS Pumps</div>
        </div>
        <div className="rounded-[10px] bg-white/[0.04] px-[13px] py-[11px]">
          <div className={`font-mono text-[17px] font-extrabold tracking-[-0.03em] ${statCls}`}>{fuelLine}</div>
          <div className="mt-[3px] text-[10px] font-semibold uppercase tracking-[0.6px] text-white/40">AGO &amp; Gas</div>
        </div>
      </div>
    </button>
  )
}

export default function SelectStationPage() {
  usePageTitle("Select Station — MSO Digital Operations")
  const auth = useAuth({ requireAuth: true })
  const [stats, setStats] = useState({ mso: null, mrs: null })
  const clockLine = useClockLine()

  useEffect(() => {
    if (!SCRIPT_URL) return
    fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "getStationSummary" }),
      redirect: "follow",
    })
      .then(r => r.json())
      .then(d => {
        if (d && (d.mso || d.mrs)) setStats({ mso: d.mso || null, mrs: d.mrs || null })
      })
      .catch(() => {})
  }, [])

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-[#0A0E1A]" />
  }

  const selectStation = station => {
    // Update the session's station so a multi-station user (owner) is
    // remembered on this device until they pick a different one again.
    try {
      const raw = window.localStorage.getItem("mso_session")
      if (raw) {
        const record = JSON.parse(raw)
        record.user.station = station
        window.localStorage.setItem("mso_session", JSON.stringify(record))
      }
    } catch (e) {}
    window.location.href = `/dashboard-${station}`
  }

  const msoStats = {
    revenue: stats.mso ? `₦${Number(stats.mso.revenue).toLocaleString("en-NG")}` : "—",
    litres: stats.mso ? `${Number(stats.mso.litres).toLocaleString("en-NG")}L` : "—",
  }
  const mrsStats = {
    revenue: stats.mrs ? `₦${Number(stats.mrs.revenue).toLocaleString("en-NG")}` : "—",
    litres: stats.mrs ? `${Number(stats.mrs.litres).toLocaleString("en-NG")}L` : "—",
  }

  return (
    <div className="relative flex min-h-screen items-start overflow-x-hidden bg-[#0A0E1A] py-10 text-white sm:items-center sm:py-0">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(23,157,208,.025) 1px,transparent 1px), linear-gradient(90deg,rgba(23,157,208,.025) 1px,transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(19,6,86,.55) 0%, transparent 70%)" }}
      />

      <div className="relative z-[1] mx-auto w-full max-w-[880px] px-6 text-center">
        <div className="mb-8 flex items-center justify-center">
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[15px] border border-white/[0.08] bg-white/[0.06] shadow-lift">
            <span className="font-mono text-xl font-black text-cyan">M</span>
          </div>
        </div>

        <div className="mb-2.5 font-mono text-[12.5px] font-semibold uppercase tracking-[0.6px] text-white/35">
          Welcome back, {(auth.name || auth.username || "").split(" ")[0]}
        </div>
        <h1 className="mb-2.5 text-[clamp(1.8rem,4vw,2.7rem)] font-black leading-[1.05] tracking-[-0.04em] text-white">
          Select a Station
        </h1>
        <p className="mb-2.5 text-[14.5px] text-white/40">Choose which station you want to manage today</p>
        <div className="mb-10 font-mono text-[11.5px] tracking-[0.3px] text-white/20">{clockLine}</div>

        <div className="mb-9 grid grid-cols-1 gap-[18px] sm:grid-cols-2">
          <StationCard
            name="MSO Limpid Co. Ltd"
            addr="Authorised Mobil Dealer · Lagos"
            accent="cyan"
            badgeLabel="Live · MSO Station"
            pumpsLine="P1–P6"
            fuelLine="TK4 + LPG"
            stats={msoStats}
            onSelect={() => selectStation("mso")}
          />
          <StationCard
            name="M&M Oil & Gas Ltd"
            addr="MRS Authorised Station · Lagos"
            accent="amber"
            badgeLabel="Live · MRS Station"
            pumpsLine="P1–P3"
            fuelLine="AP1"
            stats={mrsStats}
            onSelect={() => selectStation("mrs")}
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-between">
          <div className="font-mono text-[11px] tracking-[0.5px] text-white/20">v1.0 · Phase 1 of 4 · MSO Digital Operations</div>
          <button
            type="button"
            onClick={auth.logout}
            className="inline-flex items-center gap-[7px] rounded-[9px] border border-white/[0.08] px-[18px] py-[9px] text-[13px] font-semibold text-white/40 transition-all hover:border-white/20 hover:text-white/70"
          >
            <i className="bi bi-box-arrow-left" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
