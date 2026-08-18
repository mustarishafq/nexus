/**
 * Normalize a minute value to a whole, non-negative number.
 */
export function normalizeMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

/**
 * Format minutes as a human-readable duration (e.g. "1h 30m", "2d 3h", "45m").
 */
export function formatDurationMinutes(value, { style = 'short' } = {}) {
  const totalMinutes = normalizeMinutes(value);

  if (totalMinutes === 0) {
    return style === 'long' ? '0 min' : '0m';
  }

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (style === 'long') {
    const parts = [];
    if (days > 0) {
      parts.push(`${days} day${days === 1 ? '' : 's'}`);
    }
    if (hours > 0) {
      parts.push(`${hours} hr`);
    }
    if (minutes > 0 && days === 0) {
      parts.push(`${minutes} min`);
    }
    return parts.join(' ') || '0 min';
  }

  const parts = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 && days === 0) {
    parts.push(`${minutes}m`);
  }
  return parts.join(' ') || '0m';
}

/**
 * Format decimal hours (e.g. 8.5) as hours and minutes.
 */
export function formatDecimalHours(value, options = {}) {
  return formatDurationMinutes(normalizeMinutes(Number(value) * 60), options);
}
