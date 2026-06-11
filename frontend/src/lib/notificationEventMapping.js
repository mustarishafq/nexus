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

export function normalizeNotificationEventMapping(config) {
  const defaults = DEFAULT_NOTIFICATION_EVENT_MAPPING;

  if (!config || typeof config !== 'object') {
    return { ...defaults, field_mappings: { ...defaults.field_mappings } };
  }

  const fieldMappings = { ...defaults.field_mappings };

  if (config.field_mappings && typeof config.field_mappings === 'object') {
    Object.entries(config.field_mappings).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        fieldMappings[key] = value.filter((item) => typeof item === 'string' && item.trim() !== '');
      } else if (typeof value === 'string' && value.trim() !== '') {
        fieldMappings[key] = [value.trim()];
      }
    });
  }

  return {
    auto_notify: Boolean(config.auto_notify),
    webhook_secret: config.webhook_secret || '',
    field_mappings: fieldMappings,
    category_prefix_rules: Array.isArray(config.category_prefix_rules) && config.category_prefix_rules.length
      ? config.category_prefix_rules
      : defaults.category_prefix_rules,
    defaults: {
      ...defaults.defaults,
      ...(config.defaults || {}),
    },
  };
}

export function fieldMappingsToForm(fieldMappings) {
  return Object.fromEntries(
    Object.entries(fieldMappings || {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(', ') : '',
    ])
  );
}

export function formToFieldMappings(form) {
  return Object.fromEntries(
    Object.entries(form || {}).map(([key, value]) => [
      key,
      String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ])
  );
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
