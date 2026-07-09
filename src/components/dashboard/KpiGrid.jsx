import React from "react"
import KpiCard from "./KpiCard"
import Badge from "./Badge"
import Sparkline from "./Sparkline"
import { naira, litres } from "../../utils/format"

export default function KpiGrid({ status, data }) {
  const loading = status === "loading" || status === "idle"
  const opening = status === "opening"
  const noData = status === "no-data" || status === "error"

  const trend =
    status === "ready" && data?.weekly?.days?.length > 1
      ? data.weekly.days.map((_, i) => (data.weekly.pms[i] || 0) + (data.weekly.ago[i] || 0))
      : null

  // ── Grand Total foot ──
  let totalFoot = <Badge tone="neutral">Loading…</Badge>
  let totalValue = (
    <span className="skel-dark inline-block h-6 w-[130px] align-middle" />
  )

  if (opening) {
    totalValue = <span style={{ color: "#FBBF24" }}>Pending</span>
    totalFoot = (
      <span style={{ color: "#FBBF24" }}>⏳ Opening dip recorded — awaiting closing</span>
    )
  } else if (noData) {
    totalValue = <span className="text-white/50">—</span>
    totalFoot = <Badge tone="neutral">No data today yet</Badge>
  } else if (status === "ready" && data) {
    totalValue = naira(data.grandTotal)
    if (data.live) {
      totalFoot = (
        <>
          <Badge tone="neutral">● Live</Badge>
          &nbsp;from recorded sales — cash-up pending
        </>
      )
    } else if (data.totalChange !== null && data.totalChange !== undefined) {
      const up = data.totalChange >= 0
      totalFoot = (
        <>
          <Badge tone={up ? "up" : "down"}>
            {up ? "↑" : "↓"}
            {Math.abs(data.totalChange).toFixed(1)}%
          </Badge>
          &nbsp;vs yesterday
        </>
      )
    } else {
      totalFoot = <Badge tone="neutral">No comparison yet</Badge>
    }
  }

  // ── PMS / AGO / Cash / Expenses ──
  const pmsOpeningLitres =
    data?.tanks?.pms?.reduce((s, t) => s + t.opening, 0)
  const agoOpeningLitres = data?.tanks?.ago ? Number(data.tanks.ago.opening) : null

  function metric({ ready, value, foot, pendingFoot }) {
    if (loading) return { value: null, foot: null, isLoading: true }
    if (opening) return { value: "Pending", foot: pendingFoot, pending: true }
    if (noData) return { value: "—", foot: "—", muted: true }
    return { value, foot, isLoading: false }
  }

  const pms = metric({
    value: litres(data?.pmsLitres, { maximumFractionDigits: 2 }),
    foot: naira(data?.pmsRevenue),
    pendingFoot: pmsOpeningLitres !== undefined ? `opening: ${litres(pmsOpeningLitres)}` : "—",
  })
  const ago = metric({
    value: litres(data?.agoLitres, { maximumFractionDigits: 2 }),
    foot: naira(data?.agoRevenue),
    pendingFoot: agoOpeningLitres !== null ? `opening: ${litres(agoOpeningLitres)}` : "—",
  })
  const cash = metric({
    value: naira(data?.cashToBank),
    foot: "After POS charges",
    pendingFoot: "cashier pending",
  })
  const exp = metric({
    value: opening ? "₦0" : naira(data?.expenses),
    foot: opening ? "no expenses yet" : "—",
    pendingFoot: "no expenses yet",
  })

  const pendingStyle = { color: "#F59E0B" }
  const mutedStyle = { opacity: 0.5 }

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-[1.35fr_1fr_1fr_1fr_1fr]">
      <div className="col-span-2 lg:col-span-1">
        <KpiCard
          variant="hero"
          icon="bi-graph-up-arrow"
          iconBg="rgba(23,157,208,.18)"
          iconColor="#179DD0"
          label="Grand Total"
          value={totalValue}
          foot={totalFoot}
          loading={loading}
          delay={0}
          signature={trend && <Sparkline values={trend} stroke="#179DD0" />}
        />
      </div>
      <KpiCard
        variant="cyan"
        icon="bi-fuel-pump"
        iconBg="#EAF6FC"
        iconColor="#1188B5"
        label="PMS Sold"
        value={<span style={pms.pending ? pendingStyle : pms.muted ? mutedStyle : undefined}>{pms.value}</span>}
        foot={pms.foot}
        loading={loading}
        delay={80}
      />
      <KpiCard
        variant="amber"
        icon="bi-droplet-fill"
        iconBg="#FFFBEB"
        iconColor="#D97706"
        label="AGO Sold"
        value={<span style={ago.pending ? pendingStyle : ago.muted ? mutedStyle : undefined}>{ago.value}</span>}
        foot={ago.foot}
        loading={loading}
        delay={140}
      />
      <KpiCard
        variant="green"
        icon="bi-bank2"
        iconBg="#F0FDF4"
        iconColor="#16A34A"
        label="Cash to Bank"
        value={<span style={cash.pending ? pendingStyle : cash.muted ? mutedStyle : undefined}>{cash.value}</span>}
        foot={cash.foot}
        loading={loading}
        delay={200}
      />
      <KpiCard
        variant="red"
        icon="bi-arrow-down-circle-fill"
        iconBg="#FEF2F2"
        iconColor="#DC2626"
        label="Expenses"
        value={<span style={exp.muted ? mutedStyle : undefined}>{exp.value}</span>}
        foot={exp.foot}
        loading={loading}
        delay={260}
      />
    </div>
  )
}
