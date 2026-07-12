import React from "react"

export default function SectionLabel({ children, action }) {
  return (
    <div className="mb-3.5 mt-1 flex items-center gap-3">
      {/* A short brand bar rather than a dot — it reads as a deliberate
          structural marker instead of a bullet point. */}
      <span
        aria-hidden
        className="h-[13px] w-[3px] flex-shrink-0 rounded-full"
        style={{ background: "linear-gradient(180deg,#130656,#179DD0)" }}
      />
      <h2 className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-ink-2">
        {children}
      </h2>
      <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      {action}
    </div>
  )
}
