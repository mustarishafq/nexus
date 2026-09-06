import { formatDecimalHours, formatDurationMinutes } from '@/lib/formatDuration';

export const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

export const DEFAULT_SHIFT = {
  name: 'Day Shift',
  days_of_week: [1, 2, 3, 4, 5],
  start_time: '09:00',
  end_time: '18:00',
  crosses_midnight: false,
};

export const DEFAULT_SITE = {
  name: 'EMZI HQ',
  latitude: '',
  longitude: '',
};

export const DEFAULT_DEPARTMENT_ATTENDANCE_SETTINGS = {
  enabled: true,
  attendance_location_id: null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  grace_period_minutes: 15,
  require_early_clock_out_reason: false,
  require_late_clock_in_reason: false,
  allow_outside_shift_hours: false,
  overtime_enabled: true,
  standard_hours_per_day: 8,
  overtime_threshold_minutes: 0,
  shifts: [{ ...DEFAULT_SHIFT }],
};

export function normalizeDepartmentAttendanceSettings(input = {}) {
  const base = { ...DEFAULT_DEPARTMENT_ATTENDANCE_SETTINGS };
  const shifts = Array.isArray(input.shifts) && input.shifts.length
    ? input.shifts.map((shift) => ({
      name: shift.name || 'Shift',
      days_of_week: Array.isArray(shift.days_of_week) ? shift.days_of_week.map(Number) : [],
      start_time: (shift.start_time || '09:00').slice(0, 5),
      end_time: (shift.end_time || '18:00').slice(0, 5),
      crosses_midnight: Boolean(shift.crosses_midnight),
    }))
    : [{ ...DEFAULT_SHIFT }];

  return {
    enabled: input.enabled !== false,
    attendance_location_id: input.attendance_location_id ?? null,
    timezone: input.timezone || base.timezone,
    grace_period_minutes: Number(input.grace_period_minutes ?? 15),
    require_early_clock_out_reason: Boolean(input.require_early_clock_out_reason),
    require_late_clock_in_reason: Boolean(input.require_late_clock_in_reason),
    allow_outside_shift_hours: Boolean(input.allow_outside_shift_hours),
    overtime_enabled: input.overtime_enabled !== false,
    standard_hours_per_day: Number(input.standard_hours_per_day ?? 8),
    overtime_threshold_minutes: Number(input.overtime_threshold_minutes ?? 0),
    shifts,
    geofence_enabled: Boolean(input.geofence_enabled),
    center_latitude: input.center_latitude ?? '',
    center_longitude: input.center_longitude ?? '',
    sites: Array.isArray(input.sites) ? input.sites : [],
    radius_meters: Number(input.radius_meters ?? 200),
    allow_outside_radius: Boolean(input.allow_outside_radius),
    allow_clock_out_outside_radius: Object.prototype.hasOwnProperty.call(input, 'allow_clock_out_outside_radius')
      ? Boolean(input.allow_clock_out_outside_radius)
      : Boolean(input.allow_outside_radius),
  };
}

export function departmentAttendanceSettingsToPayload(form) {
  const normalized = normalizeDepartmentAttendanceSettings(form);

  return {
    enabled: normalized.enabled,
    attendance_location_id: normalized.attendance_location_id,
    timezone: normalized.timezone,
    grace_period_minutes: normalized.grace_period_minutes,
    require_early_clock_out_reason: normalized.require_early_clock_out_reason,
    require_late_clock_in_reason: normalized.require_late_clock_in_reason,
    allow_outside_shift_hours: normalized.allow_outside_shift_hours,
    overtime_enabled: normalized.overtime_enabled,
    standard_hours_per_day: normalized.standard_hours_per_day,
    overtime_threshold_minutes: normalized.overtime_threshold_minutes,
    shifts: normalized.shifts,
  };
}

function parseTimeToMinutes(time) {
  const [hour, minute] = String(time).slice(0, 5).split(':').map(Number);
  return (hour * 60) + minute;
}

