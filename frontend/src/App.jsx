import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import NotificationCenter from '@/pages/NotificationCenter';
import ActivityTimeline from '@/pages/ActivityTimeline';
import ConnectedSystems from '@/pages/ConnectedSystems';
import BroadcastCenter from '@/pages/BroadcastCenter';
import SystemEvents from '@/pages/SystemEvents';
import AdminSettings from '@/pages/AdminSettings';
import Settings from '@/pages/Settings';
import UserManagement from '@/pages/UserManagement';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import PwaInstallPrompt from '@/components/pwa/PwaInstallPrompt';

const ProtectedRoutes = () => {
  const { isLoadingAuth, isLoadingPublicSettings, isAuthenticated, authError } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (authError?.type === 'user_not_approved') {
    return <Navigate to="/login?status=pending_approval" replace />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/notifications" element={<NotificationCenter />} />
        <Route path="/activity" element={<ActivityTimeline />} />
        <Route path="/systems" element={<ConnectedSystems />} />
        <Route path="/admin/broadcast" element={<BroadcastCenter />} />
        <Route path="/admin/events" element={<SystemEvents />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin/users" element={<UserManagement />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </Router>
        <PwaInstallPrompt />
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App