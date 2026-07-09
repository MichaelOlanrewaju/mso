import React from "react"

export default function StepProgress({ total, current }) {
  return (
    <div className="mb-1 flex gap-[3px]">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[3px] flex-1 rounded-full transition-colors"
          style={{
            background: i < current ? "#179DD0" : i === current ? "rgba(23,157,208,.5)" : "rgba(255,255,255,.15)",
          }}
        />
      ))}
    </div>
  )
}
