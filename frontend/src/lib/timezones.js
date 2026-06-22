const FALLBACK_TIMEZONES = [
  'UTC',
  'Asia/Kuala_Lumpur',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Asia/Bangkok',
  'Asia/Manila',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const PRIORITY_TIMEZONES = [
  'Asia/Kuala_Lumpur',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Asia/Bangkok',
  'UTC',
];

export function getTimezoneValues() {
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      // Fall through to static list.
    }
  }

  return FALLBACK_TIMEZONES;
}

export function formatTimezoneLabel(timezone) {
  const readableName = timezone.replace(/_/g, ' ');

  try {
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;

    return offset ? `${readableName} (${offset})` : readableName;
  } catch {
    return readableName;
  }
}

export function getTimezoneOptions() {
  const values = getTimezoneValues();
  const priority = new Set(PRIORITY_TIMEZONES);

  return values
    .map((value) => ({
      value,
      label: formatTimezoneLabel(value),
      priority: priority.has(value),
    }))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    });
}

export function getDefaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function filterTimezoneOptions(options, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) => (
    option.value.toLowerCase().includes(normalizedQuery)
    || option.label.toLowerCase().includes(normalizedQuery)
  ));
}
