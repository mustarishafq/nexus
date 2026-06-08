import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { startNetworkHealthMonitor, stopNetworkHealthMonitor } from '@/lib/networkHealthMonitor';

export function useNetworkHealthMonitor() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated) {
      return undefined;
    }

    const stop = startNetworkHealthMonitor();
    return () => {
      stop();
      stopNetworkHealthMonitor();
    };
  }, [isAuthenticated, isLoadingAuth]);
}
