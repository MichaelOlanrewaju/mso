import React, { useEffect, useState } from "react"
import { litres } from "../utils/format"
import { setActiveStation } from "../utils/station"
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

/* Each station owns its palette here, so M&M reads as its own brand — a wine
   surface with gold accents — rather than amber sprinkled on MSO's navy. The
   card paints its OWN background instead of sitting transparent over the shared
   navy page, which is what made the two look like the same colour before. */
const CARD_THEME = {
  mso: {
    surface: "linear-gradient(160deg, rgba(19,6,86,0.55) 0%, rgba(10,14,26,0.2) 100%)",
    border: "rgba(23,157,208,0.30)",
    borderHover: "rgba(23,157,208,0.65)",
    accent: "#179DD0",
    accentSoft: "rgba(23,157,208,0.12)",
    name: "#FFFFFF",
    tile: "rgba(255,255,255,0.045)",
  },
  mrs: {
    surface: "linear-gradient(160deg, rgba(95,31,51,0.72) 0%, rgba(46,15,25,0.55) 100%)",
    border: "rgba(234,170,24,0.38)",
    borderHover: "rgba(234,170,24,0.75)",
    accent: "#eaaa18",
    accentSoft: "rgba(234,170,24,0.14)",
    name: "#F7E3B0",
    tile: "rgba(255,255,255,0.05)",
  },
}

function StationCard({ station, name, addr, badgeLabel, pumpsLine, fuelLine, stats, onSelect }) {
  const t = CARD_THEME[station] || CARD_THEME.mso

  const Stat = ({ value, label }) => (
    <div className="rounded-[10px] px-[13px] py-[11px]" style={{ background: t.tile }}>
      <div className="font-mono text-[17px] font-extrabold tracking-[-0.03em]" style={{ color: t.accent }}>{value}</div>
      <div className="mt-[3px] text-[10px] font-semibold uppercase tracking-[0.6px] text-white/45">{label}</div>
    </div>
  )

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative overflow-hidden rounded-[20px] border p-[26px] text-left transition-all duration-200 hover:-translate-y-1"
      style={{ background: t.surface, borderColor: t.border }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = t.borderHover)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = t.border)}
    >
      <div
        className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 group-hover:translate-x-[3px]"
        style={{ background: t.accentSoft, color: t.accent }}
      >
        <i className="bi bi-arrow-right text-[13px]" />
      </div>

      <div
        className="mb-5 inline-flex items-center gap-2 rounded-full border px-[13px] py-[5px] text-[10.5px] font-bold uppercase tracking-[0.5px]"
        style={{ background: t.accentSoft, borderColor: t.border, color: t.accent }}
      >
        <span className="h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-green" style={{ boxShadow: "0 0 6px rgba(34,197,94,.8)" }} />
        {badgeLabel}
      </div>

      <div className="mb-1.5 text-[19px] font-black tracking-[-0.03em]" style={{ color: t.name }}>{name}</div>
      <div className="mb-5 text-[12.5px] text-white/45">{addr}</div>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat value={stats.revenue} label="Today's Revenue" />
        <Stat value={stats.litres} label="Litres Sold" />
        <Stat value={pumpsLine} label="PMS Pumps" />
        <Stat value={fuelLine} label="AGO & Gas" />
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
    /* Two things have to happen here, and only one used to.

       The session record gets the station, so the choice survives a reload —
       that part already worked. But every hook that talks to the API now reads
       activeStation() to decide WHICH SPREADSHEET to write to. Without setting
       it, an owner picking M&M would see M&M's dashboard while their dip entries
       still landed in MSO's sheet. Silent, and very hard to spot. */
    setActiveStation(station)
    try {
      const raw = window.localStorage.getItem("mso_session")
      if (raw) {
        const record = JSON.parse(raw)
        record.user.station = station
        window.localStorage.setItem("mso_session", JSON.stringify(record))
      }
    } catch (e) {}
    /* Full reload rather than navigate(), so the theme repaints and every hook
       re-reads the new station from scratch. */
    window.location.href = `/dashboard/${station}`
  }

  const msoStats = {
    revenue: stats.mso ? `₦${Number(stats.mso.revenue).toLocaleString("en-NG")}` : "—",
    litres: stats.mso ? `${litres(stats.mso.litres)}` : "—",
  }
  const mrsStats = {
    revenue: stats.mrs ? `₦${Number(stats.mrs.revenue).toLocaleString("en-NG")}` : "—",
    litres: stats.mrs ? `${litres(stats.mrs.litres)}` : "—",
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
            station="mso"
            name="MSO Limpid Co. Ltd"
            addr="Authorised Mobil Dealer · Lagos"
            badgeLabel="Live · MSO Station"
            pumpsLine="P1–P6"
            fuelLine="TK4 + LPG"
            stats={msoStats}
            onSelect={() => selectStation("mso")}
          />
          <StationCard
            station="mrs"
            name="M&M Oil and Gas"
            addr="Oil and Gas Station · Lagos"
            badgeLabel="Live · M&M Station"
            pumpsLine="P1–P4"
            fuelLine="TK4 + LPG"
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
