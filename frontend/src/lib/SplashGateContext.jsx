import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { shouldShowPwaSplash } from '@/lib/splashSession';

const SplashGateContext = createContext({
  splashComplete: true,
  markSplashComplete: () => {},
});

export function useSplashGate() {
  return useContext(SplashGateContext);
}

export function SplashGateProvider({ children }) {
  const [splashComplete, setSplashComplete] = useState(() => !shouldShowPwaSplash());

  const markSplashComplete = useCallback(() => {
    setSplashComplete(true);
  }, []);

  const value = useMemo(
    () => ({ splashComplete, markSplashComplete }),
    [splashComplete, markSplashComplete],
  );

  return (
    <SplashGateContext.Provider value={value}>
      {children}
    </SplashGateContext.Provider>
  );
}
