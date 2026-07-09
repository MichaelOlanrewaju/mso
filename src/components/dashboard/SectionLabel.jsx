import React from "react"

export default function SectionLabel({ children }) {
  return (
    <div className="mb-3 mt-1 flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[1.6px] text-ink-3">
      <span className="h-[3px] w-[3px] rounded-full bg-cyan" aria-hidden />
      {children}
      <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
    </div>
  )
}
