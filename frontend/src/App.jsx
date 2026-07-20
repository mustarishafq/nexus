import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import PageLoader from '@/components/PageLoader';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { LightboxStackProvider } from '@/components/media/LightboxStackContext';
import { ApplicationLaunchProvider } from '@/lib/ApplicationLaunchContext';
import { SplashGateProvider } from '@/lib/SplashGateContext';

const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const Login = lazy(() => import('@/pages/Login'));
const OAuthConsent = lazy(() => import('@/pages/OAuthConsent'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const ForcedPasswordChange = lazy(() => import('@/pages/ForcedPasswordChange'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const PwaInstallPrompt = lazy(() => import('@/components/pwa/PwaInstallPrompt'));
const PwaSplashScreen = lazy(() => import('@/components/pwa/PwaSplashScreen'));

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const NotificationCenter = lazy(() => import('@/pages/NotificationCenter'));
const ActivityTimeline = lazy(() => import('@/pages/ActivityTimeline'));
const Applications = lazy(() => import('@/pages/Applications'));
const ApplicationUsage = lazy(() => import('@/pages/ApplicationUsage'));
const ApplicationBrowser = lazy(() => import('@/pages/ApplicationBrowser'));
const BroadcastCenter = lazy(() => import('@/pages/BroadcastCenter'));
const SystemEvents = lazy(() => import('@/pages/SystemEvents'));
const AdminCalendar = lazy(() => import('@/pages/AdminCalendar'));
const ScanQr = lazy(() => import('@/pages/ScanQr'));
const EventCheckInPublic = lazy(() => import('@/pages/EventCheckInPublic'));
const Settings = lazy(() => import('@/pages/Settings'));
const Profile = lazy(() => import('@/pages/Profile'));
const CompanyFeed = lazy(() => import('@/pages/CompanyFeed'));
const Messages = lazy(() => import('@/pages/Messages'));
const PersonProfile = lazy(() => import('@/pages/PersonProfile'));
const People = lazy(() => import('@/pages/People'));
const OrgChart = lazy(() => import('@/pages/OrgChart'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const NetworkHealthDashboard = lazy(() => import('@/pages/NetworkHealthDashboard'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Attendance = lazy(() => import('@/pages/Attendance'));
const AttendanceClockIn = lazy(() => import('@/pages/AttendanceClockIn'));
const AttendanceRecords = lazy(() => import('@/pages/AttendanceRecords'));
const Email = lazy(() => import('@/pages/Email'));

function LegacyUserDashboardRedirect() {
  const { userId } = useParams();
  return <Navigate to={`/people/${userId}`} replace />;
}

function LegacyOrgChartRedirect() {
  const location = useLocation();
  return <Navigate to={`/organization${location.search}`} replace />;
}

const ProtectedRoutes = () => {
  const { isLoadingAuth, isLoadingPublicSettings, isAuthenticated, authError, forcePasswordChange } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (authError?.type === 'user_not_approved') {
    return <Navigate to="/login?status=pending_approval" replace />;
  }

  // Redirect to forced password change if user needs to change password
  if (forcePasswordChange) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ForcedPasswordChange />
      </Suspense>
    );
  }

  return (
    <ApplicationLaunchProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/feed" element={<CompanyFeed />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/new/:userId" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Messages />} />
          <Route path="/email/compose" element={<Email />} />
          <Route path="/email/:uid" element={<Email />} />
          <Route path="/email" element={<Email />} />
          <Route path="/people" element={<People />} />
          <Route path="/organization" element={<OrgChart />} />
          <Route path="/people/org-chart" element={<LegacyOrgChartRedirect />} />
          <Route path="/people/:userId" element={<PersonProfile />} />
          <Route path="/users/:userId/dashboard" element={<LegacyUserDashboardRedirect />} />
          <Route path="/notifications" element={<NotificationCenter />} />
          <Route path="/activity" element={<ActivityTimeline />} />
          <Route path="/network-health" element={<NetworkHealthDashboard />} />
          <Route path="/attendance" element={<Attendance />}>
            <Route index element={<AttendanceClockIn />} />
            <Route path="records" element={<AttendanceRecords />} />
          </Route>
          <Route path="/admin/attendance" element={<Navigate to="/attendance/records" replace />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/applications/usage" element={<ApplicationUsage />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/applications/:id/view" element={<ApplicationBrowser />} />
          <Route path="/admin/broadcast" element={<BroadcastCenter />} />
          <Route path="/admin/events" element={<SystemEvents />} />
          <Route path="/admin/network-health" element={<Navigate to="/network-health" replace />} />
          <Route path="/calendar" element={<AdminCalendar />} />
          <Route path="/scan-qr" element={<ScanQr />} />
          <Route path="/admin/calendar" element={<Navigate to="/calendar" replace />} />
          <Route path="/admin/settings" element={<Navigate to="/settings?tab=admin" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin/users" element={<UserManagement />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      </Suspense>
    </ApplicationLaunchProvider>
  );
};

function App() {

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <LightboxStackProvider>
          <SplashGateProvider>
          <Suspense fallback={null}>
            <PwaSplashScreen />
          </Suspense>
          <Router>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/mcp-consent" element={<OAuthConsent />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/event-check-in/:token" element={<EventCheckInPublic />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </Suspense>
          </Router>
          <Suspense fallback={null}>
            <PwaInstallPrompt />
          </Suspense>
          </SplashGateProvider>
          <Toaster />
          </LightboxStackProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
