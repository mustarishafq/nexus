import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const LightboxStackContext = createContext({
  isLightboxOpen: false,
  registerLightbox: () => {},
  unregisterLightbox: () => {},
});

export function LightboxStackProvider({ children }) {
  const [openCount, setOpenCount] = useState(0);

  const registerLightbox = useCallback(() => {
    setOpenCount((count) => count + 1);
  }, []);

  const unregisterLightbox = useCallback(() => {
    setOpenCount((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo(
    () => ({
      isLightboxOpen: openCount > 0,
      registerLightbox,
      unregisterLightbox,
    }),
    [openCount, registerLightbox, unregisterLightbox]
  );

  return (
    <LightboxStackContext.Provider value={value}>
      {children}
    </LightboxStackContext.Provider>
  );
}

export function useLightboxStack() {
  return useContext(LightboxStackContext);
}
