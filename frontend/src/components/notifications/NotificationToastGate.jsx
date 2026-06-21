import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import {
  notificationToAlertPayload,
  showNotificationAlert,
} from '@/lib/notificationAlerts';
import { syncNotificationSettingsCache } from '@/lib/notificationSettings';
import {
  RECENT_NOTIFICATIONS_QUERY_KEY,
  useRecentNotifications,
} from '@/hooks/useNotifications';

const POLL_INTERVAL_MS = 5000;

export default function NotificationToastGate() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const seenIdsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const userIdRef = useRef(null);

  const { data: notifications } = useRecentNotifications({
    enabled: isAuthenticated && Boolean(user?.id),
  });

  useEffect(() => {
    if (user?.notification_settings !== undefined) {
      syncNotificationSettingsCache(user.notification_settings);
    }
  }, [user?.notification_settings]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      seenIdsRef.current = new Set();
      initializedRef.current = false;
      userIdRef.current = null;
      return undefined;
    }

    if (userIdRef.current !== user.id) {
      seenIdsRef.current = new Set();
      initializedRef.current = false;
      userIdRef.current = user.id;
    }

    const intervalId = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey: RECENT_NOTIFICATIONS_QUERY_KEY });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, queryClient, user?.id]);

  useEffect(() => {
    if (!Array.isArray(notifications)) {
      return;
    }

    if (!initializedRef.current) {
      notifications.forEach((notification) => {
        seenIdsRef.current.add(String(notification.id));
      });
      initializedRef.current = true;
      return;
    }

    const unseen = notifications.filter(
      (notification) => !seenIdsRef.current.has(String(notification.id))
    );

    [...unseen].reverse().forEach((notification) => {
      seenIdsRef.current.add(String(notification.id));
      showNotificationAlert(notificationToAlertPayload(notification));
    });
  }, [notifications]);

  return null;
}
