import { useCallback, useEffect, useState } from 'react';
import db from '@/api/base44Client';
import { isWebPushSupported, urlBase64ToUint8Array } from '@/lib/webPush';

const INITIAL_STATE = {
  loading: false,
  subscribed: false,
  supported: false,
  permission: 'default',
  synced: false,
  checked: false,
};

export function useWebPush(publicKey) {
  const [pushState, setPushState] = useState(INITIAL_STATE);

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
    refreshPushState();
  }, [refreshPushState, publicKey]);

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

      await db.pushSubscriptions.upsert({
        ...subscription.toJSON(),
        userAgent: navigator.userAgent,
      });

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

      await refreshPushState();
      return { success: true };
    } catch (error) {
      await refreshPushState();
      return { success: false, error: error?.message || 'Unable to disable web push' };
    }
  }, [refreshPushState]);

  return { pushState, subscribe, unsubscribe, refreshPushState };
}
