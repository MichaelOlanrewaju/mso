/* Shared visual tokens + pure helpers for the Chat List screen.
   Kept in one place so cards, header and rails can never drift apart. */

export const BRAND_GRADIENT =
  "var(--brand-gradient-btn)"

/* Header gets a deeper, longer throw than the small chips/avatars so the
   surface reads as a single sheet of glass rather than a flat fill. */
export const HEADER_GRADIENT =
  "var(--brand-gradient)"

export const CARD_SHADOW = "0 2px 10px rgba(19,6,86,.06)"
export const CARD_SHADOW_HOVER = "0 10px 28px rgba(19,6,86,.13)"

const AVATAR_COLORS = ["var(--brand-accent)", "var(--brand-primary)", "#16A34A", "var(--brand-accent)", "#DC2626", "#7C3AED"]

export function avatarColor(name) {
  return AVATAR_COLORS[(name || " ").charCodeAt(0) % AVATAR_COLORS.length]
}

export function initials(name) {
  return (name || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
}

/* Timestamp for a conversation row: time today, "Yesterday", else a short date. */
export function timeLabel(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const dayDiff = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
      new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000
  )
  if (dayDiff === 0)
    return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true })
  if (dayDiff === 1) return "Yesterday"
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })
}

/* Greeting keyed to the station's working day, not a generic "Hello". */
export function greetingFor(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

/* First name only — the header greeting shouldn't shout a full legal name. */
export function firstName(name) {
  return (name || "").trim().split(" ")[0] || ""
}
