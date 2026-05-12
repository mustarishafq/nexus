import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] Registration failed:', err);
    });

    // When the service worker detects a push while this window is focused it
    // sends a PUSH_RECEIVED message so we can surface an in-app notification
    // (important for standalone PWA mode where the OS may not show a banner
    // while the app is in the foreground).
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type !== 'PUSH_RECEIVED') return;
      const payload = event.data.payload || {};
      const title = payload.title || 'Nexus';
      const body = payload.message || payload.body || 'You have a new notification.';
      // Dynamically import sonner so this module stays side-effect-free.
      import('sonner').then(({ toast }) => {
        toast(title, { description: body });
      }).catch(() => {});
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
