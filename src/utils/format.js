export function naira(value) {
  const n = Number(value || 0)
  return `₦${n.toLocaleString("en-NG")}`
}

export function litres(value, opts = {}) {
  const n = Number(value || 0)
  return `${n.toLocaleString("en-NG", opts)}L`
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
