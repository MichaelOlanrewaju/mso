import React, { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { InstallStrip } from "../components/pwa/PWABanners"

const SLIDES = [
  {
    photo: "/images/KM1_1031.jpeg",
    tag: "Both Stations Live · Lagos",
    h1: ["Every litre.", "Every naira.", "Accounted."],
    accent: 2,
    p: "Real-time operations platform for MSO Limpid Co. Ltd and M&M Oil & Gas Ltd.",
  },
  {
    photo: "/images/_KM12485 copy.jpg.jpeg",
    tag: "Live Sales & Tank Tracking",
    h1: ["Two stations.", "One platform."],
    accent: 1,
    p: "Monitor sales, tank levels, discharge, expenses and cash reconciliation — from anywhere.",
  },
  {
    photo: "/images/KM1_1307.jpeg",
    tag: "Role-Based Access Control",
    h1: ["Built for", "your team."],
    accent: 1,
    p: "Admin, GM, Supervisor and Cashier — each with the right access, nothing more.",
  },
]

const DURATION = 5200

export default function LandingPage() {
  usePageTitle("MSO Digital Operations")
  const auth = useAuth({ requireAuth: false })
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)
  const startRef = useRef(null)
  const rafRef = useRef(null)
  const pausedRef = useRef(false)
  const currentRef = useRef(0)

  useEffect(() => {
    if (!auth.loading && auth.user) {
      if (auth.canPickStation || !auth.station) navigate("/select", { replace: true })
      else navigate(dashboardPathFor({ role: auth.role, station: auth.station }), { replace: true })
    }
  }, [auth.loading, auth.user, auth.canPickStation, auth.station, auth.role, navigate])

  const tick = (ts) => {
    if (!startRef.current) startRef.current = ts
    const pct = Math.min(((ts - startRef.current) / DURATION) * 100, 100)
    setProgress(pct)
    if (pct < 100) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      const next = (currentRef.current + 1) % SLIDES.length
      currentRef.current = next
      setCurrent(next)
      setProgress(0)
      startRef.current = null
      rafRef.current = requestAnimationFrame(tick)
    }
  }

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goTo = (idx) => {
    const next = ((idx % SLIDES.length) + SLIDES.length) % SLIDES.length
    currentRef.current = next
    setCurrent(next)
    setProgress(0)
    startRef.current = null
    cancelAnimationFrame(rafRef.current)
    if (!pausedRef.current) rafRef.current = requestAnimationFrame(tick)
  }

  const touchStartX = useRef(0)
  const onTouchStart = e => {
    touchStartX.current = e.touches[0].clientX
    pausedRef.current = true
    cancelAnimationFrame(rafRef.current)
  }
  const onTouchEnd = e => {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(dx) > 44) goTo(currentRef.current + (dx > 0 ? 1 : -1))
    setTimeout(() => { pausedRef.current = false; rafRef.current = requestAnimationFrame(tick) }, 600)
  }

  const slide = SLIDES[current]

  // Avoid a flash of marketing content for someone who's already logged
  // in — the redirect effect above fires once auth resolves, but without
  // this guard there's a visible frame of the landing page first.
  if (auth.loading || auth.user) {
    return <div style={{ width: "100%", height: "100dvh", background: "#06091A" }} />
  }

  return (
    <div className="relative select-none overflow-hidden"
      style={{ width: "100%", height: "100dvh", background: "#06091A", fontFamily: "'Plus Jakarta Sans',sans-serif" }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* ── Photo slides with Ken Burns zoom ──
          Real <img> elements, not CSS background-image: screen readers
          get nothing from a background-image, and only an <img> can use
          native loading="lazy" so the two off-screen slides don't compete
          with the visible one for bandwidth on first load. */}
      {SLIDES.map((s, i) => (
        <div key={s.photo} className="absolute inset-0 overflow-hidden"
          style={{ opacity: i === current ? 1 : 0, transition: "opacity 1.3s cubic-bezier(.4,0,.2,1)", pointerEvents: "none" }}>
          <img
            src={s.photo}
            alt={s.tag}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            className="landing-kenburns"
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center",
              filter: "brightness(.74) saturate(.95)",
              transform: i === current ? "scale(1)" : "scale(1.07)",
              transition: i === current ? "transform 7s ease-out" : "none",
              willChange: "transform",
            }}
          />
        </div>
      ))}

      {/* ── Overlays — let photo breathe ── */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 1,
        background: "linear-gradient(to bottom, rgba(6,9,26,.75) 0%, rgba(6,9,26,.10) 32%, rgba(6,9,26,.04) 52%, rgba(6,9,26,.58) 72%, rgba(6,9,26,.96) 100%)" }} />
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 1,
        background: "radial-gradient(ellipse 55% 55% at 6% 92%, rgba(23,157,208,.08) 0%, transparent 62%)" }} />

      {/* ── Progress bars ── */}
      <div className="absolute left-0 right-0 z-[30] flex gap-[5px] px-[18px] pt-[10px]"
        style={{ top: "env(safe-area-inset-top)" }}>
        {SLIDES.map((_, i) => (
          <div key={i} className="relative flex-1 overflow-hidden rounded-full"
            style={{ height: 1.5, background: "rgba(255,255,255,.16)" }}>
            <div className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: "rgba(255,255,255,.88)",
                width: i < current ? "100%" : i === current ? `${progress}%` : "0%",
              }} />
          </div>
        ))}
      </div>

      {/* ── Top bar ── */}
      <header className="absolute left-0 right-0 z-[20] flex items-center justify-between px-5"
        style={{ top: "env(safe-area-inset-top)", paddingTop: 24 }}>
        {/* Logo */}
        <div className="flex items-center gap-[11px]">
          <img src="/images/msolimpid.png" alt="MSO Limpid"
            style={{ height: 36, width: "auto", display: "block", filter: "brightness(0) invert(1)" }}
            onError={e => { e.target.style.display="none" }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-.025em", lineHeight: 1.15 }}>Digital</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.30)", letterSpacing: ".6px", textTransform: "uppercase", fontWeight: 600, marginTop: 2 }}>Operations Portal</div>
          </div>
        </div>

        {/* Sign In button */}
        <button type="button" onClick={() => navigate("/login")} aria-label="Sign in to your account"
          className="flex items-center gap-[7px] rounded-full px-4 py-2 text-[13px] font-bold"
          style={{ color: "rgba(255,255,255,.88)", background: "rgba(255,255,255,.09)", border: ".5px solid rgba(255,255,255,.18)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)" }}>
          Sign In <i className="bi bi-arrow-right" />
        </button>
      </header>

      {/* ── Slide content — hero text ── */}
      <div className="absolute inset-0 z-[5] flex flex-col justify-end px-6"
        style={{ paddingBottom: "calc(272px + env(safe-area-inset-bottom))" }}>
        <div key={current} style={{ animation: "scIn .65s .08s cubic-bezier(.22,1,.36,1) both" }}>
          {/* Counter row — styled like a mechanical forecourt pump meter */}
          <div className="mb-[13px] flex items-center gap-[10px]">
            <div className="flex items-center gap-[7px] rounded-[7px] px-[10px] py-[5px]"
              style={{ background: "rgba(0,0,0,.38)", border: "1px solid rgba(255,255,255,.10)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.5)" }}>
              <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full"
                style={{ background: "#F5B84A", boxShadow: "0 0 6px rgba(245,184,74,.9)" }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 700, letterSpacing: "2.5px", fontVariantNumeric: "tabular-nums", color: "#F5B84A", textShadow: "0 0 9px rgba(245,184,74,.5)" }}>
                {String(current + 1).padStart(2, "0")}
                <span style={{ opacity: .38 }}> / {String(SLIDES.length).padStart(2, "0")}</span>
              </span>
            </div>
            <span className="h-px max-w-[26px] flex-1 rounded-full" style={{ background: "rgba(255,255,255,.20)" }} />
          </div>

          {/* Live tag */}
          <div className="mb-[15px] inline-flex items-center gap-2 rounded-full px-[13px] py-[5px]"
            style={{ background: "rgba(23,157,208,.10)", border: ".5px solid rgba(23,157,208,.24)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
            <span className="inline-block h-[7px] w-[7px] flex-shrink-0 rounded-full"
              style={{ background: "#22C55E", animation: "livePulse 2.4s ease-in-out infinite" }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(110,225,255,.92)" }}>{slide.tag}</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontWeight: 800, color: "#fff", lineHeight: .96, letterSpacing: "-.045em", marginBottom: 14, textShadow: "0 2px 4px rgba(0,0,0,.6), 0 8px 32px rgba(0,0,0,.45)", fontSize: "clamp(38px,10.5vw,60px)" }}>
            {slide.h1.map((line, i) => (
              <React.Fragment key={i}>
                {i === slide.accent ? <span style={{ color: "#6DE0FF" }}>{line}</span> : line}
                {i < slide.h1.length - 1 && <br />}
              </React.Fragment>
            ))}
          </h1>

          {/* Sub */}
          <p style={{ fontSize: 14.5, fontWeight: 400, color: "rgba(255,255,255,.46)", lineHeight: 1.76, maxWidth: 295 }}>
            {slide.p}
          </p>
        </div>
      </div>

      {/* ── Action panel — bottom sheet ── */}
      <div className="absolute bottom-0 left-0 right-0 z-[10] px-5"
        style={{ paddingBottom: "calc(22px + env(safe-area-inset-bottom))", background: "linear-gradient(to top, rgba(6,9,26,1) 0%, rgba(6,9,26,.97) 52%, rgba(6,9,26,.70) 80%, transparent 100%)" }}>

        {/* Dot indicators */}
        <div className="mb-4 flex items-center justify-center gap-[6px]">
          {SLIDES.map((_, i) => (
            <button key={i} type="button" onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1} of ${SLIDES.length}`}
              aria-current={i === current ? "true" : undefined}
              className="rounded-full transition-all duration-300"
              style={{ height: 3, width: i === current ? 28 : 18, background: i === current ? "rgba(255,255,255,.84)" : "rgba(255,255,255,.18)" }} />
          ))}
        </div>

        {/* Install strip */}
        <InstallStrip />

        {/* CTA */}
        <button type="button" onClick={() => navigate("/login")} aria-label="Sign in to your account"
          className="relative mb-3 flex w-full items-center justify-center gap-3 overflow-hidden rounded-[15px] text-[15px] font-extrabold text-white"
          style={{ height: 54, background: "#179DD0", boxShadow: "0 4px 22px rgba(23,157,208,.42)" }}>
          <span className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(135deg,rgba(255,255,255,.14) 0%,transparent 55%)" }} />
          <i className="bi bi-box-arrow-in-right" />
          Sign In to Continue
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[14px]"
            style={{ background: "rgba(255,255,255,.20)" }}>
            <i className="bi bi-arrow-right" />
          </div>
        </button>

        {/* Station status */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-[5px] text-[11.5px] font-semibold" style={{ color: "rgba(255,255,255,.48)" }}>
            <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,.7)" }} />
            MSO Limpid
          </span>
          <span style={{ color: "rgba(255,255,255,.18)", fontSize: 11 }}>·</span>
          <span className="inline-flex items-center gap-[5px] text-[11.5px] font-semibold" style={{ color: "rgba(255,255,255,.48)" }}>
            <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: "#F59E0B", boxShadow: "0 0 6px rgba(245,158,11,.7)" }} />
            M&amp;M Oil &amp; Gas
          </span>
          <span style={{ color: "rgba(255,255,255,.18)", fontSize: 11 }}>·</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.28)" }}>Both stations live</span>
        </div>
      </div>

      <style>{`
        @keyframes scIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes livePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); }
          55%      { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-kenburns { transition: none !important; transform: none !important; }
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  )
}
