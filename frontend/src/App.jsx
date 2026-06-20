import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import NotificationCenter from '@/pages/NotificationCenter';
import ActivityTimeline from '@/pages/ActivityTimeline';
import Applications from '@/pages/Applications';
import ApplicationUsage from '@/pages/ApplicationUsage';
import ApplicationBrowser from '@/pages/ApplicationBrowser';
import BroadcastCenter from '@/pages/BroadcastCenter';
import SystemEvents from '@/pages/SystemEvents';
import AdminCalendar from '@/pages/AdminCalendar';
import Settings from '@/pages/Settings';
import Profile from '@/pages/Profile';
import CompanyFeed from '@/pages/CompanyFeed';
import Messages from '@/pages/Messages';
import PersonProfile from '@/pages/PersonProfile';
import People from '@/pages/People';
import OrgChart from '@/pages/OrgChart';
import UserManagement from '@/pages/UserManagement';
import NetworkHealthDashboard from '@/pages/NetworkHealthDashboard';
import Analytics from '@/pages/Analytics';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ForcedPasswordChange from '@/pages/ForcedPasswordChange';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import PwaInstallPrompt from '@/components/pwa/PwaInstallPrompt';
import PwaSplashScreen from '@/components/pwa/PwaSplashScreen';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ApplicationLaunchProvider } from '@/lib/ApplicationLaunchContext';

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
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (authError?.type === 'user_not_approved') {
    return <Navigate to="/login?status=pending_approval" replace />;
  }

  // Redirect to forced password change if user needs to change password
  if (forcePasswordChange) {
    return <ForcedPasswordChange />;
  }

  return (
    <ApplicationLaunchProvider>
      <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/feed" element={<CompanyFeed />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/new/:userId" element={<Messages />} />
        <Route path="/messages/:conversationId" element={<Messages />} />
        <Route path="/people" element={<People />} />
        <Route path="/organization" element={<OrgChart />} />
        <Route path="/people/org-chart" element={<LegacyOrgChartRedirect />} />
        <Route path="/people/:userId" element={<PersonProfile />} />
        <Route path="/users/:userId/dashboard" element={<LegacyUserDashboardRedirect />} />
        <Route path="/notifications" element={<NotificationCenter />} />
        <Route path="/activity" element={<ActivityTimeline />} />
        <Route path="/network-health" element={<NetworkHealthDashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/applications/usage" element={<ApplicationUsage />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/applications/:id/view" element={<ApplicationBrowser />} />
        <Route path="/admin/broadcast" element={<BroadcastCenter />} />
        <Route path="/admin/events" element={<SystemEvents />} />
        <Route path="/admin/network-health" element={<Navigate to="/network-health" replace />} />
        <Route path="/calendar" element={<AdminCalendar />} />
        <Route path="/admin/calendar" element={<Navigate to="/calendar" replace />} />
        <Route path="/admin/settings" element={<Navigate to="/settings?tab=admin" replace />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin/users" element={<UserManagement />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </ApplicationLaunchProvider>
  );
};

function App() {

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <PwaSplashScreen />
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </Router>
          <PwaInstallPrompt />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App