import React from "react"

export default function WizardNav({ onBack, onNext, isLast, saving }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[500] border-t border-cyan/10 bg-white px-3.5 py-2.5 shadow-[0_-4px_20px_rgba(19,6,86,.08)]"
      style={{ paddingBottom: "calc(10px + var(--sab))" }}
    >
      <div className="mx-auto flex max-w-[640px] gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-[12px] border border-border bg-surface text-ink-2 transition-all hover:bg-cyan-light hover:text-cyan-dark"
        >
          <i className="bi bi-arrow-left text-lg" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={saving}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[12px] text-[14px] font-bold text-white shadow-lift transition-all disabled:opacity-50"
          style={{
            background: isLast ? "linear-gradient(135deg, #16A34A, #15803D)" : "linear-gradient(135deg, #130656, #179DD0)",
          }}
        >
          {saving ? (
            <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              {isLast ? "Save & Submit" : "Save & Continue"}
              <i className="bi bi-arrow-right" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
