import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { canViewGames } from '@/lib/roles';

export default function GamesAccessGate() {
  const { user } = useAuth();

  if (!canViewGames(user)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
