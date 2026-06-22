const CACHE_NAME = 'nexus-shell-v8.0.9';
// badge_silhouette_96.png embedded so Chrome can render the badge in the background.
const NOTIFICATION_BADGE_DATA_URL = 'data:image/png;base64,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';
const APP_SHELL = [
  '/',
  '/offline.html',
  '/icons/apple-touch-icon.png',
  '/icons/badge_silhouette_96.png',
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
  const actionUrl = data.action_url || data.url;
  if (actionUrl) {
    if (isAbsoluteHttpUrl(actionUrl)) {
      if (actionUrl.startsWith(self.location.origin)) {
        const parsed = new URL(actionUrl);
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }

      return actionUrl;
    }

    if (actionUrl.startsWith('/')) {
      return actionUrl;
    }
  }

  if (data.id) {
    return `/notifications?open=${data.id}`;
  }

  return '/notifications';
}

function isSameOriginClient(client) {
  try {
    return new URL(client.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function notifyClientsToOpen(notificationData = {}) {
  const message = { type: 'NOTIFICATION_OPEN', payload: notificationData };

  try {
    const channel = new BroadcastChannel('nexus-notification-open');
    channel.postMessage(message);
    channel.close();
  } catch {
    // BroadcastChannel unavailable in service worker on some browsers.
  }
}

async function openNotificationTarget(notificationData = {}) {
  const targetPath = resolveNotificationTargetPath(notificationData);
  const isExternalTarget = isAbsoluteHttpUrl(targetPath)
    && !targetPath.startsWith(self.location.origin);
  const targetUrl = isExternalTarget
    ? targetPath
    : new URL(targetPath, self.location.origin).href;

  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const sameOriginClients = windowClients.filter(isSameOriginClient);
  const focusedClient = sameOriginClients.find((client) => client.focused);
  const originClient = focusedClient || sameOriginClients[0];

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
    sameOriginClients.forEach((client) => {
      client.postMessage({ type: 'NOTIFICATION_OPEN', payload: notificationData });
    });
    notifyClientsToOpen(notificationData);
  }

  if ('navigate' in originClient) {
    try {
      const navigated = await originClient.navigate(targetUrl);
      if (navigated && 'focus' in navigated) {
        await navigated.focus();
      }
    } catch {
      // Android PWAs can reject navigate(); fall back to openWindow below.
    }
  }

  if (!isExternalTarget) {
    sameOriginClients.forEach((client) => {
      client.postMessage({ type: 'NOTIFICATION_OPEN', payload: notificationData });
    });
    notifyClientsToOpen(notificationData);
    return;
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

  const notificationData = { ...(event.notification?.data || {}) };
  event.notification.close();

  event.waitUntil(openNotificationTarget(notificationData));
});