const WEEKDAY_TO_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function zonedTimeParts(date, timeZone) {
  const instant = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(instant.getTime())) {
    return { isoDay: 1, minutes: 0 };
  }
  if (!timeZone) {
    return {
      isoDay: instant.getDay() === 0 ? 7 : instant.getDay(),
      minutes: (instant.getHours() * 60) + instant.getMinutes(),
    };
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(instant);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const hour = Number(map.hour);
    const minute = Number(map.minute);
    return {
      isoDay: WEEKDAY_TO_ISO[map.weekday] || (instant.getDay() === 0 ? 7 : instant.getDay()),
      minutes: ((Number.isFinite(hour) ? hour : 0) * 60) + (Number.isFinite(minute) ? minute : 0),
    };
  } catch {
    return {
      isoDay: instant.getDay() === 0 ? 7 : instant.getDay(),
      minutes: (instant.getHours() * 60) + instant.getMinutes(),
    };
  }
}

function isWithinShiftAt(shift, zoned, graceMinutes = 0, earlyWindowMinutes = 60) {
  const days = shift?.days_of_week || [];
  if (!days.length) return true;

  const start = parseTimeToMinutes(shift.start_time);
  const end = parseTimeToMinutes(shift.end_time);
  const crosses = Boolean(shift.crosses_midnight);
  const current = zoned.minutes;
  const isoDay = zoned.isoDay;
  const earlyWindow = Number.isFinite(Number(earlyWindowMinutes))
    ? Math.max(0, Number(earlyWindowMinutes))
    : 60;

  if (crosses) {
    const startBound = Math.max(0, start - earlyWindow);
    const endBound = Math.min((24 * 60) - 1, end + graceMinutes);
    if (current >= startBound && days.includes(isoDay)) return true;
    const previousDay = isoDay === 1 ? 7 : isoDay - 1;
    return current <= endBound && days.includes(previousDay);
  }

  if (!days.includes(isoDay)) return false;
  const startBound = Math.max(0, start - earlyWindow);
  const endBound = Math.min((24 * 60) - 1, end + graceMinutes);
  return current >= startBound && current <= endBound;
}

export function isWithinShift(shift, date, graceMinutes = 0, earlyWindowMinutes = 60, timeZone = null) {
  return isWithinShiftAt(shift, zonedTimeParts(date, timeZone), graceMinutes, earlyWindowMinutes);
}

function specialReleaseTypeLabel(type) {
  return ({
    wfh: 'WFH',
    outstation: 'Outstation',
    training: 'Training',
    event: 'Event',
  }[type] || 'Other');
}

export function specialReleaseOverwriteShift(policy) {
  const release = policy?.active_special_release;
  const start = String(release?.shift_start_time || '').slice(0, 5);
  const end = String(release?.shift_end_time || '').slice(0, 5);
  if (!release?.overwrite_shift || !/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) {
    return null;
  }
  return {
    id: release.id != null ? `special-release-${release.id}` : 'special-release',
    name: `Special release (${specialReleaseTypeLabel(release.type)})`,
    days_of_week: [1, 2, 3, 4, 5, 6, 7],
    start_time: start.length === 4 ? `0${start}` : start,
    end_time: end.length === 4 ? `0${end}` : end,
    crosses_midnight: Boolean(release.shift_crosses_midnight),
  };
}

function catalogShiftById(shifts, id) {
  if (id == null || id === '') return null;
  return (shifts || []).find((shift) => String(shift.id) === String(id)) || null;
}

