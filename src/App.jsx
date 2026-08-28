import React, { Suspense, lazy } from "react"
import UpdateBanner from "./components/layout/UpdateBanner"
import { Routes, Route } from "react-router-dom"
import { OfflineBanner } from "./components/pwa/PWABanners"
import StationGuard from "./components/layout/StationGuard"
import { useAuth } from "./hooks/useAuth"
import { useStation } from "./hooks/useStation"
import { usePriceWatch } from "./hooks/usePriceWatch"
import { usePushNotifications } from "./hooks/usePushNotifications"
import PriceChangeAlert from "./components/layout/PriceChangeAlert"

const LandingPage            = lazy(() => import("./pages/LandingPage"))
const LoginPage              = lazy(() => import("./pages/LoginPage"))
const SelectStationPage      = lazy(() => import("./pages/SelectStationPage"))
const DashboardPage          = lazy(() => import("./pages/DashboardPage"))
const GMDashboardPage        = lazy(() => import("./pages/GMDashboardPage"))
const BankDepositPage        = lazy(() => import("./pages/BankDepositPage"))
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
const AttendantsPage         = lazy(() => import("./pages/AttendantsPage"))
const AttendantProfilePage   = lazy(() => import("./pages/AttendantProfilePage"))
const ClearShortagePage      = lazy(() => import("./pages/ClearShortagePage"))
const AttendantPerformancePage = lazy(() => import("./pages/AttendantPerformancePage"))
const PhotoDownloadPage      = lazy(() => import("./pages/PhotoDownloadPage"))
const ExcessPage             = lazy(() => import("./pages/ExcessPage"))
const AttendancePage         = lazy(() => import("./pages/AttendancePage"))
const ChatPage               = lazy(() => import("./pages/ChatPage"))
const ProfilePage            = lazy(() => import("./pages/ProfilePage"))
const StationAssignmentPage  = lazy(() => import("./pages/StationAssignmentPage"))
const PriceCorrectionPage    = lazy(() => import("./pages/PriceCorrectionPage"))
const ForgotPasswordPage     = lazy(() => import("./pages/ForgotPasswordPage"))
const ResetPasswordPage      = lazy(() => import("./pages/ResetPasswordPage"))
const DischargePage          = lazy(() => import("./pages/DischargePage"))
const AdminDashboardPage     = lazy(() => import("./pages/AdminDashboardPage"))
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

  /* Resolve the station from the signed-in user and paint its brand onto the
     document. Everything downstream — colours, tank layout, which spreadsheet
     gets written to — follows from this one call. */
  useStation(auth)

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
      <UpdateBanner />
      {isSupervisor && <PriceChangeAlert change={pendingChange} onDismissForNow={acknowledge} />}
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/select" element={<SelectStationPage />} />
          <Route path="/dashboard/:station" element={<StationGuard><DashboardPage /></StationGuard>} />
          <Route path="/dashboard-supervisor/:station" element={<StationGuard><SupervisorDashboardPage /></StationGuard>} />
          <Route path="/dashboard-gm/:station" element={<StationGuard><GMDashboardPage /></StationGuard>} />
          <Route path="/bank-deposits/:station" element={<StationGuard><BankDepositPage /></StationGuard>} />
          <Route path="/records/:station" element={<StationGuard><RecordsPage /></StationGuard>} />
          <Route path="/dashboard-cashier/:station" element={<StationGuard><CashierDashboardPage /></StationGuard>} />
          <Route path="/cashup/:station" element={<StationGuard><CashupPage /></StationGuard>} />
          <Route path="/expenses/:station" element={<StationGuard><ExpensesPage /></StationGuard>} />
          <Route path="/summary/:station" element={<StationGuard><SummaryPage /></StationGuard>} />
          <Route path="/dip/:station" element={<StationGuard><DipPage /></StationGuard>} />
          <Route path="/sales/:station" element={<StationGuard><SalesPage /></StationGuard>} />
          <Route path="/price/:station" element={<StationGuard><PricePage /></StationGuard>} />
          <Route path="/lubricant/:station" element={<StationGuard><LubricantPage /></StationGuard>} />
          <Route path="/shortage/:station" element={<StationGuard><ShortagePage /></StationGuard>} />
          <Route path="/activity/:station" element={<StationGuard><ActivityLogPage /></StationGuard>} />
          <Route path="/discharge/:station" element={<StationGuard><DischargePage /></StationGuard>} />
          <Route path="/admin/:station" element={<StationGuard><AdminDashboardPage /></StationGuard>} />
          <Route path="/shifts/:station" element={<StationGuard><ShiftsPage /></StationGuard>} />
          <Route path="/debtors/:station" element={<StationGuard><DebtorsPage /></StationGuard>} />
          <Route path="/orders/:station" element={<StationGuard><OrdersPage /></StationGuard>} />
          <Route path="/variance/:station" element={<StationGuard><VariancePage /></StationGuard>} />
          <Route path="/pnl/:station" element={<StationGuard><PnLPage /></StationGuard>} />
          <Route path="/payroll/:station" element={<StationGuard><PayrollPage /></StationGuard>} />
          <Route path="/add-staff/:station" element={<StationGuard><AddStaffPage /></StationGuard>} />
          <Route path="/attendants/:station" element={<StationGuard><AttendantsPage /></StationGuard>} />
          <Route path="/attendant/:station/:attendantId" element={<StationGuard><AttendantProfilePage /></StationGuard>} />
          <Route path="/clear-shortage/:station" element={<StationGuard><ClearShortagePage /></StationGuard>} />
          <Route path="/attendant-performance/:station" element={<StationGuard><AttendantPerformancePage /></StationGuard>} />
          <Route path="/photos/:station" element={<StationGuard><PhotoDownloadPage /></StationGuard>} />
          <Route path="/excess/:station" element={<StationGuard><ExcessPage /></StationGuard>} />
          <Route path="/attendance/:station" element={<StationGuard><AttendancePage /></StationGuard>} />
          <Route path="/chat/:station" element={<StationGuard><ChatPage /></StationGuard>} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/station-assignments" element={<StationAssignmentPage />} />
          <Route path="/correct-prices" element={<PriceCorrectionPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  )
}
