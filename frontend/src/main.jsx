import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { showNotificationAlert } from '@/lib/notificationAlerts'
import {
  captureNotificationOpenFromUrl,
  stashPendingNotificationOpen,
} from '@/lib/pendingNotificationOpen'
import { initPwaInstallListeners } from '@/lib/pwa'

if (typeof window !== 'undefined') {
  initPwaInstallListeners();
  captureNotificationOpenFromUrl();
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((err) => {
      console.warn('[sw] Registration failed:', err);
    });

    // When the service worker detects a push while this window is focused it
    // sends a PUSH_RECEIVED message so we can surface an in-app notification
    // (important for standalone PWA mode where the OS may not show a banner
    // while the app is in the foreground).
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        showNotificationAlert(event.data.payload || {});
        return;
      }

      if (event.data?.type === 'NOTIFICATION_OPEN') {
        stashPendingNotificationOpen(event.data.payload || {});
      }
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
