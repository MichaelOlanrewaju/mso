/**
 * Per-station configuration — the single source of truth for what physically
 * exists at each site.
 *
 * This replaces the old src/config/pumps.js, which hardcoded MSO's layout and
 * assumed every station looked the same. They don't: M&M has no Tank 3, its
 * pumps map to different tanks, and it trades under its own brand.
 *
 * The internal key stays `mrs` — that's what SHEET_ID_MRS, getSheet('mrs') and
 * every backend handler already use, and renaming it would mean touching the
 * whole API. Only the DISPLAY name changes.
 */

export const STATIONS = {
  mso: {
    key: "mso",
    /* Confirmed directly: this station is genuinely, physically branded
       Mobil — MSO Limpid is the parent company, but the pump signage and
       real-world identity here is Mobil. Only the DISPLAY changes; the
       key stays "mso" since that's what SHEET_ID_MSO, getSheet('mso') and
       every backend handler already use, and this station's own data is
       completely unaffected by the rename. */
    name: "Mobil",
    legalName: "Mobil Idowu Egba",
    short: "Mobil",
    theme: {
      /* Confirmed directly: no red at all — #00AAFB is Mobil's real
         color here, used prominently. Primary is a deep, dark shade of
         that SAME blue (for backgrounds/headers, where a theme needs
         depth and contrast) rather than a different hue entirely, so
         the two colors read as one cohesive blue identity, not two
         colors bolted together. */
      primary: "#003D5C",    // deep Mobil blue
      accent: "#00AAFB",     // Mobil light blue — the dominant, most-used color
      primaryDark: "#002639",
      accentDark: "#0088C9",
      accentLight: "#E6F7FF",
      primaryLight: "#E1F5FF",
      gradient: "linear-gradient(135deg,#003D5C 0%,#002639 100%)",
      gradientBtn: "linear-gradient(135deg,#003D5C,#00AAFB)",
    },
    tanks: [
      { id: "TK1", product: "PMS", cap: 45000, pumps: ["P5", "P6"] },
      { id: "TK2", product: "PMS", cap: 45000, pumps: ["P1", "P2"] },
      { id: "TK3", product: "PMS", cap: 45000, pumps: ["P3", "P4"] },
      { id: "TK4", product: "AGO", cap: 45000, pumps: ["P1"] },
      // LPG is tracked in KG throughout — 2.5 tonnes = 2,500 KG.
      { id: "TK5", product: "LPG", cap: 2500, unit: "KG", pumps: ["LPG1"] },
    ],
    pumps: [
      { id: "P5", tank: "TK1", product: "PMS" },
      { id: "P6", tank: "TK1", product: "PMS" },
      { id: "P1", tank: "TK2", product: "PMS" },
      { id: "P2", tank: "TK2", product: "PMS" },
      { id: "P3", tank: "TK3", product: "PMS" },
      { id: "P4", tank: "TK3", product: "PMS" },
      // The AGO nozzle sits on the same physical pump as P1, so it needs its
      // own id to avoid colliding with P1's PMS reading.
      { id: "P1_AGO", pumpId: "P1", tank: "TK4", product: "AGO" },
      { id: "LPG1", tank: "TK5", product: "LPG", unit: "KG" },
    ],
  },

  mrs: {
    key: "mrs",
    name: "M&M Oil and Gas",
    legalName: "M&M Oil and Gas Ltd",
    short: "M&M",
    theme: {
      primary: "#5f1f33",   // wine
      accent: "#eaaa18",    // gold
      primaryDark: "#4A1828",
      accentDark: "#C88F0F",
      accentLight: "#FDF6E3",
      primaryLight: "#F5EBEF",
      /* Wine and gold are kept SEPARATE. Blending them (as the old gradient did)
         produced a muddy brown-orange where they met, dulling both. The primary
         gradient now stays entirely within the wine family — deep wine to a
         slightly lighter wine — so headers and buttons read as clean, rich wine.
         Gold lives on its own as the accent (highlights, active states, small
         touches), never mixed into the wine. */
      gradient: "linear-gradient(135deg,#5f1f33 0%,#7A2942 100%)",
      gradientBtn: "linear-gradient(135deg,#5f1f33,#6d2740)",
    },
    /* NOTE: there is deliberately no TK3 here. M&M has four tanks, numbered
       1, 2, 4 and 5 — the gap is real, not an oversight. Anything that loops
       tanks must read this list rather than assuming TK1..TK4, or it will
       report on a tank that doesn't exist. */
    tanks: [
      { id: "TK1", product: "PMS", cap: 45000, pumps: ["P1", "P4"] },
      { id: "TK2", product: "PMS", cap: 45000, pumps: ["P2", "P3"] },
      { id: "TK4", product: "AGO", cap: 45000, pumps: ["P1"] },
      { id: "TK5", product: "LPG", cap: 2500, unit: "KG", pumps: ["LPG1"] },
    ],
    pumps: [
      { id: "P1", tank: "TK1", product: "PMS" },
      { id: "P2", tank: "TK2", product: "PMS" },
      { id: "P3", tank: "TK2", product: "PMS" },
      { id: "P4", tank: "TK1", product: "PMS" },
      { id: "P1_AGO", pumpId: "P1", tank: "TK4", product: "AGO" },
      { id: "LPG1", tank: "TK5", product: "LPG", unit: "KG" },
    ],
  },

  msoo: {
    key: "msoo",
    /* A brand new, third station — takes over the "MSO" name and the
       original navy/cyan colors, since this is the one genuinely
       branded MSO. Confirmed directly: not built out yet — no real
       tank/pump setup or backend sheet exists for it. comingSoon
       gates it to a placeholder screen wherever it's selected, rather
       than a broken or empty dashboard. */
    name: "MSO Limpid",
    legalName: "MSO Limpid Co. Ltd",
    short: "MSO",
    comingSoon: true,
    theme: {
      primary: "#130656",   // navy
      accent: "#179DD0",    // cyan
      primaryDark: "#0D0440",
      accentDark: "#1188B5",
      accentLight: "#EAF6FC",
      primaryLight: "#E9E7F5",
      gradient: "linear-gradient(135deg,#130656 0%,#1a0875 52%,#179DD0 175%)",
      gradientBtn: "linear-gradient(135deg,#130656,#179DD0)",
    },
    // Not built out yet — deliberately empty until the real tank/pump
    // setup is provided.
    tanks: [],
    pumps: [],
  },
}

export const STATION_KEYS = Object.keys(STATIONS)

export function getStation(key) {
  return STATIONS[String(key || "").toLowerCase()] || STATIONS.mso
}

/* Does this station have a given tank? M&M has no TK3, and the DailySales sheet
   carries TK3_* columns regardless — so anything reading those columns has to
   ask first, or it will happily report a phantom tank sitting at zero. */
export function hasTank(stationKey, tankId) {
  return getStation(stationKey).tanks.some(t => t.id === tankId)
}

export function tanksFor(stationKey) {
  return getStation(stationKey).tanks
}

export function pumpsFor(stationKey) {
  return getStation(stationKey).pumps
}

export function themeFor(stationKey) {
  return getStation(stationKey).theme
}
