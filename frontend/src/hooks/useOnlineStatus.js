import { useEffect, useState } from 'react';

const OFFLINE_CONFIRM_MS = 1500;
const RECHECK_MS = 10000;
const PROBE_TIMEOUT_MS = 4000;

/**
 * Probe real connectivity instead of trusting navigator.onLine alone.
 * Uses HEAD so the service worker (GET-only) does not serve a cached shell
 * and make us look "online" while the network is down — or the reverse.
 */
async function probeConnectivity() {
  if (typeof window === 'undefined') {
    return true;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    // Any HTTP response means the network is reachable (even 404/405/500).
    await fetch(`/?__online=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Returns true when the browser appears offline after confirmed probe failure.
 * Starts optimistic (online) to avoid false "You are offline" flashes.
 */
export function useOnlineStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let confirmTimer = null;
    let recheckTimer = null;

    const clearTimers = () => {
      if (confirmTimer) window.clearTimeout(confirmTimer);
      if (recheckTimer) window.clearTimeout(recheckTimer);
      confirmTimer = null;
      recheckTimer = null;
    };

    const markOnline = () => {
      clearTimers();
      if (!cancelled) setIsOffline(false);
    };

    const scheduleRecheck = () => {
      recheckTimer = window.setTimeout(async () => {
        const online = await probeConnectivity();
        if (cancelled) return;
        if (online) {
          setIsOffline(false);
        } else {
          setIsOffline(true);
          scheduleRecheck();
        }
      }, RECHECK_MS);
    };

    const confirmOffline = () => {
      clearTimers();
      confirmTimer = window.setTimeout(async () => {
        const online = await probeConnectivity();
        if (cancelled) return;
        if (online) {
          setIsOffline(false);
        } else {
          setIsOffline(true);
          scheduleRecheck();
        }
      }, OFFLINE_CONFIRM_MS);
    };

    // Only investigate when the browser claims offline — never flash offline on load.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      confirmOffline();
    }

    window.addEventListener('online', markOnline);
    window.addEventListener('offline', confirmOffline);

    return () => {
      cancelled = true;
      clearTimers();
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', confirmOffline);
    };
  }, []);

  return { isOffline, isOnline: !isOffline };
}
