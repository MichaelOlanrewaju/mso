import React, { useState } from "react"
import Sidebar from "../components/layout/Sidebar"
import Topbar from "../components/layout/Topbar"
import BottomNav from "../components/layout/BottomNav"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import SectionLabel from "../components/dashboard/SectionLabel"
import TodayStatusPills from "../components/dashboard/TodayStatusPills"
import PeriodTotalsCard from "../components/dashboard/PeriodTotalsCard"
import DipSummaryCard from "../components/dashboard/DipSummaryCard"
import AgoCard from "../components/dashboard/AgoCard"
import PaymentBreakdown from "../components/dashboard/PaymentBreakdown"
import TankLevelsCard from "../components/dashboard/TankLevelsCard"
import SalesTrendCard from "../components/dashboard/SalesTrendCard"
import TransactionsCard from "../components/dashboard/TransactionsCard"
import AlertsCard from "../components/dashboard/AlertsCard"
import QuickActionsCard from "../components/dashboard/QuickActionsCard"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePWA, useLiveNotifications } from "../hooks/usePWA"
import { useEditRequests, useCashupApprovals } from "../hooks/useApprovals"
import { useDashboardData } from "../hooks/useDashboardData"
import { useShortages } from "../hooks/useShortages"
import { usePendingPayroll } from "../hooks/usePayroll"
import { usePageTitle } from "../hooks/usePageTitle"
import { initials, roleLabel } from "../utils/format"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

function delay(step) {
  return { animationDelay: `${Math.min(step * 60, 360)}ms` }
}

