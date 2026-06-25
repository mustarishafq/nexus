import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { showNotificationAlert } from '@/lib/notificationAlerts'
import {
  captureNotificationOpenFromUrl,
  dispatchNotificationOpen,
} from '@/lib/pendingNotificationOpen'
import { initPwaInstallListeners } from '@/lib/pwa'
import { initCapacitor } from '@/lib/capacitor/bootstrap'
import { isNativePlatform } from '@/lib/capacitor/platform'

if (typeof window !== 'undefined') {
  initCapacitor();

  if (!isNativePlatform()) {
    initPwaInstallListeners();
    captureNotificationOpenFromUrl();
  }
}

// Service worker / web-push is a PWA-only concern; native apps use
// @capacitor/push-notifications (see src/lib/capacitor/push.js) instead.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isNativePlatform()) {
  // Register before load so notification clicks during startup are not missed.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PUSH_RECEIVED') {
      showNotificationAlert(event.data.payload || {});
      return;
    }

    if (event.data?.type === 'NOTIFICATION_OPEN') {
      dispatchNotificationOpen(event.data.payload || {});
    }
  });

  const reportDisplayMode = () => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    navigator.serviceWorker.controller?.postMessage({ type: 'CLIENT_DISPLAY_MODE', standalone });
  };

  navigator.serviceWorker.addEventListener('controllerchange', reportDisplayMode);
  window.matchMedia('(display-mode: standalone)').addEventListener('change', reportDisplayMode);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(() => {
      navigator.serviceWorker.ready.then(reportDisplayMode);
    }).catch((err) => {
      console.warn('[sw] Registration failed:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
