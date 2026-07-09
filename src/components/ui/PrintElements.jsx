import React from "react"

// Both render nothing on screen (see the .print-header/.print-watermark
// rules in global.css) — they only appear in the actual printed output.
// Drop these into any page that has a print button, so every printed
// document gets the same consistent treatment instead of each page
// reinventing its own.

export function PrintHeader({ title, subtitle }) {
  return (
    <div className="print-header" style={{ alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #130656", paddingBottom: 12, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/images/msolimpid.png" alt="MSO Limpid" style={{ height: 40, width: "auto", filter: "invert(1) brightness(0)" }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#130656" }}>MSO Limpid Co. Ltd</div>
          <div style={{ fontSize: 10, color: "#64748B" }}>Digital Operations Console</div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: "#64748B" }}>{subtitle}</div>}
        <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>
          Printed {new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>
    </div>
  )
}

export function PrintWatermark({ text = "CONFIDENTIAL" }) {
  return (
    <div
      className="print-watermark"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: 90,
          fontWeight: 800,
          color: "rgba(19, 6, 86, 0.08)",
          transform: "rotate(-38deg)",
          whiteSpace: "nowrap",
          letterSpacing: 6,
        }}
      >
        {text}
      </div>
    </div>
  )
}
