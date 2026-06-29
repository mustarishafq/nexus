import { useLocation } from 'react-router-dom';
import db from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { normalizeAttendanceWatermarkConfig } from '@/lib/watermarkConfig';

const ATTENDANCE_PATH = '/attendance';
export const ATTENDANCE_REMINDER_DISMISS_KEY = 'attendance-reminder-dismissed';

export const ATTENDANCE_STATUS_QUERY_KEY = ['attendance-status'];

const ATTENDANCE_STATUS_REFETCH_MS = 60 * 1000;

export function useAttendanceStatus({ enabled = true, select, ...queryOptions } = {}) {
  const { user, appPublicSettings } = useAuth();
  const attendanceEnabled = normalizeAttendanceWatermarkConfig(appPublicSettings).enabled;

  return useQuery({
    queryKey: ATTENDANCE_STATUS_QUERY_KEY,
    queryFn: () => db.attendance.status(),
    enabled: Boolean(user) && enabled && attendanceEnabled,
    refetchInterval: ATTENDANCE_STATUS_REFETCH_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    ...queryOptions,
    select,
  });
}

export function useAttendanceReminder({ enabled = true } = {}) {
  return useAttendanceStatus({
    enabled,
    select: (data) => data?.reminder ?? null,
  });
}

export function reminderDismissKey(reminder) {
  if (!reminder) return null;
  const day = new Date().toISOString().slice(0, 10);
  return `attendance-reminder:${day}:${reminder.type}:${reminder.shift_name || 'shift'}`;
}

function isAttendanceReminderDismissed(reminder) {
  const currentKey = reminderDismissKey(reminder);
  if (!currentKey) return false;

  try {
    return sessionStorage.getItem(ATTENDANCE_REMINDER_DISMISS_KEY) === currentKey;
  } catch {
    return false;
  }
}

export function shouldRedirectToAttendance(status) {
  const reminder = status?.reminder;
  if (reminder?.type !== 'clock_in') {
    return false;
  }

  return !isAttendanceReminderDismissed(reminder);
}

/** Redirect to attendance when clock-in is required (same rules as the reminder strip). */
export function useAttendanceClockInRedirect() {
  const location = useLocation();
  const { appPublicSettings } = useAuth();
  const attendanceConfig = normalizeAttendanceWatermarkConfig(appPublicSettings);
  const onAttendancePage = location.pathname === ATTENDANCE_PATH
    || location.pathname.startsWith(`${ATTENDANCE_PATH}/`);
  const needsRedirectCheck = attendanceConfig.enabled
    && attendanceConfig.clock_in_redirect_enabled
    && !onAttendancePage;

  const { data: status, isPending } = useAttendanceStatus({
    enabled: needsRedirectCheck,
  });

  return {
    shouldRedirect: needsRedirectCheck && !isPending && shouldRedirectToAttendance(status),
    fromPath: location.pathname,
  };
}

export { ATTENDANCE_PATH };
