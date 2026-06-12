import { useEffect } from 'react';
import { setupNotificationAudioUnlock } from '@/lib/notificationSound';

export default function NotificationAudioUnlock() {
  useEffect(() => {
    setupNotificationAudioUnlock();
  }, []);

  return null;
}
