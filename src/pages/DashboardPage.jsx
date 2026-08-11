import React, { useState } from "react"
import CashupApprovalPreview from "../components/dashboard/CashupApprovalPreview"
import CashAtHandCard from "../components/dashboard/CashAtHandCard"
import PhotoUploadToggleCard from "../components/dashboard/PhotoUploadToggleCard"
import { getStation } from "../config/stations"
import Sidebar from "../components/layout/Sidebar"
import Topbar from "../components/layout/Topbar"
import BottomNav from "../components/layout/BottomNav"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import DayHero from "../components/dashboard/DayHero"
import MorningReadingsCard from "../components/dashboard/MorningReadingsCard"
import OilCard from "../components/dashboard/OilCard"
import SectionLabel from "../components/dashboard/SectionLabel"
import PeriodTotalsCard from "../components/dashboard/PeriodTotalsCard"
import DipSummaryCard from "../components/dashboard/DipSummaryCard"
import AgoCard from "../components/dashboard/AgoCard"
import PaymentBreakdown from "../components/dashboard/PaymentBreakdown"
import TankLevelsCard from "../components/dashboard/TankLevelsCard"
import SalesTrendCard from "../components/dashboard/SalesTrendCard"
import TransactionsCard from "../components/dashboard/TransactionsCard"
import ExpensesCard from "../components/dashboard/ExpensesCard"
import AlertsCard from "../components/dashboard/AlertsCard"
import StationSwitcherCard from "../components/dashboard/StationSwitcherCard"
import QuickActionsCard from "../components/dashboard/QuickActionsCard"
import PayrollApprovalCard from "../components/dashboard/PayrollApprovalCard"
import { NotificationPrompt, TestNotificationButton } from "../components/pwa/PWABanners"
import { useAuth } from "../hooks/useAuth"
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
  /* Must be declared here, unconditionally, alongside every other hook —
     not after the early return below. A hook called only on SOME renders
     (skipped whenever auth is still loading, called once it resolves) breaks
     React's hook-count matching between renders and crashes with "Rendered
     more hooks than during the previous render." This used to sit right
     before its own comment further down, past the early return — that's
     exactly the bug. */
  const [cashupPreviewDate, setCashupPreviewDate] = useState(null)

  usePageTitle(`Dashboard — ${getStation(activeStation()).name}`)

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }

  /* Each action refreshes the dashboard on success, so the acted-on item leaves
     the "Needs your attention" panel immediately instead of lingering until a
     manual page refresh. (Payroll approve/reject self-refreshes via its own
     hook, so it isn't repeated here.) */
  const handleReviewShortage = (rowIndex, decision) =>
    reviewShortage({ rowIndex, decision, username: auth.username }).then(d => {
      if (d.ok) { toast.showToast("Updated", "Shortage marked as reviewed", "ok"); refresh() }
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  const handleApproveEdit = rowIndex =>
    reviewEdit(rowIndex, "approve").then(d => {
      if (d.ok) { toast.showToast("Approved", "Supervisor can now edit that record", "ok"); refresh() }
      else toast.showToast("Could not process", d.error || "Try again", "err")
    })

  const handleRejectEdit = rowIndex =>
    reviewEdit(rowIndex, "reject").then(d => {
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

        <div className="flex-1 p-3.5 pb-[calc(14px+64px)] md:p-6 md:pb-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <div className="enter" style={delay(0)}>
            </div>

            {/* Only for people who actually oversee both sites. A single-station
                user has nothing to switch to, so they never see it. */}
            <div className="enter" style={delay(0)}>
              <StationSwitcherCard show={auth.station === "both" || auth.isOwner || auth.role === "ceo" || auth.role === "gm"} />
            </div>

            {notifPermission === "granted" && (
              <div className="enter mb-3 flex justify-end" style={delay(0)}>
                <TestNotificationButton />
              </div>
            )}

            {/* ── The answer first ──────────────────────────────────────
                An owner opens this at 7am with one question: how did we do,
                and is anything wrong? Previously they had to scroll past
                three status pills, a totals card and a section label before
                reaching a number. Now the takings lead, the day's close-out
                sits beside them as context, and anything needing a decision
                is the very next thing on the page — not the fourth. */}
            <div className="enter mb-5" style={delay(1)}>
              <DayHero status={status} data={data} />
            </div>

            {/* Cash At Hand sits right under the PMS-on-hand hero — both are
                "what's actually sitting at the station right now" figures,
                fuel and cash, so they read naturally as a pair. */}
            <div className="enter mb-3" style={delay(1)}>
              <CashAtHandCard />
            </div>

            <div className="enter" style={delay(1)}>
              <PhotoUploadToggleCard role={auth.role} username={auth.username} />
            </div>

            {/* The morning's actual numbers — the first real work of the day,
                and previously invisible on this page. Sits directly under the
                hero because for most of the working day it IS the day's data:
                closing meters, price and cash-up don't land until evening. */}
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

            {/* Attention rail — promoted from fourth position to second.
                It renders its own "all clear" state, so it stays put rather
                than appearing and disappearing and shifting the page. */}
            <div className="enter mb-5" style={delay(2)}>
              <SectionLabel>Period totals</SectionLabel>
              <PeriodTotalsCard />
            </div>

            <div className="enter mb-5" style={delay(3)}>
              <SectionLabel>Needs your attention</SectionLabel>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="flex flex-col gap-4 lg:col-span-8">
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
                </div>
                <div className="lg:col-span-4">
                  <QuickActionsCard role={auth.role} username={auth.username} />
                </div>
              </div>
            </div>

            {/* ── Then the detail ──────────────────────────────────────
                Everything below is reporting: true, useful, but not urgent.
                It's grouped so related cards sit on one row instead of
                stacking six equal-weight sections down the page. */}

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
              <SectionLabel>Recent activity</SectionLabel>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <TransactionsCard status={status} transactions={data?.recentTransactions} />
                </div>
                <div className="lg:col-span-4">
                  <ExpensesCard status={status} expensesTotal={data?.expenses} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
      {showNotifPrompt && <NotificationPrompt onDismiss={() => setShowNotifPrompt(false)} />}
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

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  )
}
