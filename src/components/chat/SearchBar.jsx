import React from "react"

/**
 * Glass search field. Filters conversations and staff client-side —
 * no endpoint, no debounce needed, the roster is small.
 */
export default function SearchBar({ value, onChange, placeholder = "Search chats and people" }) {
  return (
    <div className="relative">
      <i
        aria-hidden="true"
        className="bi bi-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-white/55"
      />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search chats and people"
        className="h-[46px] w-full rounded-[16px] border border-white/20 bg-white/12 pl-11 pr-11 text-[14px] font-medium text-white outline-none backdrop-blur-md transition-colors duration-200 placeholder:text-white/50 focus:border-white/40 focus:bg-white/[0.18]"
        style={{ WebkitAppearance: "none" }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white/70 transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
        >
          <i className="bi bi-x text-[15px]" />
        </button>
      )}
    </div>
  )
}