function GMInner() {
  const auth = useAuth({ requireAuth: true, stationFilter: "mso" })
  const { notifPermission, requestNotifications } = usePWA()
  useLiveNotifications({ enabled: notifPermission === "granted", username: auth.username })
  const { status, data, loading, refresh } = useDashboardData(auth.username)
  const { requests: editRequests, review } = useEditRequests(auth.username)
  const { pending: pendingCashups, decide: decideCashup } = useCashupApprovals(auth.username)
  const { shortages, reviewShortage } = useShortages({ all: false })
  const { pending: pendingPayroll } = usePendingPayroll(auth.username)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toast = useToast()

  usePageTitle("Dashboard — GM")

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }


  const handleApprove = rowIndex =>
    review(rowIndex, "approve").then(d => {
      if (d.ok) toast.showToast("Approved", "Supervisor can now edit that record", "ok")
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  const handleReject = rowIndex =>
    review(rowIndex, "reject").then(d => {
      if (d.ok) toast.showToast("Rejected", "Edit request rejected", "ok")
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  const handleApproveCashup = date =>
    decideCashup(date, "approve").then(d => {
      if (d.ok) toast.showToast("Approved", `Cash reconciliation for ${date} approved`, "ok")
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  const handleRejectCashup = date =>
    decideCashup(date, "reject").then(d => {
      if (d.ok) toast.showToast("Rejected", `Cashier can now correct and resubmit ${date}`, "ok")
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  const handleReviewShortage = (rowIndex, decision) =>
    reviewShortage({ rowIndex, decision, username: auth.username }).then(d => {
      if (d.ok) toast.showToast("Updated", "Shortage marked as reviewed", "ok")
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  return (
    <div className="flex min-h-screen">
      <SafeAreaDebug />

      <Sidebar
        isOwner={false}
        isGM={true}
        name={auth.name || auth.username}
        role={roleLabel(auth.role)}
        avatarInitials={initials(auth.name || auth.username)}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={auth.logout}
        homePath={dashboardPathFor({ role: auth.role, station: auth.station })}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:ml-sidebar">
        <Topbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          loading={loading}
          onRefresh={refresh}
          title="GM Dashboard"
        />

        <div className="flex-1 p-3.5 pb-[100px] md:p-[22px] md:pb-[22px]">
          <div className="enter" style={delay(0)}>
            <SectionLabel>Today's Status</SectionLabel>
          </div>
          <div className="enter mb-5" style={delay(0)}>
            <TodayStatusPills todayStatus={data?.todayStatus} loading={status === "loading"} />
          </div>

          <div className="enter" style={delay(2)}>
            <SectionLabel>Totals</SectionLabel>
          </div>
          <div className="enter mb-3" style={delay(2)}>
            <PeriodTotalsCard />
          </div>

          {notifPermission === "default" && (
            <div className="enter mb-3 flex items-center gap-3 rounded-card border border-cyan/20 bg-cyan-light px-4 py-3.5" style={delay(3)}>
              <i className="bi bi-bell-fill text-[18px] text-cyan-dark" />
              <div className="flex-1">
                <div className="text-[12.5px] font-bold text-ink">Get notified for pending approvals</div>
                <div className="text-[11px] text-ink-4">While this dashboard is open, you'll get an alert the moment something needs your review.</div>
              </div>
              <button type="button" onClick={requestNotifications}
                className="flex-shrink-0 rounded-[9px] bg-cyan-dark px-3.5 py-2 text-[12px] font-bold text-white">
                Enable
              </button>
            </div>
          )}

          <div className="enter" style={delay(3)}>
            <SectionLabel>Needs Your Attention</SectionLabel>
          </div>
          <div className="enter mb-3 grid grid-cols-1 gap-3 lg:grid-cols-12" style={delay(3)}>
            <div className="flex flex-col gap-3 lg:col-span-12">
              <AlertsCard
                tankLevels={data?.tankLevels}
                editRequests={editRequests}
                onApproveEdit={handleApprove}
                onRejectEdit={handleReject}
                shortages={shortages}
                onReviewShortage={handleReviewShortage}
                pendingPayroll={pendingPayroll}
                payrollReadOnly
                pendingCashups={pendingCashups}
                onApproveCashup={handleApproveCashup}
                onRejectCashup={handleRejectCashup}
              />
              <QuickActionsCard role={auth.role} />
            </div>
          </div>

          <div className="enter" style={delay(4)}>
            <SectionLabel>Tank Performance</SectionLabel>
          </div>
          <div className="enter mb-3 grid grid-cols-1 gap-3 lg:grid-cols-12" style={delay(4)}>
            <div className="lg:col-span-5">
              <DipSummaryCard status={status} tanks={data?.tanks?.pms} pmsPrice={data?.pmsPrice} />
            </div>
            <div className="lg:col-span-3">
              <AgoCard status={status} ago={data?.tanks?.ago} agoPrice={data?.agoPrice} />
            </div>
            <div className="lg:col-span-4">
              <PaymentBreakdown status={status} payments={data?.payments} />
            </div>
          </div>

          <div className="enter" style={delay(5)}>
            <SectionLabel>Fuel Stock &amp; Sales Trend</SectionLabel>
          </div>
          <div className="enter mb-3 grid grid-cols-1 gap-3 lg:grid-cols-12" style={delay(6)}>
            <div className="lg:col-span-4">
              <TankLevelsCard status={status} tankLevels={data?.tankLevels} />
            </div>
            <div className="lg:col-span-8">
              <SalesTrendCard
                status={status}
                weekly={data?.weekly}
                pmsRevenue={data?.pmsRevenue}
                agoRevenue={data?.agoRevenue}
              />
            </div>
          </div>

          <div className="enter" style={delay(7)}>
            <SectionLabel>Recent Transactions</SectionLabel>
          </div>
          <div className="enter" style={delay(8)}>
            <TransactionsCard status={status} transactions={data?.recentTransactions} />
          </div>
        </div>
      </div>

      <BottomNav homePath={dashboardPathFor({ role: auth.role, station: auth.station })} />
    </div>
  )
}

export default function GMDashboardPage() {
  return (
    <ToastProvider>
      <GMInner />
    </ToastProvider>
  )
}
