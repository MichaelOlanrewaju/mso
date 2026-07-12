import React, { Suspense, lazy } from "react"
import { Routes, Route } from "react-router-dom"
import { OfflineBanner } from "./components/pwa/PWABanners"
import { useAuth } from "./hooks/useAuth"
import { usePriceWatch } from "./hooks/usePriceWatch"
import { usePushNotifications } from "./hooks/usePushNotifications"
import PriceChangeAlert from "./components/layout/PriceChangeAlert"

const LandingPage            = lazy(() => import("./pages/LandingPage"))
const LoginPage              = lazy(() => import("./pages/LoginPage"))
const SelectStationPage      = lazy(() => import("./pages/SelectStationPage"))
const DashboardPage          = lazy(() => import("./pages/DashboardPage"))
const GMDashboardPage        = lazy(() => import("./pages/GMDashboardPage"))
const SupervisorDashboardPage= lazy(() => import("./pages/SupervisorDashboardPage"))
const CashierDashboardPage   = lazy(() => import("./pages/CashierDashboardPage"))
const RecordsPage            = lazy(() => import("./pages/RecordsPage"))
const CashupPage             = lazy(() => import("./pages/CashupPage"))
const ExpensesPage           = lazy(() => import("./pages/ExpensesPage"))
const SummaryPage            = lazy(() => import("./pages/SummaryPage"))
const DipPage                = lazy(() => import("./pages/DipPage"))
const SalesPage              = lazy(() => import("./pages/SalesPage"))
const PricePage              = lazy(() => import("./pages/PricePage"))
const LubricantPage = lazy(() => import("./pages/LubricantPage"))
const ShortagePage           = lazy(() => import("./pages/ShortagePage"))
const ActivityLogPage        = lazy(() => import("./pages/ActivityLogPage"))
const PayrollPage            = lazy(() => import("./pages/PayrollPage"))
const AddStaffPage           = lazy(() => import("./pages/AddStaffPage"))
const ChatPage               = lazy(() => import("./pages/ChatPage"))
const ProfilePage            = lazy(() => import("./pages/ProfilePage"))
const ForgotPasswordPage     = lazy(() => import("./pages/ForgotPasswordPage"))
const ResetPasswordPage      = lazy(() => import("./pages/ResetPasswordPage"))
const DischargePage          = lazy(() => import("./pages/DischargePage"))
const ShiftsPage             = lazy(() => import("./pages/ShiftsPage"))
const DebtorsPage            = lazy(() => import("./pages/DebtorsPage"))
const OrdersPage             = lazy(() => import("./pages/OrdersPage"))
const VariancePage           = lazy(() => import("./pages/VariancePage"))
const PnLPage                = lazy(() => import("./pages/PnLPage"))
const NotFoundPage           = lazy(() => import("./pages/NotFoundPage"))

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-pagebg">
      <span className="h-6 w-6 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
    </div>
  )
}

export default function App() {
  const auth = useAuth()

  // Initialize OneSignal web push once, app-wide, and keep the push
  // identity in sync with whoever is logged in. Doing it here (rather
  // than per-dashboard) means every role is covered uniformly and the
  // subscription is correctly attached/cleared across login and logout.
  // Passing null when logged out triggers clearPushUser inside the hook.
  usePushNotifications(
    !auth.loading && auth.user
      ? { username: auth.username, role: auth.role, station: auth.station }
      : null
  )

  // Only supervisors need the live cutover alert — they're the ones who
  // close pumps. GM/Owner already see price changes reflected wherever
  // they look; cashiers don't touch pump metres.
  const isSupervisor = !auth.loading && auth.user && auth.role === "supervisor"
  const { pendingChange, acknowledge } = usePriceWatch({ enabled: isSupervisor })

  return (
    <>
      <OfflineBanner />
      {isSupervisor && <PriceChangeAlert change={pendingChange} onDismissForNow={acknowledge} />}
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/select" element={<SelectStationPage />} />
          <Route path="/dashboard-mso" element={<DashboardPage />} />
          <Route path="/dashboard-supervisor-mso" element={<SupervisorDashboardPage />} />
          <Route path="/dashboard-gm-mso" element={<GMDashboardPage />} />
          <Route path="/records-mso" element={<RecordsPage />} />
          <Route path="/dashboard-cashier-mso" element={<CashierDashboardPage />} />
          <Route path="/cashup-mso" element={<CashupPage />} />
          <Route path="/expenses-mso" element={<ExpensesPage />} />
          <Route path="/summary-mso" element={<SummaryPage />} />
          <Route path="/dip-mso" element={<DipPage />} />
          <Route path="/sales-mso" element={<SalesPage />} />
          <Route path="/price-mso" element={<PricePage />} />
          <Route path="/lubricant-mso" element={<LubricantPage />} />
          <Route path="/shortage-mso"  element={<ShortagePage />} />
          <Route path="/activity-mso"  element={<ActivityLogPage />} />
          <Route path="/discharge-mso" element={<DischargePage />} />
          <Route path="/shifts-mso"    element={<ShiftsPage />} />
          <Route path="/debtors-mso"   element={<DebtorsPage />} />
          <Route path="/orders-mso"    element={<OrdersPage />} />
          <Route path="/variance-mso"  element={<VariancePage />} />
          <Route path="/pnl-mso"       element={<PnLPage />} />
          <Route path="/payroll-mso" element={<PayrollPage />} />
          <Route path="/add-staff-mso" element={<AddStaffPage />} />
          <Route path="/chat-mso" element={<ChatPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  )
}
