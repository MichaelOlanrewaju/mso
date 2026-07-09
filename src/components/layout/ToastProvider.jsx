import React, { createContext, useCallback, useContext, useRef, useState } from "react"

const ToastContext = createContext(null)

const ICONS = {
  ok: { icon: "bi-check-circle-fill", bg: "#F0FDF4", color: "#16A34A" },
  err: { icon: "bi-x-circle-fill", bg: "#FEF2F2", color: "#DC2626" },
  info: { icon: "bi-info-circle-fill", bg: "#EAF6FC", color: "#179DD0" },
  warn: { icon: "bi-exclamation-triangle-fill", bg: "#FFFBEB", color: "#B45309" },
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((title, msg, type = "info") => {
    setToast({ title, msg, type })
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setToast(null), 3500)
  }, [])

  const meta = ICONS[toast?.type] || { icon: "bi-bell-fill", bg: "#F1F5F9", color: "#64748B" }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={`fixed right-[18px] z-[9999] flex min-w-[230px] items-center gap-[11px] rounded-2xl border border-border bg-white p-3 px-4 shadow-lift transition-all duration-300 bottom-20 md:bottom-20
          ${toast ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-3 opacity-0 pointer-events-none"}`}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base"
          style={{ background: meta.bg }}
        >
          <i className={`bi ${meta.icon}`} style={{ color: meta.color }} />
        </div>
        <div>
          <div className="text-[13px] font-bold text-ink">{toast?.title || "—"}</div>
          <div className="mt-0.5 text-[11.5px] text-ink-3">{toast?.msg || ""}</div>
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within a ToastProvider")
  return ctx
}
