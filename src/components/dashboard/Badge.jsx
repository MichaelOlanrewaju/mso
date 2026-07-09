import React from "react"

const STYLES = {
  up: "bg-green-light text-green",
  down: "bg-red-light text-red",
  neutral: "bg-surface text-ink-3",
}

export default function Badge({ tone = "neutral", children }) {
  return (
    <span className={`rounded-full px-[7px] py-0.5 text-[10px] font-bold ${STYLES[tone]}`}>{children}</span>
  )
}
