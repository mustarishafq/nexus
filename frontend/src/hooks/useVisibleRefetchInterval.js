import { useEffect, useState } from 'react';

export function useVisibleRefetchInterval(intervalMs) {
  const [visible, setVisible] = useState(() => (
    typeof document === 'undefined' ? true : !document.hidden
  ));

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  if (!intervalMs || !visible) {
    return false;
  }

  return intervalMs;
}
