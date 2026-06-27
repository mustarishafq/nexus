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
 * Format minutes as a human-readable duration (e.g. "1h 30m", "45m").
 */
export function formatDurationMinutes(value, { style = 'short' } = {}) {
  const totalMinutes = normalizeMinutes(value);

  if (totalMinutes === 0) {
    return style === 'long' ? '0 min' : '0m';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (style === 'long') {
    if (hours > 0 && minutes > 0) {
      return `${hours} hr ${minutes} min`;
    }
    if (hours > 0) {
      return `${hours} hr`;
    }
    return `${minutes} min`;
  }

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Format decimal hours (e.g. 8.5) as hours and minutes.
 */
export function formatDecimalHours(value, options = {}) {
  return formatDurationMinutes(normalizeMinutes(Number(value) * 60), options);
}
