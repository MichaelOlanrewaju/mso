import React, { createContext, useCallback, useContext, useRef, useState } from "react"

const ToastContext = createContext(null)

const ICONS = {
  ok: { icon: "bi-check-circle-fill", bg: "#F0FDF4", color: "#16A34A" },
  err: { icon: "bi-x-circle-fill", bg: "#FEF2F2", color: "#DC2626" },
  info: { icon: "bi-info-circle-fill", bg: "#EAF6FC", color: "#179DD0" },
  warn: { icon: "bi-exclamation-triangle-fill", bg: "#EAF6FC", color: "#1188B5" },
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((title, msg, type = "info") => {
    setToast({ title, msg, type })
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setToast(null), 3500)
  }, [])

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  const meta = ICONS[toast?.type] || { icon: "bi-bell-fill", bg: "#F1F5F9", color: "#64748B" }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* role=status + aria-live so screen readers announce toasts;
          tap anywhere on it to dismiss early. Bottom offset respects
          the device safe area so it never hugs the home indicator. */}
      <div
        role="status"
        aria-live="polite"
        onClick={dismiss}
        className={`fixed right-4 z-[9999] flex min-w-[240px] max-w-[calc(100vw-32px)] cursor-pointer items-center gap-[11px] rounded-2xl border border-border bg-white p-3 px-4 shadow-toast transition-all duration-300
          ${toast ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-3 opacity-0 pointer-events-none"}`}
        style={{ bottom: "calc(80px + var(--sab, 0px))" }}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base"
          style={{ background: meta.bg }}
        >
          <i className={`bi ${meta.icon}`} style={{ color: meta.color }} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-ink">{toast?.title || "—"}</div>
          {toast?.msg ? <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{toast.msg}</div> : null}
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
