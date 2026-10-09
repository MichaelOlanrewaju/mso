import React from "react"
import { activeStation } from "../../../utils/station"
import { getStation } from "../../../config/stations"

export default function OpsContextStrip({ area = "Operations", step, tone = "neutral", children }) {
  const station = getStation(activeStation())
  return (
    <div className={`mso-ops-context mso-ops-context-${tone}`}>
      <div className="mso-ops-context-left">
        <span className="mso-ops-context-mark"><i className="bi bi-grid-1x2-fill" /></span>
        <div className="min-w-0">
          <div className="mso-ops-context-area">{area}</div>
          <div className="mso-ops-context-station">{station.name}</div>
        </div>
      </div>
      <div className="mso-ops-context-right">
        {step && <span className="mso-ops-context-step">{step}</span>}
        <span className="mso-ops-live"><span /> LIVE</span>
        {children}
      </div>
    </div>
  )
}
