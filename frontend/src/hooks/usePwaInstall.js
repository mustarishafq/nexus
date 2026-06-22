import { useEffect, useState } from 'react';

import {
  getPwaInstallState,
  promptPwaInstall,
  subscribePwaInstallState,
} from '@/lib/pwa';

export function usePwaInstall() {
  const [state, setState] = useState(getPwaInstallState);

  useEffect(() => subscribePwaInstallState(setState), []);

  return {
    ...state,
    install: promptPwaInstall,
  };
}
