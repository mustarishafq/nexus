const STORAGE_KEY = 'nexus_notification_settings';

export const DEFAULT_NOTIFICATION_SETTINGS = {
  in_app: true,
  email: true,
  sound: false,
};

export function parseNotificationSettings(raw) {
  if (!raw) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_NOTIFICATION_SETTINGS };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  return {
    in_app: parsed.in_app !== false,
    email: parsed.email !== false,
    sound: Boolean(parsed.sound),
  };
}

export function syncNotificationSettingsCache(raw) {
  const settings = parseNotificationSettings(raw);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return settings;
}

export function getNotificationSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return parseNotificationSettings(stored);
    }
  } catch {
    // Fall through to defaults.
  }

  return { ...DEFAULT_NOTIFICATION_SETTINGS };
}