function plannedShiftFromPolicy(policy) {
  const catalog = Array.isArray(policy?.shifts) ? policy.shifts : [];
  const fromId = catalogShiftById(catalog, policy?.planned_shift_id);
  if (fromId) return fromId;
  const planned = policy?.planned_shift;
  if (!planned?.start_time) return null;
  return {
    id: planned.id,
    name: planned.name,
    start_time: String(planned.start_time).slice(0, 5),
    end_time: String(planned.end_time || '18:00').slice(0, 5),
    crosses_midnight: Boolean(planned.crosses_midnight),
    days_of_week: Array.isArray(planned.days_of_week) ? planned.days_of_week : [1, 2, 3, 4, 5, 6, 7],
  };
}

export function resolveShiftForLateClockIn(policy, date = new Date()) {
  const overwrite = specialReleaseOverwriteShift(policy);
  if (overwrite) return overwrite;

  const planned = plannedShiftFromPolicy(policy);
  if (planned) return planned;

  const catalog = Array.isArray(policy?.shifts) ? policy.shifts : [];
  if (!catalog.length) return null;

  const zoned = zonedTimeParts(date, policy?.timezone);
  const grace = Number(policy?.grace_period_minutes ?? 0);
  const earlyWindow = Number(policy?.early_clock_in_window_minutes ?? 60);
  const assignedIds = (Array.isArray(policy?.attendance_shift_ids)
    ? policy.attendance_shift_ids
    : (policy?.attendance_shift_id ? [policy.attendance_shift_id] : [])
  ).map(String).filter(Boolean);

  let candidates = catalog.filter((shift) => {
    const days = shift?.days_of_week || [];
    return !days.length || days.includes(zoned.isoDay);
  });
  if (assignedIds.length) {
    const assigned = candidates.filter((shift) => assignedIds.includes(String(shift.id)));
    if (assigned.length) candidates = assigned;
  }
  if (!candidates.length) {
    candidates = catalog;
  }

  const within = candidates.find((candidate) => isWithinShiftAt(candidate, zoned, grace, earlyWindow));
  if (within) return within;
  if (candidates.length === 1) return candidates[0];

  let shift = candidates[0];
  let bestDistance = Infinity;
  candidates.forEach((candidate) => {
    const start = parseTimeToMinutes(candidate.start_time || '09:00');
    const distance = Math.abs(zoned.minutes - start);
    if (distance < bestDistance) {
      bestDistance = distance;
      shift = candidate;
    }
  });
  return shift;
}

export function findActiveShift(policy, date = new Date()) {
  return resolveShiftForLateClockIn(policy, date);
}

function lateMinutesAgainstShift(shift, currentMinutes, grace) {
  const start = parseTimeToMinutes(shift.start_time || '09:00');
  const end = parseTimeToMinutes(shift.end_time || '18:00');
  const crosses = Boolean(shift.crosses_midnight);
  const endBound = Math.min((24 * 60) - 1, end + grace);
  const onMorningLeg = crosses && currentMinutes <= endBound;
  const startAbs = onMorningLeg ? start - (24 * 60) : start;
  const late = currentMinutes - (startAbs + grace);
  return late > 0 ? late : 0;
}

/**
 * Mirror backend AttendanceLateEvaluator: late if after resolved shift start + grace.
 * Uses overwrite / planned shift and department timezone when present.
 * @returns {{ is_late: boolean, late_minutes: number, scheduled_start: Date|null, shift_name: string|null }}
 */
