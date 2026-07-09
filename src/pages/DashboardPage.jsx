import React, { useState } from "react"
import Sidebar from "../components/layout/Sidebar"
import Topbar from "../components/layout/Topbar"
import BottomNav from "../components/layout/BottomNav"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import AdminBanner from "../components/dashboard/AdminBanner"
import SectionLabel from "../components/dashboard/SectionLabel"
import TodayStatusPills from "../components/dashboard/TodayStatusPills"
import PeriodTotalsCard from "../components/dashboard/PeriodTotalsCard"
import DipSummaryCard from "../components/dashboard/DipSummaryCard"
import AgoCard from "../components/dashboard/AgoCard"
import PaymentBreakdown from "../components/dashboard/PaymentBreakdown"
import TankLevelsCard from "../components/dashboard/TankLevelsCard"
import SalesTrendCard from "../components/dashboard/SalesTrendCard"
import TransactionsCard from "../components/dashboard/TransactionsCard"
import ExpensesCard from "../components/dashboard/ExpensesCard"
import AlertsCard from "../components/dashboard/AlertsCard"
import QuickActionsCard from "../components/dashboard/QuickActionsCard"
import PayrollApprovalCard from "../components/dashboard/PayrollApprovalCard"
import { NotificationPrompt } from "../components/pwa/PWABanners"
import { useAuth } from "../hooks/useAuth"
import { usePWA, useLiveNotifications } from "../hooks/usePWA"
import { useEditRequests, useCashupApprovals } from "../hooks/useApprovals"
import { useDashboardData } from "../hooks/useDashboardData"
import { useShortages } from "../hooks/useShortages"
import { usePendingPayroll } from "../hooks/usePayroll"
import { usePageTitle } from "../hooks/usePageTitle"
import { initials, roleLabel } from "../utils/format"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

// One orchestrated, capped stagger for the page-load sequence —
// each section ships 60ms later than the last, never feels sluggish.
function delay(step) {
  return { animationDelay: `${Math.min(step * 60, 360)}ms` }
}

function DashboardInner() {
  const auth = useAuth({ requireAuth: true })
  const { status, data, loading, refresh } = useDashboardData(auth.username)
  const { shortages, reviewShortage } = useShortages({ all: false })
  const { pending: pendingPayroll, approve: pendingPayrollApprove } = usePendingPayroll(auth.username)
  const { pending: pendingCashups, decide: decideCashup } = useCashupApprovals(auth.username)
  const { requests: editRequests, review: reviewEdit } = useEditRequests(auth.username)
  const { notifPermission } = usePWA()
  useLiveNotifications({ enabled: notifPermission === "granted", username: auth.username })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotifPrompt, setShowNotifPrompt] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'default'
  )
  const toast = useToast()

  usePageTitle("Dashboard — MSO Limpid")

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }

  const handleReviewShortage = (rowIndex, decision) =>
    reviewShortage({ rowIndex, decision, username: auth.username }).then(d => {
      if (d.ok) toast.showToast("Updated", "Shortage marked as reviewed", "ok")
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  const handleApproveEdit = rowIndex =>
    reviewEdit(rowIndex, "approve").then(d => {
      if (d.ok) toast.showToast("Approved", "Supervisor can now edit that record", "ok")
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  const handleRejectEdit = rowIndex =>
    reviewEdit(rowIndex, "reject").then(d => {
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

  const handleApprovePayroll = month =>
    pendingPayroll.length && pendingPayrollApprove({ month, decision: "approve", username: auth.username }).then(d => {
      if (d.ok) toast.showToast("Approved", `${month} payroll approved`, "ok")
      else toast.showToast("Could not approve", d.error || "Try again", "err")
    })

  const handleRejectPayroll = month =>
    pendingPayroll.length && pendingPayrollApprove({ month, decision: "reject", username: auth.username }).then(d => {
      if (d.ok) toast.showToast("Rejected", `${month} payroll rejected — GM can revise`, "ok")
      else toast.showToast("Could not reject", d.error || "Try again", "err")
    })

  return (
    <div className="flex min-h-screen">
      <SafeAreaDebug />

      <Sidebar
        isOwner={auth.isOwner}
        isGM={auth.isGM}
        name={auth.name || auth.username}
        role={roleLabel(auth.role)}
        avatarInitials={initials(auth.name || auth.username)}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={auth.logout}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:ml-sidebar">
        <Topbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          loading={loading}
          onRefresh={refresh}
        />

        <div className="flex-1 p-3.5 pb-[calc(14px+64px)] md:p-[22px] md:pb-[22px]">
          <div className="enter" style={delay(0)}>
            <AdminBanner visible={auth.isOwner} />
          </div>

          <div className="enter" style={delay(1)}>
            <SectionLabel>Today's Status</SectionLabel>
          </div>
          <div className="enter mb-5" style={delay(1)}>
            <TodayStatusPills todayStatus={data?.todayStatus} loading={status === "loading"} />
          </div>

          <div className="enter" style={delay(2)}>
            <SectionLabel>Totals</SectionLabel>
          </div>
          <div className="enter mb-3" style={delay(2)}>
            <PeriodTotalsCard />
          </div>

          <div className="enter" style={delay(3)}>
            <SectionLabel>Needs Your Attention</SectionLabel>
          </div>
          <div className="enter mb-3 flex flex-col gap-3" style={delay(3)}>
            <PayrollApprovalCard
              pendingPayroll={pendingPayroll}
              onApprove={handleApprovePayroll}
              onReject={handleRejectPayroll}
            />
            <AlertsCard
              tankLevels={data?.tankLevels}
              editRequests={editRequests}
              onApproveEdit={handleApproveEdit}
              onRejectEdit={handleRejectEdit}
              shortages={shortages}
              onReviewShortage={handleReviewShortage}
              pendingPayroll={pendingPayroll}
              pendingCashups={pendingCashups}
              onApproveCashup={handleApproveCashup}
              onRejectCashup={handleRejectCashup}
            />
            <QuickActionsCard role={auth.role} />
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
          <div className="enter mb-3 grid grid-cols-1 gap-3 lg:grid-cols-12" style={delay(5)}>
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

          <div className="enter" style={delay(6)}>
            <SectionLabel>Recent Transactions</SectionLabel>
          </div>
          <div className="enter grid grid-cols-1 gap-3 lg:grid-cols-12" style={delay(7)}>
            <div className="lg:col-span-8">
              <TransactionsCard status={status} transactions={data?.recentTransactions} />
            </div>
            <div className="lg:col-span-4">
              <ExpensesCard status={status} expensesTotal={data?.expenses} />
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
      {showNotifPrompt && <NotificationPrompt onDismiss={() => setShowNotifPrompt(false)} />}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  )
}
