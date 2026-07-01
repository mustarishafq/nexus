import React, { createContext, useContext, useMemo, useState } from 'react';

const CelebrationGateContext = createContext({
  birthdayModalOpen: false,
  setBirthdayModalOpen: () => {},
});

export function useCelebrationGate() {
  return useContext(CelebrationGateContext);
}

export function CelebrationGateProvider({ children }) {
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);

  const value = useMemo(
    () => ({ birthdayModalOpen, setBirthdayModalOpen }),
    [birthdayModalOpen],
  );

  return (
    <CelebrationGateContext.Provider value={value}>
      {children}
    </CelebrationGateContext.Provider>
  );
}
