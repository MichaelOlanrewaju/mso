export function naira(value) {
  const n = Number(value || 0)
  return `₦${n.toLocaleString("en-NG")}`
}

/* Litres are written WITHOUT thousands separators: 799140.12L, not 799,140.12L.
   These are meter and dip readings — they're read against a physical counter and
   transcribed, and the commas add visual noise to a number nobody reads as a
   quantity of money. Naira keeps its separators; volume does not. */
export function litres(value, opts = {}) {
  const n = Number(value || 0)
  const decimals = opts.maximumFractionDigits ?? 2
  const fixed = n.toFixed(decimals)
  /* Trim trailing zeros so a whole number reads 45000L, not 45000.00L, while
     45000.12L keeps its precision. */
  const trimmed = fixed.indexOf(".") >= 0 ? fixed.replace(/\.?0+$/, "") : fixed
  return `${trimmed}L`
}

/* Bare litres value, no unit suffix — for places that render their own "L". */
export function litresValue(value, opts = {}) {
  return litres(value, opts).slice(0, -1)
}

export function numberNG(value, opts = {}) {
  return Number(value || 0).toLocaleString("en-NG", opts)
}

export function initials(name) {
  return (name || "U")
    .split(" ")
    .map(part => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function roleLabel(role) {
  if (!role) return "—"
  if (role === "gm") return "General Manager"
  return role.charAt(0).toUpperCase() + role.slice(1)
}
