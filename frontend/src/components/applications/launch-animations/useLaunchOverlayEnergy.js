import { useEffect, useState } from 'react';

export function useLaunchOverlayEnergy(active = true, resetKey = null) {
  const [energy, setEnergy] = useState(0);

  useEffect(() => {
    if (!active) return undefined;

    setEnergy(0);
    const timer = window.setInterval(() => {
      setEnergy((current) => Math.min(1, current + 0.02));
    }, 80);

    return () => window.clearInterval(timer);
  }, [active, resetKey]);

  const boost = (amount = 0.12) => {
    setEnergy((current) => Math.min(1, current + amount));
  };

  return { energy, boost, setEnergy };
}
