const CACHE_NAME = 'nexus-shell-v4';
const APP_SHELL = [
  '/',
  '/offline.html',
  '/icons/pwa-icon-192x192.png',
  '/icons/pwa-icon-512x512.png',
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

  const title = payload.title || 'Nexus';
  const body = payload.message || payload.body || 'You have a new notification in Nexus.';
  const url = payload.action_url || payload.url || '/notifications';
  const tag = payload.id ? `notification-${payload.id}` : undefined;
  const notificationData = { url, id: payload.id || null };

  const notifyOptions = {
    body,
    icon: '/icons/pwa-icon-192x192.png',
    badge: '/icons/pwa-icon-192x192.png',
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
          icon: '/icons/pwa-icon-192x192.png',
          data: notificationData,
        });
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  // Handle action button clicks
  if (event.action === 'close') {
    event.notification.close();
    return;
  }

  // Default action: open the notification URL
  event.notification.close();

  const targetPath = event.notification?.data?.url || '/notifications';
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Prefer a client that is already at the target URL.
      const exactMatch = windowClients.find((c) => c.url === targetUrl);
      if (exactMatch && 'focus' in exactMatch) {
        return exactMatch.focus();
      }

      // Fall back to any open window on the same origin — navigate it to the target URL
      // so the PWA window is reused rather than opening a new browser tab.
      const anyClient = windowClients.find((c) => new URL(c.url).origin === self.location.origin);
      if (anyClient && 'navigate' in anyClient) {
        return anyClient.navigate(targetUrl).then((navigated) => navigated && navigated.focus());
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});