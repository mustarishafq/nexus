import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { showNotificationAlert } from '@/lib/notificationAlerts'
import {
  invalidateDirectMessageQueries,
  isViewingDirectMessageConversation,
} from '@/lib/messagesCache'
import {
  captureNotificationOpenFromUrl,
  dispatchNotificationOpen,
} from '@/lib/pendingNotificationOpen'
import { initPwaInstallListeners } from '@/lib/pwa'
import { queryClientInstance } from '@/lib/query-client'

if (typeof window !== 'undefined') {
  initPwaInstallListeners();
  captureNotificationOpenFromUrl();
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Register before load so notification clicks during startup are not missed.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PUSH_RECEIVED') {
      const payload = event.data.payload || {};
      invalidateDirectMessageQueries(queryClientInstance, payload);

      // SW notifies every open client so chat caches stay fresh in background tabs.
      // Only toast from the visible/focused client, and skip while already in that chat.
      const canToast = typeof document !== 'undefined'
        && !document.hidden
        && (typeof document.hasFocus !== 'function' || document.hasFocus())
        && !isViewingDirectMessageConversation(payload);
      if (canToast) {
        showNotificationAlert(payload);
      }
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
