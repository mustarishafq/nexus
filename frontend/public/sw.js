const CACHE_NAME = 'nexus-shell-v8.0.4';
// Android badge must be a hard-edged white silhouette (alpha 0 or 255 only).
// Embedded so Chrome never fails to fetch the badge URL in the background.
const NOTIFICATION_BADGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAADY0lEQVR42u2cPWtVQRCG30mukMZCbSStaHexElsJKARBSMBCsLAxhY0WNhZC/AcGuzSWdoKVkBQ2CoJN0NJaY6EIWij4MRbZC5dFLjvnkp3d4X26XGZnz9nl2Z3zFYAQQgghhBBCCCGEEEIIIYSQyEjtDlVVzQcpMug4VXUBwJ9a/Q1hoVZHTpwb0GbF+6APFR3AHH3tGLt6OUd3gwi7BKnqMoAPxmZnROR9zfGIvARtGOO3ag8+ENQAVV0C8MPYzXER+Vp7PKIasGqM3/AYfCCgASn9PoCThi6OiMjv2mMBxDRgDNvgr3gNPhBzAu4ZYl8BeOF5sKGWIFU9AeCzIXX1sjMnmgHXDbEuZWdOGANUdQTglyGtS9mZE8mAC4ZYt7IzJ5IBewDOFqZ0KztzQhigqqdQPviuZWdOiAkAcLswzr3szOl+CVLVowC+FaZyLztzIhiwXhjXRNmZ07UBxkeOTZSdOb0bUPrIsZmyM6d3A3YAXCxI0UzZmdOFAWmpyX9bRtngN1V25nQxAfj/UlPyyLG5stOdIW9FpKVmOsdSYbvT3ufbHAMnQNOSM8mxVhD/0Ptcm2SOCdhM7aGq+wXxx7zPtUnmmADVg6VnXBB30/s8S+niQmwgIxExvxldm16uAyZ8MsRe9j7YEnozYB0He8C1wvguLKhKpSqou72gGnMM/mZqX3odMGHR+5xn0dMesA0A6cboLUO7pveCXvaAXRG5NJXD+vp5s3tBLwbcn/5DRH4CeGBo36wFvRiwKCJ/szzWT5CatKALA/LBT799BLBrSNOkBV0YMOOR5HkArw2pmrOgCwNm8MYY35wFXU9AWppuGJo8a+26oOsJSDw1xjdlQfcTICLfATwyNGnKgu4nILFljG/Ggq6roCzvHspfUQcaqYiiGAAAd43xTVgQyQDrN2JAAxaEMSC9fnjH2MzdgjAGpNzW74QBZwvCGAAAIvIFwBNjM1cLQhmQ8o8BvDV24WZBKAMS72B7ewJwtCCcAamPNdhvUbhYENEAAHg+oI2LBSEnYMAjS8DpHlHICUhsD2hT3YKQe8BUX6Uf8U1TdS+IbACQvU1RSFULohvQ/P+OJoQQQgghhBBCCCGEEEIIIYfMP+pYOr0YLKmPAAAAAElFTkSuQmCC';
const APP_SHELL = [
  '/',
  '/offline.html',
  '/icons/apple-touch-icon.png',
  '/icons/notification-badge.png',
  '/icons/pwa-icon-192.png',
  '/icons/pwa-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const results = await Promise.allSettled(
        APP_SHELL.map((url) => cache.add(url))
      );

      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length) {
        console.warn('[sw] Some app shell assets failed to cache during install', failed.length);
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Never cache dev-server and HMR assets; stale modules can break exports during development.
  if (
    url.pathname.startsWith('/src/')
    || url.pathname.startsWith('/@vite/')
    || url.pathname.startsWith('/@fs/')
    || url.pathname.includes('vite/client')
    || url.searchParams.has('t')
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(async () => {
          const cachedShell = await caches.match('/') || await caches.match('/offline.html');
          return cachedShell;
        })
    );
    return;
  }

  // Use network-first for static assets so new deploys replace old bundles promptly.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { message: event.data.text() };
    }
  }

  const title = payload.title || 'EMZI Nexus Brain';
  const body = payload.message || payload.body || 'You have a new notification in EMZI Nexus Brain.';
  const actionUrl = payload.action_url || payload.url || null;
  const tag = payload.id ? `notification-${payload.id}` : undefined;
  const notificationData = {
    id: payload.id || null,
    action_url: actionUrl,
    system_id: payload.system_id || null,
    url: actionUrl || (payload.id ? `/notifications?open=${payload.id}` : '/notifications'),
  };
  const iconUrl = new URL('/icons/pwa-icon-192.png', self.location.origin).href;
  const badgeUrl = NOTIFICATION_BADGE_DATA_URL;

  const notifyOptions = {
    body,
    icon: iconUrl,
    badge: badgeUrl,
    tag,
    renotify: Boolean(tag),
    silent: false,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Dismiss' },
    ],
    data: notificationData,
  };

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Notify any focused client so the app can show an in-app alert when in the foreground.
      const focusedClient = windowClients.find((c) => c.focused);
      if (focusedClient) {
        focusedClient.postMessage({ type: 'PUSH_RECEIVED', payload });
      }

      // Always show the OS-level notification so the user gets it even in the background
      // or when no focused client is found (e.g. PWA backgrounded / device locked).
      return self.registration.showNotification(title, notifyOptions).catch(() => {
        // Fallback: minimal notification without optional options that some platforms reject.
        return self.registration.showNotification(title, {
          body,
          icon: iconUrl,
          badge: badgeUrl,
          data: notificationData,
        });
      });
    })
  );
});

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

function resolveNotificationTargetPath(data = {}) {
  if (data.id) {
    return `/notifications?open=${data.id}`;
  }

  return data.action_url || data.url || '/notifications';
}

async function openNotificationTarget(notificationData = {}) {
  const targetPath = resolveNotificationTargetPath(notificationData);
  const isExternalTarget = isAbsoluteHttpUrl(targetPath)
    && !targetPath.startsWith(self.location.origin);
  const targetUrl = isExternalTarget
    ? targetPath
    : new URL(targetPath, self.location.origin).href;

  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const originClient = windowClients.find((client) => {
    try {
      return new URL(client.url).origin === self.location.origin;
    } catch {
      return false;
    }
  });

  if (!originClient) {
    if (clients.openWindow) {
      return clients.openWindow(targetUrl);
    }
    return;
  }

  if ('focus' in originClient) {
    await originClient.focus();
  }

  if (!isExternalTarget) {
    originClient.postMessage({ type: 'NOTIFICATION_OPEN', payload: notificationData });
  }

  if ('navigate' in originClient) {
    try {
      const navigated = await originClient.navigate(targetUrl);
      if (navigated && 'focus' in navigated) {
        await navigated.focus();
        return;
      }
    } catch {
      // Android PWAs can reject navigate(); fall back to openWindow below.
    }
  }

  if (clients.openWindow) {
    return clients.openWindow(targetUrl);
  }
}

self.addEventListener('notificationclick', (event) => {
  if (event.action === 'close') {
    event.notification.close();
    return;
  }

  event.notification.close();

  event.waitUntil(openNotificationTarget(event.notification?.data || {}));
});