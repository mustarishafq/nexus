const CACHE_NAME = 'nexus-shell-v8.0.5';
// notification-badge.png embedded so Chrome can render the badge in the background.
const NOTIFICATION_BADGE_DATA_URL = 'data:image/png;base64,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';
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