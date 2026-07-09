import React from "react"

export default function AdminBanner({ visible }) {
  if (!visible) return null
  return (
    <div className="mb-[18px] flex items-center gap-2.5 rounded-[11px] border border-cyan/20 bg-cyan-light px-4 py-[11px] text-[12.5px] font-medium text-[#0B5874]">
      <i className="bi bi-eye-fill" />
      <span>
        Viewing as <strong>Owner</strong> — data entry is handled by supervisors and cashiers.
      </span>
    </div>
  )
}
