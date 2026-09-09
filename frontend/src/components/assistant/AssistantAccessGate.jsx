import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { canUseAssistant } from '@/lib/roles';

export default function AssistantAccessGate() {
  const { user } = useAuth();

  if (!canUseAssistant(user)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
