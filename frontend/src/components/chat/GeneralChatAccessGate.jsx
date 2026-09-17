import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { canUseGeneralChat } from '@/lib/roles';

export default function GeneralChatAccessGate() {
  const { user } = useAuth();

  if (!canUseGeneralChat(user)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
