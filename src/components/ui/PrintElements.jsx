import React from "react"
import { getStation } from "../../config/stations"
import { activeStation } from "../../utils/station"

// Both render nothing on screen (see the .print-header/.print-watermark
// rules in global.css) — they only appear in the actual printed output.
// Drop these into any page that has a print button, so every printed
// document gets the same consistent treatment instead of each page
// reinventing its own.

/* The printed letterhead.
   Logo hard left, document title and date hard right, brand rule underneath.

   LOGO NOTE: /images/msolimpid.png is a WHITE logo on transparency — it was
   built for the dark navy sidebar and is invisible on white paper. That's why
   the previous version of this file forced `filter: invert(1) brightness(0)`
   onto it, which crushed a colour logo into a black silhouette on every
   printout. The real fix is a colour asset, so this points at LOGO_SRC below.
   Drop the colour logo in at that path and it prints properly; if the file is
   missing, the header degrades to a clean typographic lockup rather than
   showing a broken-image icon. */
/* One logo per station, named by key. Each station drops its own colour asset
   at /public/images/logo-<key>.jpg (or .png). If it's missing the header falls
   back to a clean typographic lockup — no broken-image icon. MSO keeps its
   existing file as the fallback for its own key. */
const LOGO_BY_STATION = {
  mso: "/images/logo-mso.png",
  mrs: "/images/logo-mrs.png",   // drop M&M's logo at this path and it prints automatically
}

export function PrintHeader({ title, subtitle }) {
  const [logoOk, setLogoOk] = React.useState(true)

  /* The letterhead follows whichever station you're printing for — an M&M daily
     summary carries M&M's logo and name, not MSO's. */
  const stationKey = activeStation()
  const station = getStation(stationKey)
  const LOGO_SRC = LOGO_BY_STATION[stationKey] || LOGO_BY_STATION.mso
  /* Colours come straight from the station's own theme, NOT from the
     --brand-* CSS variables. Those variables are painted by a different hook
     and can still hold MSO blue at print time, which is how an M&M printout
     ended up blue. Reading the theme here means the printout always matches
     the station it was printed for. */
  const { primary, accent } = station.theme
  const monogram = (station.short || station.name || "").slice(0, 3)

  return (
    /* width:100% is what makes the alignment work at all. The element is
       display:flex with space-between (see the print rules in global.css), but
       a flex container shrinks to fit its content by default — with no width,
       both halves sat squashed together in the middle of the page instead of
       pushing out to the margins. */
    <div
      className="print-header"
      style={{
        width: "100%",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 24,
        borderBottom: `3px solid ${primary}`,
        paddingBottom: 14,
        marginBottom: 20,
      }}
    >
      {/* ── Left: logo + company ─────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        {!logoOk && (
          /* No logo file for this station yet: a clean monogram badge in the
             station's own colours instead of a broken-image icon. */
          <div
            style={{
              height: 52, minWidth: 52, padding: "0 10px", borderRadius: 10,
              background: primary, color: accent, display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em",
              printColorAdjust: "exact", WebkitPrintColorAdjust: "exact",
            }}
          >
            {monogram}
          </div>
        )}
        {logoOk && (
          <img
            key={LOGO_SRC}
            src={LOGO_SRC}
            alt=""
            onError={() => setLogoOk(false)}
            style={{
              height: 52,
              maxWidth: 180,
              width: "auto",
              objectFit: "contain",
              display: "block",
              /* Browsers strip background colours and images when printing as
                 an ink-saving default — this is the usual reason a colour logo
                 comes out grey or missing. Capped at maxWidth so an unusually
                 wide source file can't spill past the printable margin and
                 read as "cut off." */
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact",
            }}
          />
        )}
        <div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 900,
              color: primary,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
            }}
          >
            {station.legalName}
          </div>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              color: accent,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              marginTop: 3,
            }}
          >
            Digital Operations Console
          </div>
        </div>
      </div>

      {/* ── Right: document title + date ─────────────────────── */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: "#000",
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "#1E293B", marginTop: 4, fontWeight: 800 }}>
            {subtitle}
          </div>
        )}
        <div style={{ fontSize: 10, color: "#475569", marginTop: 5, fontWeight: 700 }}>
          Printed{" "}
          {new Date().toLocaleDateString("en-NG", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>
    </div>
  )
}
