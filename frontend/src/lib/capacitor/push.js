import { PushNotifications } from '@capacitor/push-notifications';
import db from '@/api/base44Client';
import { isNativePlatform, getPlatform } from '@/lib/capacitor/platform';
import { showNotificationAlert } from '@/lib/notificationAlerts';
import { dispatchNotificationOpen } from '@/lib/pendingNotificationOpen';

let registered = false;

/**
 * Registers for native push (FCM on Android, APNs on iOS) and upserts the
 * device token using the same push-subscriptions endpoint the web-push flow
 * uses, tagged with platform/native so the backend can branch delivery.
 * Backend note: sending to native tokens requires server-side FCM/APNs
 * dispatch in addition to the existing web-push (VAPID) sender.
 */
export async function registerNativePush() {
  if (!isNativePlatform() || registered) return { success: registered };
  registered = true;

  const permStatus = await PushNotifications.checkPermissions();
  let granted = permStatus.receive === 'granted';

  if (!granted) {
    const requested = await PushNotifications.requestPermissions();
    granted = requested.receive === 'granted';
  }

  if (!granted) {
    return { success: false, error: 'Push permission was not granted' };
  }

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    try {
      await db.pushSubscriptions.upsert({
        endpoint: `native:${getPlatform()}:${token.value}`,
        native_token: token.value,
        native_platform: getPlatform(),
        userAgent: `capacitor-${getPlatform()}`,
      });
    } catch (error) {
      console.warn('[native-push] Failed to sync token:', error);
    }
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.warn('[native-push] Registration error:', error);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    showNotificationAlert({
      title: notification.title,
      message: notification.body,
      body: notification.body,
      type: notification.data?.type,
    });
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    dispatchNotificationOpen(action.notification?.data || {});
  });

  return { success: true };
}

export async function unregisterNativePush() {
  if (!isNativePlatform()) return;
  await PushNotifications.removeAllListeners();
  await PushNotifications.unregister();
  registered = false;
}
