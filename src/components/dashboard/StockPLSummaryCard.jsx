import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { activeStation } from "../../utils/station"
import { naira } from "../../utils/format"
import { getToken } from "../../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

function toISO(d) { return d.toISOString().split("T")[0] }

/* Read-only preview of today's Stock P&L — deliberately uses the
   same read-only getStockPL action the page itself uses on load, so
   this card can never accidentally trigger the FIFO computation
   (that only ever happens from an explicit "Compute" tap on the
   Stock P&L page itself). If today hasn't been computed yet, this
   just says so and invites a tap through, rather than showing a
   stale or fabricated number. */
export default function StockPLSummaryCard({ auth }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!SCRIPT_URL) { setLoading(false); return }
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getStockPL")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", toISO(new Date()))
    url.searchParams.set("username", auth?.username || "")
    url.searchParams.set("token", getToken() || "")
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(res => { if (res.ok) setData(res) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [auth?.username])

  const computed = data?.cached
  const overall = computed ? data.overall : null

  return (
    <button
      type="button"
      onClick={() => navigate(`/stock-pl/${activeStation()}`)}
      className="block w-full overflow-hidden rounded-card border border-border bg-white text-left shadow-card active:opacity-90"
    >
      <div className="flex items-center justify-between p-4">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.8px] text-ink-4">
            <i className="bi bi-layers-fill" /> Stock P&amp;L — Today
          </div>
          <div className={`mono mt-1 text-[24px] font-black tracking-tight ${computed && overall < 0 ? "text-red" : "text-ink"}`}>
            {loading ? "…" : computed ? naira(overall) : "Not computed yet"}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-4">
            {computed ? "PMS + AGO, net of expenses & charges" : "Tap to compute today's figures"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: "#ECFDF5" }}>
            <i className="bi bi-layers-fill text-[18px]" style={{ color: "#059669" }} />
          </div>
          <i className="bi bi-chevron-right text-ink-4" />
        </div>
      </div>
      <div className="border-t border-surface bg-surface/50 px-4 py-2 text-[11px] font-semibold text-ink-3">
        Tap to see the full breakdown, week and month views
      </div>
    </button>
  )
}
