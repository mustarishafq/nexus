import React, { useEffect, useRef } from 'react';
import db from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  notificationToAlertPayload,
  showNotificationAlert,
} from '@/lib/notificationAlerts';
import { syncNotificationSettingsCache } from '@/lib/notificationSettings';

const POLL_INTERVAL_MS = 5000;

export default function NotificationToastGate() {
  const { user, isAuthenticated } = useAuth();
  const seenIdsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const userIdRef = useRef(null);

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

    const pollNotifications = async () => {
      try {
        const notifications = await db.entities.Notification.filter(
          { exclude_broadcasts: true, exclude_direct_messages: true },
          '-created_date',
          50
        );

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
      } catch {
        // Ignore polling errors; badges and panels have their own fallbacks.
      }
    };

    pollNotifications();
    const intervalId = window.setInterval(pollNotifications, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, user?.id]);

  return null;
}
