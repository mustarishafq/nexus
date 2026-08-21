import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { canViewNetworkHealth } from '@/lib/roles';
import { startNetworkHealthMonitor, stopNetworkHealthMonitor } from '@/lib/networkHealthMonitor';

export function useNetworkHealthMonitor() {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !canViewNetworkHealth(user)) {
      return undefined;
    }

    const stop = startNetworkHealthMonitor();
    return () => {
      stop();
      stopNetworkHealthMonitor();
    };
  }, [isAuthenticated, isLoadingAuth, user]);
}
