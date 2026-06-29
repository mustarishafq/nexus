import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import db from '@/api/apiClient';
import { followNotificationAction } from '@/lib/notificationAction';
import {
  clearPendingNotificationOpen,
  NOTIFICATION_OPEN_CHANNEL,
  NOTIFICATION_OPEN_EVENT,
  readPendingNotificationOpen,
} from '@/lib/pendingNotificationOpen';

export default function NotificationClickGate() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledPendingRef = useRef(false);
  const lastOpenRef = useRef({ key: null, at: 0 });

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.entities.Application.list(),
  });

  const openNotification = useCallback(async (payload = {}) => {
    const payloadActionUrl = payload.action_url || payload.url || null;
    let notification = null;

    if (payloadActionUrl || payload.system_id) {
      notification = {
        id: payload.id || null,
        action_url: payloadActionUrl,
        system_id: payload.system_id || null,
      };
    } else if (payload.id) {
      try {
        notification = await db.entities.Notification.get(payload.id);
      } catch {
        notification = {
          id: payload.id,
          action_url: null,
          system_id: null,
        };
      }
    }

    clearPendingNotificationOpen();

    if (!notification) {
      navigate('/notifications');
      return;
    }

    if (!notification.action_url && !notification.system_id) {
      navigate('/notifications');
      return;
    }

    try {
      await followNotificationAction(notification, { applications, navigate });
    } catch (error) {
      toast.error(error?.message || 'Unable to open notification link.');
      navigate('/notifications');
    }
  }, [applications, navigate]);

  useEffect(() => {
    const handleOpen = (payload = {}) => {
      const key = [
        payload.id || '',
        payload.action_url || payload.url || '',
        payload.system_id || '',
      ].join('|');
      const now = Date.now();
      if (lastOpenRef.current.key === key && now - lastOpenRef.current.at < 750) {
        return;
      }
      lastOpenRef.current = { key, at: now };

      void openNotification(payload);
    };

    const handleCustomEvent = (event) => {
      handleOpen(event.detail || {});
    };

    const handleBroadcastMessage = (event) => {
      if (event.data?.type !== 'NOTIFICATION_OPEN') {
        return;
      }

      handleOpen(event.data.payload || {});
    };

    let broadcastChannel = null;
    try {
      broadcastChannel = new BroadcastChannel(NOTIFICATION_OPEN_CHANNEL);
      broadcastChannel.onmessage = handleBroadcastMessage;
    } catch {
      // BroadcastChannel unavailable.
    }

    window.addEventListener(NOTIFICATION_OPEN_EVENT, handleCustomEvent);

    return () => {
      window.removeEventListener(NOTIFICATION_OPEN_EVENT, handleCustomEvent);
      broadcastChannel?.close();
    };
  }, [openNotification]);

  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('open');
    setSearchParams(nextParams, { replace: true });
    void openNotification({ id: openId });
  }, [openNotification, searchParams, setSearchParams]);

  useEffect(() => {
    if (handledPendingRef.current) {
      return;
    }

    const pending = readPendingNotificationOpen();
    if (!pending) {
      return;
    }

    handledPendingRef.current = true;
    void openNotification(pending);
  }, [openNotification]);

  return null;
}
