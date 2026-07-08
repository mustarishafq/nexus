export {
  appendMappingPath,
  flattenPayloadPaths,
  formValueFromPaths,
  formatPayloadValuePreview,
  parseSamplePayload,
  pathsFromFormValue,
  removeMappingPath,
} from '@/lib/notificationEventMapping';

export const DEFAULT_CALENDAR_EVENT_MAPPING = {
  auto_sync: false,
  webhook_secret: '',
  field_mappings: {
    title: ['title', 'subject', 'summary', 'data.title'],
    description: ['description', 'body', 'details', 'data.description'],
    location: ['location', 'venue', 'data.location'],
    start_at: ['start_at', 'starts_at', 'start', 'scheduled_start', 'data.start_at', 'data.starts_at', 'data.scheduled_start'],
    end_at: ['end_at', 'ends_at', 'end', 'scheduled_end', 'data.end_at', 'data.ends_at', 'data.scheduled_end'],
    is_all_day: ['is_all_day', 'all_day', 'data.is_all_day'],
    attendee_emails: ['attendee_emails', 'attendees', 'invitees', 'data.attendee_emails', 'data.attendees'],
    attendee_user_ids: ['attendee_user_ids', 'user_ids', 'invitee_user_ids', 'data.attendee_user_ids', 'data.user_ids'],
    action: ['action', 'event', 'event_type', 'data.action', 'data.type'],
    external_event_id: ['external_event_id', 'id', 'event_id', 'data.id', 'data.event_id', 'data.external_event_id'],
    created_by: ['created_by', 'organizer_email', 'organizer', 'data.organizer_email', 'data.created_by'],
    created_by_user_id: ['created_by_user_id', 'organizer_user_id', 'user_id', 'data.organizer_user_id', 'data.created_by_user_id', 'data.user_id'],
  },
  action_rules: [
    { prefix: 'calendar.cancelled', action: 'cancelled' },
    { prefix: 'calendar.rescheduled', action: 'rescheduled' },
    { prefix: 'calendar.created', action: 'created' },
    { prefix: 'calendar.updated', action: 'updated' },
    { prefix: 'event.cancelled', action: 'cancelled' },
    { prefix: 'event.deleted', action: 'cancelled' },
    { prefix: 'event.rescheduled', action: 'rescheduled' },
    { prefix: 'event.created', action: 'created' },
    { prefix: 'event.updated', action: 'updated' },
    { prefix: 'meeting.cancelled', action: 'cancelled' },
    { prefix: 'meeting.rescheduled', action: 'rescheduled' },
    { prefix: 'meeting.created', action: 'created' },
    { prefix: 'meeting.updated', action: 'updated' },
    { prefix: 'cancelled', action: 'cancelled' },
    { prefix: 'rescheduled', action: 'rescheduled' },
    { prefix: 'created', action: 'created' },
    { prefix: 'updated', action: 'updated' },
  ],
  defaults: {
    is_all_day: false,
  },
};

export const CALENDAR_FIELD_LABELS = {
  title: 'Title (required for create/update)',
  description: 'Description',
  location: 'Location',
  start_at: 'Start date/time (required for create/update)',
  end_at: 'End date/time (required for create/update)',
  is_all_day: 'All-day flag',
  attendee_emails: 'Invitees (emails or mixed attendee objects)',
  attendee_user_ids: 'Invitee user IDs',
  action: 'Action (created, updated, rescheduled, cancelled)',
  external_event_id: 'External event ID (required)',
  created_by: 'Organizer email',
  created_by_user_id: 'Organizer user ID',
};

export const NESTED_CALENDAR_FIELD_MAPPINGS = {
  title: ['data.title'],
  description: ['data.description'],
  location: ['data.location'],
  start_at: ['data.start_at', 'data.starts_at', 'data.scheduled_start'],
  end_at: ['data.end_at', 'data.ends_at', 'data.scheduled_end'],
  is_all_day: ['data.is_all_day'],
  attendee_emails: ['data.attendee_emails', 'data.attendees'],
  attendee_user_ids: ['data.attendee_user_ids', 'data.user_ids'],
  action: ['event', 'data.action', 'data.type'],
  external_event_id: ['data.id', 'data.event_id', 'data.external_event_id'],
  created_by: ['data.organizer_email', 'data.created_by'],
  created_by_user_id: ['data.organizer_user_id', 'data.user_id'],
};

function parseCalendarConfig(raw) {
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

export function normalizeCalendarEventMapping(config) {
  const defaults = DEFAULT_CALENDAR_EVENT_MAPPING;
  const parsed = parseCalendarConfig(config);

  if (!parsed) {
    return {
      ...defaults,
      field_mappings: { ...defaults.field_mappings },
      action_rules: [...defaults.action_rules],
      defaults: { ...defaults.defaults },
    };
  }

  const savedMappings = sanitizeFieldMappings(parsed.field_mappings);
  const hasSavedMappings = Object.keys(savedMappings).length > 0;

  return {
    auto_sync: Boolean(parsed.auto_sync),
    webhook_secret: parsed.webhook_secret || '',
    field_mappings: hasSavedMappings
      ? {
        ...Object.fromEntries(
          Object.keys(defaults.field_mappings).map((key) => [key, savedMappings[key] ?? []])
        ),
        ...savedMappings,
      }
      : { ...defaults.field_mappings },
    action_rules: Array.isArray(parsed.action_rules) && parsed.action_rules.length
      ? parsed.action_rules
      : defaults.action_rules,
    defaults: {
      ...defaults.defaults,
      ...(parsed.defaults || {}),
    },
  };
}

export function applicationCalendarSyncEnabled(application) {
  return normalizeCalendarEventMapping(application?.calendar_config).auto_sync;
}

export function fieldMappingsToForm(fieldMappings) {
  return Object.fromEntries(
    Object.keys(DEFAULT_CALENDAR_EVENT_MAPPING.field_mappings).map((key) => [
      key,
      Array.isArray(fieldMappings?.[key]) ? fieldMappings[key].join(', ') : '',
    ])
  );
}

export function formToFieldMappings(form) {
  return Object.fromEntries(
    Object.keys(DEFAULT_CALENDAR_EVENT_MAPPING.field_mappings).map((key) => [
      key,
      String(form?.[key] || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ])
  );
}

export function buildSampleCalendarEvent() {
  return {
    event: 'calendar.created',
    external_event_id: 'meet-1234',
    title: 'Quarterly planning',
    description: 'Review Q3 goals and blockers',
    location: 'HQ Meeting Room A',
    start_at: '2026-06-25T10:00:00+08:00',
    end_at: '2026-06-25T11:00:00+08:00',
    is_all_day: false,
    attendee_emails: ['alex@example.com', 'sam@example.com'],
    created_by_user_id: 1,
  };
}

export function buildNestedSampleCalendarEvent() {
  return {
    event: 'calendar.rescheduled',
    fired_at: '2026-06-11T23:45:01.907473+08:00',
    data: {
      id: 'meet-1234',
      action: 'rescheduled',
      title: 'Quarterly planning',
      description: 'Review Q3 goals and blockers',
      location: 'HQ Meeting Room A',
      start_at: '2026-06-26T14:00:00+08:00',
      end_at: '2026-06-26T15:00:00+08:00',
      attendee_emails: ['alex@example.com', { user_id: 42 }],
      attendee_user_ids: [7],
      organizer_user_id: 1,
    },
  };
}
