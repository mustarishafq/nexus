import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import db from '@/api/apiClient';
import { showMailInboxAlert } from '@/lib/notificationAlerts';
import { BACKGROUND_POLL_INTERVAL_MS } from '@/lib/polling';
import { useVisibleRefetchInterval } from '@/hooks/useVisibleRefetchInterval';
import { MAIL_STATUS_QUERY_KEY, mailInboxQueryKey } from '@/lib/queryKeys';
import { isWebPushSupported } from '@/lib/webPush';

async function hasActiveBrowserPushSubscription() {
  if (!isWebPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return Boolean(subscription);
  } catch {
    return false;
  }
}

export default function MailNotificationGate() {
  const { isAuthenticated } = useAuth();
  const seenUidsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const pollInterval = useVisibleRefetchInterval(BACKGROUND_POLL_INTERVAL_MS);
  const [serverPushActive, setServerPushActive] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setServerPushActive(false);
      return undefined;
    }

    let cancelled = false;

    const refreshPushState = async () => {
      const active = await hasActiveBrowserPushSubscription();
      if (!cancelled) {
        setServerPushActive(active);
      }
    };

    void refreshPushState();

    const onFocus = () => {
      void refreshPushState();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [isAuthenticated]);

  const useClientPolling = isAuthenticated && !serverPushActive;

  const { data: mailStatus } = useQuery({
    queryKey: MAIL_STATUS_QUERY_KEY,
    queryFn: () => db.mail.status(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const mailConnected = Boolean(mailStatus?.connected);
  const accountId = mailStatus?.account?.id || null;

  const { data: mailInbox } = useQuery({
    queryKey: mailInboxQueryKey(accountId, 'inbox', '', false),
    queryFn: () => db.mail.listMessages({
      limit: 50,
      accountId: accountId || undefined,
      folder: 'inbox',
    }),
    enabled: useClientPolling && mailConnected,
    staleTime: 20_000,
    refetchInterval: useClientPolling ? pollInterval : false,
    retry: false,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      seenUidsRef.current = new Set();
      initializedRef.current = false;
      return;
    }

    if (!mailConnected) {
      seenUidsRef.current = new Set();
      initializedRef.current = false;
    }
  }, [isAuthenticated, mailConnected]);

  useEffect(() => {
    if (!useClientPolling) {
      seenUidsRef.current = new Set();
      initializedRef.current = false;
    }
  }, [useClientPolling]);

  useEffect(() => {
    const messages = Array.isArray(mailInbox?.messages) ? mailInbox.messages : [];
    if (messages.length === 0 && !initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    if (!initializedRef.current) {
      messages.forEach((message) => {
        seenUidsRef.current.add(String(message.uid));
      });
      initializedRef.current = true;
      return;
    }

    const newcomers = messages.filter((message) => !seenUidsRef.current.has(String(message.uid)));

    newcomers.forEach((message) => {
      seenUidsRef.current.add(String(message.uid));
      if (!message.seen) {
        showMailInboxAlert(message);
      }
    });
  }, [mailInbox]);

  return null;
}
