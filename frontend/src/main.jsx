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

if (typeof window !== 'undefined') {
  initPwaInstallListeners();
  captureNotificationOpenFromUrl();
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
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

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((err) => {
      console.warn('[sw] Registration failed:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
