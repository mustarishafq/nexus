import { toast } from 'sonner';
import { showPushNotificationToast } from '@/lib/notificationVisuals';
import { getNotificationSettings } from '@/lib/notificationSettings';
import { playNotificationSound } from '@/lib/notificationSound';

const DEDUP_MS = 5000;
const recentAlerts = new Map();

function shouldSkipDuplicate(id) {
  if (!id) return false;

  const key = String(id);
  const lastShownAt = recentAlerts.get(key);
  const now = Date.now();

  if (lastShownAt && now - lastShownAt < DEDUP_MS) {
    return true;
  }

  recentAlerts.set(key, now);

  if (recentAlerts.size > 100) {
    for (const [alertId, shownAt] of recentAlerts) {
      if (now - shownAt > DEDUP_MS) {
        recentAlerts.delete(alertId);
      }
    }
  }

  return false;
}

export function notificationToAlertPayload(notification) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    body: notification.message,
    type: notification.type,
  };
}

export function showNotificationAlert(payload = {}) {
  if (shouldSkipDuplicate(payload.id)) {
    return;
  }

  const settings = getNotificationSettings();
  if (!settings.in_app) {
    return;
  }

  showPushNotificationToast(payload, toast);

  if (settings.sound) {
    void playNotificationSound();
  }
}
