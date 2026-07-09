import React from "react"
import { useClock } from "../../hooks/useClock"

export default function Topbar({ sidebarOpen, onToggleSidebar, loading, onRefresh, title = "Dashboard" }) {
  const { time, date } = useClock()

  return (
    <header
      className="sticky top-0 z-[900] flex flex-shrink-0 items-center justify-between gap-2.5 border-b border-border bg-white px-[14px] pb-2.5 pt-[max(var(--sat),52px)] shadow-[0_1px_4px_rgba(0,0,0,.04)] md:px-[22px] md:pt-[max(var(--sat),14px)]"
      style={{ minHeight: "calc(60px + max(var(--sat), 52px))" }}
    >
      <div
        className={`pulse-line absolute bottom-0 left-0 right-0 h-[2px] transition-opacity duration-500 ${
          loading ? "opacity-100" : "opacity-0"
        }`}
      />

      <div className="flex min-w-0 flex-shrink items-center gap-3.5 overflow-hidden">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle menu"
          className={`flex h-[38px] w-[38px] flex-shrink-0 appearance-none items-center justify-center rounded-[9px] border border-border bg-surface text-xl text-navy transition-all duration-150 lg:hidden
            ${sidebarOpen ? "border-cyan/30 bg-cyan-light text-cyan-dark" : "hover:border-cyan/30 hover:bg-cyan-light hover:text-cyan-dark"}`}
        >
          <i className={`bi ${sidebarOpen ? "bi-x-lg" : "bi-list"}`} />
        </button>
        <div className="min-w-0 overflow-hidden">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-extrabold tracking-[-0.03em] leading-tight text-navy md:text-[17px]">
            {title}
          </div>
          <div className="mt-px text-[9.5px] text-ink-4 md:text-[10.5px]">{date}</div>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5 md:gap-2">
        {loading && (
          <div className="hidden items-center gap-1.5 text-[11px] font-semibold text-cyan md:flex">
            <div className="h-3.5 w-3.5 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
            Fetching…
          </div>
        )}
        <div className="hidden items-center gap-1 rounded-full border border-navy/10 bg-[#EEF0FB] px-3 py-[5px] text-[11px] font-bold text-navy md:inline-flex">
          <i className="bi bi-geo-alt-fill text-[10px]" />
          &nbsp;MSO
        </div>
        <div className="hidden items-center gap-1 rounded-full border border-[#BBF7D0] bg-green-light px-3 py-[5px] text-[11px] font-bold text-green md:inline-flex">
          <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-green" />
          &nbsp;LIVE
        </div>
        <div className="mono hidden rounded-lg border border-border bg-surface px-[11px] py-[5px] text-xs tracking-[0.02em] text-ink-2 lg:block">
          {time}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-border bg-surface text-[15px] text-ink-3 transition-all duration-150 hover:border-cyan/30 hover:bg-cyan-light hover:text-cyan md:h-[38px] md:w-[38px] md:text-base"
        >
          <i className={`bi bi-arrow-clockwise ${loading ? "animate-spin-fast" : ""}`} />
        </button>
        <button
          type="button"
          className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-border bg-surface text-[15px] text-ink-3 transition-all duration-150 hover:border-cyan/30 hover:bg-cyan-light hover:text-cyan md:h-[38px] md:w-[38px] md:text-base"
        >
          <i className="bi bi-bell" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-[1.5px] border-white bg-red" />
        </button>
      </div>
    </header>
  )
}
