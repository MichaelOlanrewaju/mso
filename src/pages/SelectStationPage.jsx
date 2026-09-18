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

/* Each station owns its palette here, so every brand reads as itself rather
   than a shared dark card with a different thin border. Confirmed directly:
   Mobil is #00AAFB, used prominently as the dominant surface wash — not a
   thin accent — with no red anywhere. */
const CARD_THEME = {
  mso: {
    surface: "linear-gradient(160deg, rgba(0,170,251,0.50) 0%, rgba(0,61,92,0.35) 100%)",
    border: "rgba(0,170,251,0.45)",
    borderHover: "rgba(0,170,251,0.80)",
    accent: "#00AAFB",
    accentSoft: "rgba(0,170,251,0.16)",
    name: "#FFFFFF",
    tile: "rgba(255,255,255,0.06)",
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
  msoo: {
    surface: "linear-gradient(160deg, rgba(19,6,86,0.55) 0%, rgba(10,14,26,0.2) 100%)",
    border: "rgba(23,157,208,0.30)",
    borderHover: "rgba(23,157,208,0.65)",
    accent: "#179DD0",
    accentSoft: "rgba(23,157,208,0.12)",
    name: "#FFFFFF",
    tile: "rgba(255,255,255,0.045)",
  },
}

function StationCard({ station, name, addr, badgeLabel, pumpsLine, fuelLine, stats, onSelect, comingSoon }) {
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
      className={`group relative overflow-hidden rounded-[20px] border p-[26px] text-left transition-all duration-200 hover:-translate-y-1 ${comingSoon ? "opacity-80" : ""}`}
      style={{ background: t.surface, borderColor: t.border }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = t.borderHover)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = t.border)}
    >
      <div
        className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 group-hover:translate-x-[3px]"
        style={{ background: t.accentSoft, color: t.accent }}
      >
        <i className={`bi ${comingSoon ? "bi-hourglass-split" : "bi-arrow-right"} text-[13px]`} />
      </div>

      <div
        className="mb-5 inline-flex items-center gap-2 rounded-full border px-[13px] py-[5px] text-[10.5px] font-bold uppercase tracking-[0.5px]"
        style={{ background: t.accentSoft, borderColor: t.border, color: t.accent }}
      >
        {comingSoon
          ? <i className="bi bi-clock-history text-[11px]" />
          : <span className="h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-green" style={{ boxShadow: "0 0 6px rgba(34,197,94,.8)" }} />}
        {badgeLabel}
      </div>

      <div className="mb-1.5 text-[19px] font-black tracking-[-0.03em]" style={{ color: t.name }}>{name}</div>
      <div className="mb-5 text-[12.5px] text-white/45">{addr}</div>

      {comingSoon ? (
        <div className="rounded-[10px] px-[13px] py-[16px] text-center text-[12.5px] font-semibold text-white/50" style={{ background: t.tile }}>
          Setup in progress — check back soon
        </div>
      ) : (
        <>
          <div className="mb-2.5 rounded-[10px] px-[15px] py-[13px]" style={{ background: t.tile }}>
            <div className="font-mono text-[21px] font-extrabold leading-tight tracking-[-0.02em]" style={{ color: t.accent }}>
              {stats.revenue}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.6px] text-white/45">Yesterday's Revenue</div>
          </div>
          <div className="mb-2.5 grid grid-cols-2 gap-2.5">
            <Stat value={stats.litres} label="Litres Sold" />
            <Stat value={pumpsLine} label="PMS Pumps" />
          </div>
          <div className="text-[11.5px] font-medium" style={{ color: t.accent }}>
            {fuelLine}
          </div>
        </>
      )}
    </button>
  )
}

export default function SelectStationPage() {
  usePageTitle("Select Station — MSO Digital Operations")
  const auth = useAuth({ requireAuth: true })
  const [stats, setStats] = useState({ mso: null, mrs: null })
  const [comingSoonNotice, setComingSoonNotice] = useState(false)
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
      {comingSoonNotice && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-[12px] border border-white/15 bg-[#12172a] px-5 py-3 text-[13px] font-semibold text-white shadow-lift">
          <i className="bi bi-hourglass-split mr-2 text-cyan" />
          MSO Station's setup is still in progress — check back soon
        </div>
      )}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,170,251,.025) 1px,transparent 1px), linear-gradient(90deg,rgba(0,170,251,.025) 1px,transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(0,61,92,.55) 0%, transparent 70%)" }}
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

        {/* Order: Mobil, M&M, MSO last — confirmed directly */}
        <div className="mb-9 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          <StationCard
            station="mso"
            name="Mobil Idowu Egba"
            addr="Authorised Mobil Dealer · Lagos"
            badgeLabel="Live · Mobil Station"
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
          <StationCard
            station="msoo"
            name="MSO Limpid Co. Ltd"
            addr="Lagos"
            badgeLabel="Coming Soon"
            comingSoon
            onSelect={() => {
              setComingSoonNotice(true)
              setTimeout(() => setComingSoonNotice(false), 3000)
            }}
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
