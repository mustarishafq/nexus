const STORAGE_KEY = 'nexus.pendingNotificationOpen';

export function stashPendingNotificationOpen(payload = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = {
    id: payload.id || null,
    action_url: payload.action_url || payload.url || null,
    system_id: payload.system_id || null,
  };

  if (!normalized.id && !normalized.action_url && !normalized.system_id) {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage failures.
  }
}

export function readPendingNotificationOpen() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingNotificationOpen() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function captureNotificationOpenFromUrl() {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const openId = params.get('open');
  if (!openId) {
    return;
  }

  stashPendingNotificationOpen({ id: openId });
}