export function evaluateLateClockIn(policy, date = new Date()) {
  const result = {
    is_late: false,
    late_minutes: 0,
    scheduled_start: null,
    shift_name: null,
  };

  const shift = resolveShiftForLateClockIn(policy, date);
  if (!shift) {
    return result;
  }

  const grace = Number(policy?.grace_period_minutes ?? 0);
  const zoned = zonedTimeParts(date, policy?.timezone);
  const lateMinutes = lateMinutesAgainstShift(shift, zoned.minutes, grace);

  result.shift_name = shift.name || null;
  if (lateMinutes > 0) {
    result.is_late = true;
    result.late_minutes = lateMinutes;
  }

  return result;
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const latFrom = toRad(lat1);
  const latTo = toRad(lat2);
  const latDelta = toRad(lat2 - lat1);
  const lngDelta = toRad(lng2 - lng1);
  const a = (Math.sin(latDelta / 2) ** 2)
    + (Math.cos(latFrom) * Math.cos(latTo) * (Math.sin(lngDelta / 2) ** 2));
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function resolveAttendanceSites(policy) {
  if (!policy) return [];

  if (Array.isArray(policy.sites) && policy.sites.length) {
    return policy.sites
      .map((site) => ({
        name: site.name,
        latitude: Number(site.latitude),
        longitude: Number(site.longitude),
      }))
      .filter((site) => site.name && Number.isFinite(site.latitude) && Number.isFinite(site.longitude));
  }

  if (policy.center_latitude != null && policy.center_longitude != null) {
    return [{
      name: 'Primary location',
      latitude: Number(policy.center_latitude),
      longitude: Number(policy.center_longitude),
    }];
  }

  return [];
}

export function findNearestAttendanceSite(sites, latitude, longitude) {
  if (!sites?.length || latitude == null || longitude == null) {
    return null;
  }

  let nearest = null;

  sites.forEach((site) => {
    const distance = haversineMeters(site.latitude, site.longitude, latitude, longitude);
    if (!nearest || distance < nearest.distance) {
      nearest = { site, distance };
    }
  });

  return nearest;
}

export function findMatchingAttendanceSite(sites, latitude, longitude, radiusMeters) {
  const nearest = findNearestAttendanceSite(sites, latitude, longitude);
  if (!nearest || nearest.distance > radiusMeters) {
    return null;
  }

  return nearest;
}

export function resolveAttendanceSiteLabel(sites, latitude, longitude, radiusMeters) {
  return findMatchingAttendanceSite(sites, latitude, longitude, radiusMeters)?.site?.name || null;
}

export function formatShiftSummary(shift) {
  const dayLabels = WEEKDAYS
    .filter((day) => shift.days_of_week?.includes(day.value))
    .map((day) => day.label)
    .join(', ');
  return `${shift.name}: ${dayLabels || 'Every day'} ${shift.start_time}–${shift.end_time}`;
}

export function listAttendancePolicyParts(policy) {
  if (!policy) {
    return [];
  }

  const parts = [];
  if (policy.department_name) {
    parts.push(`Department: ${policy.department_name}`);
  }
  if (policy.attendance_location_name) {
    parts.push(`Location: ${policy.attendance_location_name}`);
  }
  if (policy.geofence_enabled) {
    const siteCount = resolveAttendanceSites(policy).length;
    if (siteCount > 1) {
      parts.push(`Within ${policy.radius_meters}m of one of ${siteCount} registered sites`);
    } else {
      parts.push(`Within ${policy.radius_meters}m of assigned location`);
    }
    if (policy.allow_outside_radius) {
      parts.push('Outstation clock-in allowed with warning');
    }
    if (policy.allow_clock_out_outside_radius) {
      parts.push('Outstation clock-out allowed with warning');
    }
  }
  if (policy.shifts?.length) {
    parts.push(...policy.shifts.map((shift) => formatShiftSummary(shift)));
  }
  if (policy.overtime_enabled) {
    parts.push(`Overtime after ${formatDecimalHours(policy.standard_hours_per_day)} standard day`);
  }
  if (policy.grace_period_minutes) {
    parts.push(`${formatDurationMinutes(policy.grace_period_minutes, { style: 'long' })} grace period`);
  }
  if (policy.require_early_clock_out_reason) {
    parts.push('Early clock-out reason required');
  }
  if (policy.require_late_clock_in_reason) {
    parts.push('Late clock-in reason required');
  }

  return parts;
}

export function describeAttendancePolicy(policy) {
  const parts = listAttendancePolicyParts(policy);
  if (!parts.length) {
    return 'No department attendance rules apply.';
  }
  return parts.join(' · ');
}
