import React from "react"
import { avatarColor, initials } from "./tokens"

/**
 * Initials avatar. `radius` accepts any CSS length ("50%" for a circle,
 * "16px" for the squircle used on conversation cards).
 * `ring` draws a white halo + tinted outer ring, used on the People rail.
 */
export default function Avatar({
  name,
  size = 46,
  radius = "16px",
  ring = false,
  icon = null,
  className = "",
  style = {},
}) {
  const color = avatarColor(name)
  return (
    <div
      aria-hidden="true"
      className={`flex flex-shrink-0 select-none items-center justify-center text-white ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: icon ? undefined : color,
        fontSize: Math.round(size * 0.36),
        fontWeight: 700,
        letterSpacing: "-0.02em",
        boxShadow: ring ? `0 0 0 2.5px #fff, 0 0 0 4.5px ${color}40` : "none",
        ...style,
      }}
    >
      {icon || initials(name)}
    </div>
  )
}
