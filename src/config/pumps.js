// Single source of truth for tank → pump structure. MSO: TK1→P5,P6
// TK2→P1,P2 TK3→P3,P4 TK4(AGO)→P1. Each pump has ONE combined metre
// reading (not split per nozzle) per station owner's instruction —
// the original sales-mso.html tracked 2 nozzles per pump, but in
// actual day-to-day use the station enters one combined number.

export const TANKS = [
  { id: "TK1", product: "PMS", cap: 19600, pumps: ["P5", "P6"] },
  { id: "TK2", product: "PMS", cap: 19600, pumps: ["P1", "P2"] },
  { id: "TK3", product: "PMS", cap: 19600, pumps: ["P3", "P4"] },
  { id: "TK4", product: "AGO", cap: 3200, pumps: ["P1"] },
  { id: "TK5", product: "LPG", cap: 5000, unit: "KG", pumps: ["LPG1"] },
]

export const PUMPS = [
  { id: "P5", tank: "TK1", product: "PMS" },
  { id: "P6", tank: "TK1", product: "PMS" },
  { id: "P1", tank: "TK2", product: "PMS" },
  { id: "P2", tank: "TK2", product: "PMS" },
  { id: "P3", tank: "TK3", product: "PMS" },
  { id: "P4", tank: "TK3", product: "PMS" },
  { id: "P1_AGO", pumpId: "P1", tank: "TK4", product: "AGO" },
  { id: "LPG1", tank: "TK5", product: "LPG", unit: "KG" },
]
