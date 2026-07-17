import { useCallback, useEffect, useRef, useState } from 'react';
import db from '@/api/apiClient';
import { isWebPushSupported, urlBase64ToUint8Array } from '@/lib/webPush';

const INITIAL_STATE = {
  loading: false,
  subscribed: false,
  supported: false,
  permission: 'default',
  synced: false,
  checked: false,
};

async function persistBrowserSubscription(subscription) {
  await db.pushSubscriptions.upsert({
    ...subscription.toJSON(),
    userAgent: navigator.userAgent,
  });
}

export function useWebPush(publicKey) {
  const [pushState, setPushState] = useState(INITIAL_STATE);
  const resyncAttemptedRef = useRef(false);

  const refreshPushState = useCallback(async () => {
    const supported = isWebPushSupported();

    if (!supported) {
      setPushState({
        loading: false,
        subscribed: false,
        supported: false,
        permission: 'unsupported',
        synced: false,
        checked: true,
      });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const browserSubscription = await registration.pushManager.getSubscription();
      const storedSubscriptions = await db.pushSubscriptions.list();
      const synced = Boolean(browserSubscription && Array.isArray(storedSubscriptions)
        && storedSubscriptions.some((item) => item.endpoint === browserSubscription.endpoint));

      setPushState({
        loading: false,
        subscribed: Boolean(browserSubscription),
        supported: true,
        permission: Notification.permission,
        synced,
        checked: true,
      });
    } catch {
      setPushState((current) => ({
        ...current,
        loading: false,
        supported: true,
        permission: Notification.permission,
        checked: true,
      }));
    }
  }, []);

  useEffect(() => {
    resyncAttemptedRef.current = false;
    refreshPushState();
  }, [refreshPushState, publicKey]);

  // Browser can look "enabled" while the server row is missing (failed upsert, new login, etc.).
  useEffect(() => {
    if (!pushState.checked || !pushState.subscribed || pushState.synced || resyncAttemptedRef.current) {
      return;
    }

    let cancelled = false;
    resyncAttemptedRef.current = true;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription || cancelled) return;
        await persistBrowserSubscription(subscription);
        if (!cancelled) await refreshPushState();
      } catch {
        // Leave synced=false so Settings can show the pending state.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pushState.checked, pushState.subscribed, pushState.synced, refreshPushState]);

  const subscribe = useCallback(async () => {
    if (!isWebPushSupported()) {
      return { success: false, error: 'Web push is not supported in this browser' };
    }

    if (!publicKey) {
      return { success: false, error: 'Web push is not configured by the administrator' };
    }

    setPushState((current) => ({ ...current, loading: true }));

    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

      if (permission !== 'granted') {
        throw new Error('Notification permission was not granted');
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await persistBrowserSubscription(subscription);
      resyncAttemptedRef.current = false;
      await refreshPushState();
      return { success: true };
    } catch (error) {
      await refreshPushState();
      return { success: false, error: error?.message || 'Unable to enable web push' };
    }
  }, [publicKey, refreshPushState]);

  const unsubscribe = useCallback(async () => {
    if (!isWebPushSupported()) {
      return { success: false, error: 'Web push is not supported in this browser' };
    }

    setPushState((current) => ({ ...current, loading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await db.pushSubscriptions.remove({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }

      resyncAttemptedRef.current = false;
      await refreshPushState();
      return { success: true };
    } catch (error) {
      await refreshPushState();
      return { success: false, error: error?.message || 'Unable to disable web push' };
    }
  }, [refreshPushState]);

  return { pushState, subscribe, unsubscribe, refreshPushState };
}
