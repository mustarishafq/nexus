export const DEFAULT_NOTIFICATION_EVENT_MAPPING = {
  auto_notify: false,
  webhook_secret: '',
  field_mappings: {
    title: ['title', 'subject'],
    message: ['message', 'body'],
    user_id: ['user_id'],
    action_url: ['action_url', 'url', 'link'],
    event_name: ['event'],
    severity: ['severity', 'level'],
    data: ['data'],
  },
  category_prefix_rules: [
    { prefix: 'booking.', category: 'booking' },
    { prefix: 'order.', category: 'booking' },
    { prefix: 'hr.', category: 'hr' },
    { prefix: 'inventory.', category: 'inventory' },
    { prefix: 'finance.', category: 'finance' },
    { prefix: 'security.', category: 'security' },
    { prefix: 'system.', category: 'system' },
    { prefix: 'approval.', category: 'approval' },
    { prefix: 'task.', category: 'task' },
  ],
  defaults: {
    type: 'info',
    priority: 'medium',
    category: 'other',
    delivery_channels: ['in_app'],
  },
};

export const NOTIFICATION_FIELD_LABELS = {
  title: 'Title (required)',
  message: 'Message',
  user_id: 'User ID',
  action_url: 'Action URL',
  event_name: 'Event name (for category/type)',
  severity: 'Severity / level',
  data: 'Extra data object',
};

export const NESTED_PAYLOAD_FIELD_MAPPINGS = {
  title: ['data.title'],
  message: ['data.message'],
  user_id: ['data.user_id', 'data.user.id'],
  action_url: ['data.action_url', 'data.url', 'data.link'],
  event_name: ['event', 'data.type', 'data.reference_type'],
  severity: ['data.severity', 'data.level', 'data.type'],
  data: ['data'],
};

export function parseNotificationConfig(raw) {
  if (!raw) return null;

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return typeof raw === 'object' ? raw : null;
}

function sanitizeFieldMappings(mappings) {
  const sanitized = {};

  Object.entries(mappings || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      sanitized[key] = value
        .filter((item) => typeof item === 'string' && item.trim() !== '')
        .map((item) => item.trim());
      return;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      sanitized[key] = [value.trim()];
    }
  });

  return sanitized;
}

export function normalizeNotificationEventMapping(config) {
  const defaults = DEFAULT_NOTIFICATION_EVENT_MAPPING;
  const parsed = parseNotificationConfig(config);

  if (!parsed) {
    return {
      ...defaults,
      field_mappings: { ...defaults.field_mappings },
      category_prefix_rules: [...defaults.category_prefix_rules],
      defaults: { ...defaults.defaults },
    };
  }

  const savedMappings = sanitizeFieldMappings(parsed.field_mappings);
  const hasSavedMappings = Object.keys(savedMappings).length > 0;

  return {
    auto_notify: Boolean(parsed.auto_notify),
    webhook_secret: parsed.webhook_secret || '',
    field_mappings: hasSavedMappings
      ? {
        ...Object.fromEntries(
          Object.keys(defaults.field_mappings).map((key) => [key, savedMappings[key] ?? []])
        ),
        ...savedMappings,
      }
      : { ...defaults.field_mappings },
    category_prefix_rules: Array.isArray(parsed.category_prefix_rules) && parsed.category_prefix_rules.length
      ? parsed.category_prefix_rules
      : defaults.category_prefix_rules,
    defaults: {
      ...defaults.defaults,
      ...(parsed.defaults || {}),
    },
  };
}

export function applicationNotificationsEnabled(application) {
  return normalizeNotificationEventMapping(application?.notification_config).auto_notify;
}

export function fieldMappingsToForm(fieldMappings) {
  return Object.fromEntries(
    Object.keys(DEFAULT_NOTIFICATION_EVENT_MAPPING.field_mappings).map((key) => [
      key,
      Array.isArray(fieldMappings?.[key]) ? fieldMappings[key].join(', ') : '',
    ])
  );
}

export function formToFieldMappings(form) {
  return Object.fromEntries(
    Object.keys(DEFAULT_NOTIFICATION_EVENT_MAPPING.field_mappings).map((key) => [
      key,
      String(form?.[key] || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ])
  );
}

export function pathsFromFormValue(formValue) {
  return String(formValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formValueFromPaths(paths) {
  return paths.filter(Boolean).join(', ');
}

export function appendMappingPath(formValue, path) {
  const paths = pathsFromFormValue(formValue);
  if (paths.includes(path)) return formValueFromPaths(paths);
  return formValueFromPaths([...paths, path]);
}

export function removeMappingPath(formValue, path) {
  return formValueFromPaths(pathsFromFormValue(formValue).filter((item) => item !== path));
}

export function formatPayloadValuePreview(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    return value.length > 48 ? `"${value.slice(0, 45)}…"` : `"${value}"`;
  }
  if (typeof value === 'object') {
    return Array.isArray(value) ? `[${value.length} items]` : '{…}';
  }
  return String(value);
}

/**
 * Flatten a webhook payload into draggable dot-path entries.
 * Objects are included as mappable paths; scalars are leaf nodes.
 */
export function flattenPayloadPaths(value, prefix = '', depth = 0) {
  if (depth > 8) return [];

  const entries = [];

  if (value !== null && typeof value === 'object') {
    if (prefix) {
      entries.push({
        path: prefix,
        value,
        valueType: Array.isArray(value) ? 'array' : 'object',
        isLeaf: false,
      });
    }

    const items = Array.isArray(value)
      ? value.map((item, index) => [String(index), item])
      : Object.entries(value);

    items.forEach(([key, child]) => {
      const childPath = prefix ? `${prefix}.${key}` : key;
      entries.push(...flattenPayloadPaths(child, childPath, depth + 1));
    });

    return entries;
  }

  if (prefix) {
    entries.push({
      path: prefix,
      value,
      valueType: value === null ? 'null' : typeof value,
      isLeaf: true,
    });
  }

  return entries;
}

export function parseSamplePayload(raw) {
  if (!raw?.trim()) return { data: null, error: null };

  try {
    return { data: JSON.parse(raw), error: null };
  } catch (error) {
    return { data: null, error: error.message || 'Invalid JSON' };
  }
}

export function buildSampleEvent() {
  return {
    event: 'order.created',
    title: 'New order #1234',
    message: 'John Doe placed an order for RM 250.00',
    user_id: '42',
    action_url: 'https://example.com/orders/1234',
    severity: 'info',
    data: {
      order_id: 1234,
      amount: 250,
    },
  };
}

export function buildNestedSampleEvent() {
  return {
    event: 'notification.created',
    delivery_id: '13dd9cf89bc5f1f8-0',
    fired_at: '2026-06-11T23:45:01.907473+08:00',
    data: {
      user_id: '69f4e55e4b11c0f3dd71110f',
      type: 'task_review',
      title: 'Subtask Submitted for Review',
      message: 'EMZI Admin submitted subtask "sdsdasda" for review',
      reference_id: '6a14165db204ec02fdde019e',
      reference_type: 'task',
    },
  };
}
