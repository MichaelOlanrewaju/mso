import React, { useState } from "react"
import CashupApprovalPreview from "../components/dashboard/CashupApprovalPreview"
import Sidebar from "../components/layout/Sidebar"
import Topbar from "../components/layout/Topbar"
import BottomNav from "../components/layout/BottomNav"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import SectionLabel from "../components/dashboard/SectionLabel"
import DayHero from "../components/dashboard/DayHero"
import MorningReadingsCard from "../components/dashboard/MorningReadingsCard"
import OilCard from "../components/dashboard/OilCard"
import { TestNotificationButton } from "../components/pwa/PWABanners"
import PeriodTotalsCard from "../components/dashboard/PeriodTotalsCard"
import DipSummaryCard from "../components/dashboard/DipSummaryCard"
import AgoCard from "../components/dashboard/AgoCard"
import PaymentBreakdown from "../components/dashboard/PaymentBreakdown"
import TankLevelsCard from "../components/dashboard/TankLevelsCard"
import SalesTrendCard from "../components/dashboard/SalesTrendCard"
import TransactionsCard from "../components/dashboard/TransactionsCard"
import AlertsCard from "../components/dashboard/AlertsCard"
import StationSwitcherCard from "../components/dashboard/StationSwitcherCard"
import QuickActionsCard from "../components/dashboard/QuickActionsCard"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePWA, useLiveNotifications } from "../hooks/usePWA"
import { useEditRequests, useCashupApprovals } from "../hooks/useApprovals"
import { useDashboardData } from "../hooks/useDashboardData"
import { useShortages } from "../hooks/useShortages"
import { usePendingPayroll } from "../hooks/usePayroll"
import { usePageTitle } from "../hooks/usePageTitle"
import { initials, roleLabel } from "../utils/format"
/* The station comes from the signed-in user's session, not a build-time env
   var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

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
  /* Same fix as DashboardPage.jsx — must be declared unconditionally,
     before the early return below, or React sees a different hook count
     on the loading render vs. the resolved render and crashes. */
  const [cashupPreviewDate, setCashupPreviewDate] = useState(null)

  usePageTitle("Dashboard — GM")

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }


  /* Every one of these must call refresh() on success. Without it the server
     approves/rejects correctly, but the "Needs your attention" panel keeps
     showing the item — it's built from dashboard data that was never reloaded.
     That's why a rejected item appeared stuck: the action worked, the panel just
     never updated. */
  const handleApprove = rowIndex =>
    review(rowIndex, "approve").then(d => {
      if (d.ok) { toast.showToast("Approved", "Supervisor can now edit that record", "ok"); refresh() }
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  const handleReject = rowIndex =>
    review(rowIndex, "reject").then(d => {
      if (d.ok) { toast.showToast("Rejected", "Edit request rejected", "ok"); refresh() }
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  /* Approve no longer fires immediately from the alert card — it opens this
     preview first, so the report is on screen at the moment the decision is
     actually made, not something you have to have separately remembered to
     check via "View". (State declared above, before the early return.) */

  const doApproveCashup = date =>
    decideCashup(date, "approve").then(d => {
      if (d.ok) { toast.showToast("Approved", `Cash reconciliation for ${date} approved`, "ok"); refresh() }
      else toast.showToast("Could not process", d.error || "Try again", "err")
      setCashupPreviewDate(null)
    })

  const handleApproveCashup = date => setCashupPreviewDate(date)

  const handleRejectCashup = date =>
    decideCashup(date, "reject").then(d => {
      if (d.ok) { toast.showToast("Rejected", `Cashier can now correct and resubmit ${date}`, "ok"); refresh() }
      else toast.showToast("Could not process", d.error || "Try again", "err")
      setCashupPreviewDate(null)
    })

  const handleReviewShortage = (rowIndex, decision) =>
    reviewShortage({ rowIndex, decision, username: auth.username }).then(d => {
      if (d.ok) { toast.showToast("Updated", "Shortage marked as reviewed", "ok"); refresh() }
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  /* Do we have any real morning readings to show? Drives both the card and its
     section heading, so they appear and disappear together rather than leaving
     an orphaned label above empty space. */
  const hasMorningReadings =
    status === "loading" ||
    (data?.tankLevels || []).some(t => (t.vol || 0) > 0) ||
    Object.keys(data?.pumpMetres || {}).length > 0

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

        <div className="flex-1 p-3.5 pb-[100px] md:p-6 md:pb-6">
          <div className="mx-auto w-full max-w-[1400px]">
            {/* Only for people who oversee both sites — a GM tied to one station
                has nothing to switch to and never sees this. */}
            <div className="enter" style={delay(0)}>
              <StationSwitcherCard show={auth.station === "both" || auth.role === "gm" || auth.role === "owner" || auth.role === "ceo"} />
            </div>

            {notifPermission === "granted" && (
              <div className="enter mb-3 flex justify-end" style={delay(0)}>
                <TestNotificationButton />
              </div>
            )}

            {/* Same hierarchy as the owner dashboard: the number first, the
                day's close-out beside it, then anything needing a decision.
                The GM's job is running the day, so what changes here is what
                they can ACT on — payroll stays read-only (owner approves it),
                and every other approval is theirs. */}
            <div className="enter mb-5" style={delay(1)}>
              <DayHero status={status} data={data} />
            </div>

            {notifPermission === "default" && (
              <div className="enter mb-5 flex items-center gap-3 rounded-panel border border-cyan/20 bg-cyan-light px-4 py-3.5" style={delay(2)}>
                <i className="bi bi-bell-fill text-[18px] text-cyan-dark" />
                <div className="flex-1">
                  <div className="text-[12.5px] font-bold text-ink">Get notified for pending approvals</div>
                  <div className="text-[11px] text-ink-4">While this dashboard is open, you'll get an alert the moment something needs your review.</div>
                </div>
                <button type="button" onClick={requestNotifications}
                  className="flex-shrink-0 rounded-[9px] px-3.5 py-2 text-[12px] font-bold text-white transition-all hover:brightness-110 active:scale-95"
                  style={{ background: "var(--brand-gradient-btn)" }}>
                  Enable
                </button>
              </div>
            )}

            {/* Hidden entirely until the morning readings exist. DayHero already
                covers the "waiting on the opening dip" state; saying it again on a
                stacked card underneath was just the same sentence twice. */}
            {hasMorningReadings && (
              <div className="enter mb-5" style={delay(2)}>
                <SectionLabel>This morning</SectionLabel>
                <MorningReadingsCard
                  status={status}
                  tankLevels={data?.tankLevels}
                  pumpMetres={data?.pumpMetres}
                  submittedBy={data?.submittedBy}
                />
              </div>
            )}

            <div className="enter mb-5" style={delay(2)}>
              <SectionLabel>Period totals</SectionLabel>
              <PeriodTotalsCard />
            </div>

            <div className="enter mb-5" style={delay(3)}>
              <SectionLabel>Needs your attention</SectionLabel>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-8">
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
                </div>
                <div className="lg:col-span-4 space-y-3">
                  <QuickActionsCard role={auth.role} username={auth.username} />
                </div>
              </div>
            </div>


            <div className="enter mb-5" style={delay(3)}>
              <SectionLabel>Tanks &amp; payments</SectionLabel>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
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
            </div>

            <div className="enter mb-5" style={delay(4)}>
              <SectionLabel>Stock &amp; sales trend</SectionLabel>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
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
            </div>

            <div className="enter mb-5" style={delay(5)}>
              <SectionLabel>Oil</SectionLabel>
              <OilCard />
            </div>


            <div className="enter" style={delay(6)}>
              <SectionLabel>Recent transactions</SectionLabel>
              <TransactionsCard status={status} transactions={data?.recentTransactions} />
            </div>
          </div>
        </div>
      </div>

      <BottomNav homePath={dashboardPathFor({ role: auth.role, station: auth.station })} />
      {cashupPreviewDate && (
        <CashupApprovalPreview
          date={cashupPreviewDate}
          onApprove={() => doApproveCashup(cashupPreviewDate)}
          onReject={() => handleRejectCashup(cashupPreviewDate)}
          onClose={() => setCashupPreviewDate(null)}
        />
      )}
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
