const CACHE_NAME = 'nexus-shell-v8.0.7';
// badge_96.png embedded so Chrome can render the badge in the background.
const NOTIFICATION_BADGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAQAElEQVR4AdydCaBXVbX/1zq/e6+XHDHnRrWe5ZSaWjZY5nPILBOR5yyiSIBSKqjIdBFRgURFFJEEBSUHMKXS0t7Dni9nTVGqf2qWaYkTDqVy7/2d/f981zm/H5cCLqCgtdnDmvdaa++zz/md372XzDopLS0t2bhx4/b43imnPn744Uc+M23atE+mlCqdqL3v2aefPuR7L73wQnu1mlfzvFolpmqe8pyxPacwitbOqCZ63l5tb5s7d25DLbhCDKVcbCSLmlMSFNkTRXYg5ZDyaqqKlUDyNtlZ5gLsvf/+O1ar1bZhw0dUTxt42t0XjL9gu2tnzvjQMcf2/H01z9va2tvbse4y8q/S+vfv/8FqNV9ES+ePGTV+w403rmQeJUtmmZtRU0YfI7QKMVYYzeiuufqaV7/61a9WjfLEk0++bo6YmVsx5ogkmvDk0N3cKBnNKRoySC7BWTfOaoZgmbp/bL/73e/yO2679dFMBaZLqxhdXlayzBsqWaWaUs6OCEOw39f1vgceqE685JKXsswbs8xIkKLCZVduHdwid2aufyRSI5gHz3Mz69mr58YkMqW5qeETW2+9DiR79i9/TY888sjffv3II68/9thjr82bN28h+OsPPvTgG48+Om8h4+sPPvzQa/Pn//YFyWuiRx955O89evSIhfynBWhra6tus802OCFxy5IneWaOS6LgpQZLWOIcSnvu+ZW/B+F93OV53r77rp/NElElOW5k1cxNuaejCmaoVy8JCQo7NtlhvY7bAjhq/uW8FcCxmz68xeaVXXbeeV1a18/suGPXnT7zmQ2BN9ht193W32mnz2yocbfP7rrB1p/cchN0Ul7N084777QecNQlFuDVV1+tNjQ0aG4amcdBx08PUZYgJbBALACnZJ61V6vJ3qdFRyW+slfc3I0WcRmglaUDyF5L7CzihqeYQvimWbPfuvGqq56HZsOHj7wnq5A29uWpAwce7LGW4iy79enT99zmpmbT0fOlL3111446WCoUx44de836668vZzRpObmG4CcuAXhUM12NtQDkbapkmbUSKburbi+03uNu0duteaWSVbzmbeGPM6SyBUyXIDAg6M7VXVz30ExZO7THoR9APugjRg77HLDnqZomXHjhLcCd1ssmXTqYpfU/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';
const APP_SHELL = [
  '/',
  '/offline.html',
  '/icons/apple-touch-icon.png',
  '/icons/badge_96.png',
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