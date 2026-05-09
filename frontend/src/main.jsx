import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const SW_REFRESH_KEY = 'nexus_sw_refreshed_once';

  const showRefreshNotice = () => {
    if (document.getElementById('sw-refresh-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'sw-refresh-toast';
    toast.textContent = 'Updating app...';
    toast.style.position = 'fixed';
    toast.style.right = '16px';
    toast.style.bottom = '16px';
    toast.style.zIndex = '9999';
    toast.style.padding = '10px 14px';
    toast.style.borderRadius = '10px';
    toast.style.background = 'rgba(15, 23, 42, 0.95)';
    toast.style.color = '#fff';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '600';
    toast.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';

    document.body.appendChild(toast);
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem(SW_REFRESH_KEY) === '1') {
        return;
      }

      sessionStorage.setItem(SW_REFRESH_KEY, '1');
      showRefreshNotice();
      setTimeout(() => {
        window.location.reload();
      }, 900);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
