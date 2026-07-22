import React from "react"

/**
 * The ring from the fintech mockup, wired to real steps instead of a static
 * mockup number. Circumference math: r=45 → C≈282.7. Offset shrinks as more
 * steps complete, same idea as a fitness ring closing.
 */
export default function TodayRing({ steps, onNext }) {
  const doneCount = steps.filter(s => s.done).length
  const total = steps.length
  const pct = total > 0 ? doneCount / total : 0
  const circumference = 282.7
  const offset = circumference * (1 - pct)
  const current = steps.find(s => !s.done)
  const allDone = !current

  return (
    <div className="ftk-glass mb-4 flex items-center gap-5 rounded-[28px] p-6">
      <div className="relative h-[104px] w-[104px] flex-shrink-0">
        <svg width="104" height="104" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="52" cy="52" r="45" stroke="rgba(255,255,255,0.08)" strokeWidth="9" fill="none" />
          <circle
            cx="52" cy="52" r="45" strokeWidth="9" fill="none" strokeLinecap="round"
            stroke="url(#ringGrad)"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--ftk-cyan)" />
              <stop offset="100%" stopColor="var(--ftk-violet)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="ftk-mono text-[19px] font-bold" style={{ color: "var(--ftk-ink)" }}>{doneCount}/{total}</div>
          <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.5px]" style={{ color: "var(--ftk-ink-faint)" }}>Done</div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.7px]" style={{ color: "var(--ftk-ink-faint)" }}>Today's Progress</div>
        <div className="mb-2.5 text-[15.5px] font-extrabold leading-tight" style={{ color: "var(--ftk-ink)" }}>
          {allDone ? "All caught up today" : `${current.label} is next`}
        </div>
        {!allDone && (
          <button
            type="button" onClick={() => onNext(current)}
            className="inline-flex items-center gap-1.5 rounded-[11px] px-3.5 py-2 text-[12px] font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, var(--ftk-cyan), var(--ftk-violet))" }}
          >
            Continue <i className="bi bi-arrow-right" />
          </button>
        )}
      </div>
    </div>
  )
}
