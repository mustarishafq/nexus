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

export const DEFAULT_DEPARTMENT_ATTENDANCE_SETTINGS = {
  enabled: true,
  geofence_enabled: false,
  center_latitude: '',
  center_longitude: '',
  radius_meters: 200,
  allow_outside_radius: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  grace_period_minutes: 15,
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
    geofence_enabled: Boolean(input.geofence_enabled),
    center_latitude: input.center_latitude ?? '',
    center_longitude: input.center_longitude ?? '',
    radius_meters: Number(input.radius_meters ?? 200),
    allow_outside_radius: Boolean(input.allow_outside_radius),
    timezone: input.timezone || base.timezone,
    grace_period_minutes: Number(input.grace_period_minutes ?? 15),
    allow_outside_shift_hours: Boolean(input.allow_outside_shift_hours),
    overtime_enabled: input.overtime_enabled !== false,
    standard_hours_per_day: Number(input.standard_hours_per_day ?? 8),
    overtime_threshold_minutes: Number(input.overtime_threshold_minutes ?? 0),
    shifts,
  };
}

export function departmentAttendanceSettingsToPayload(form) {
  const normalized = normalizeDepartmentAttendanceSettings(form);

  return {
    ...normalized,
    center_latitude: normalized.center_latitude === '' ? null : Number(normalized.center_latitude),
    center_longitude: normalized.center_longitude === '' ? null : Number(normalized.center_longitude),
  };
}

function parseTimeToMinutes(time) {
  const [hour, minute] = String(time).slice(0, 5).split(':').map(Number);
  return (hour * 60) + minute;
}

export function isWithinShift(shift, date, graceMinutes = 0) {
  const days = shift?.days_of_week || [];
  if (!days.length) return true;

  const isoDay = date.getDay() === 0 ? 7 : date.getDay();
  const current = (date.getHours() * 60) + date.getMinutes();
  const start = parseTimeToMinutes(shift.start_time);
  const end = parseTimeToMinutes(shift.end_time);
  const crosses = Boolean(shift.crosses_midnight);

  if (crosses) {
    const startBound = Math.max(0, start - graceMinutes);
    const endBound = Math.min((24 * 60) - 1, end + graceMinutes);
    if (current >= startBound && days.includes(isoDay)) return true;
    const previousDay = isoDay === 1 ? 7 : isoDay - 1;
    return current <= endBound && days.includes(previousDay);
  }

  if (!days.includes(isoDay)) return false;
  const startBound = Math.max(0, start - graceMinutes);
  const endBound = Math.min((24 * 60) - 1, end + graceMinutes);
  return current >= startBound && current <= endBound;
}

export function findActiveShift(policy, date = new Date()) {
  if (!policy?.shifts?.length) return null;
  const grace = policy.grace_period_minutes ?? 0;
  return policy.shifts.find((shift) => isWithinShift(shift, date, grace)) || null;
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

export function formatShiftSummary(shift) {
  const dayLabels = WEEKDAYS
    .filter((day) => shift.days_of_week?.includes(day.value))
    .map((day) => day.label)
    .join(', ');
  return `${shift.name}: ${dayLabels || 'Every day'} ${shift.start_time}–${shift.end_time}`;
}

export function describeAttendancePolicy(policy) {
  if (!policy) {
    return 'No department attendance rules apply.';
  }

  const parts = [];
  if (policy.department_name) {
    parts.push(`Department: ${policy.department_name}`);
  }
  if (policy.geofence_enabled) {
    parts.push(`Must be within ${policy.radius_meters}m of the assigned location`);
  }
  if (policy.shifts?.length) {
    parts.push(`Shifts: ${policy.shifts.map(formatShiftSummary).join(' · ')}`);
  }
  if (policy.overtime_enabled) {
    parts.push(`Overtime after ${policy.standard_hours_per_day}h standard day`);
  }
  if (policy.grace_period_minutes) {
    parts.push(`${policy.grace_period_minutes} min grace period`);
  }

  return parts.join(' · ');
}
