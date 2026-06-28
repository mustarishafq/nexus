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

export async function showSystemNotification({ title, body, tag, data = {} }) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const options = {
    body,
    icon: '/icons/pwa-icon-192.png',
    badge: '/icons/pwa-icon-192.png',
    tag,
    data,
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Fall back to the page Notification API.
  }

  new Notification(title, options);
}

export function showMailInboxAlert(message = {}) {
  const settings = getNotificationSettings();
  if (settings.mail_inbox === false) {
    return;
  }

  const uid = message.uid;
  const dedupeId = uid ? `mail-${uid}` : null;
  if (shouldSkipDuplicate(dedupeId)) {
    return;
  }

  const title = message.from || 'New email';
  const body = message.subject || '(No subject)';
  const path = uid ? `/email/${uid}` : '/email';
  const onEmailPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/email');
  const isHidden = typeof document !== 'undefined' && document.hidden;

  if (settings.in_app && (isHidden || !onEmailPage)) {
    showPushNotificationToast({
      id: dedupeId,
      title,
      message: body,
      type: 'info',
    }, toast);
  }

  if (settings.sound) {
    void playNotificationSound();
  }

  void showSystemNotification({
    title,
    body,
    tag: dedupeId || undefined,
    data: {
      url: path,
      action_url: path,
    },
  });
}
