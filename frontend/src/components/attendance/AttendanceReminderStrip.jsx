import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LogIn, LogOut } from 'lucide-react';
import {
  ATTENDANCE_REMINDER_DISMISS_KEY,
  reminderDismissKey,
  useAttendanceReminder,
} from '@/hooks/useAttendanceReminder';
import { TopStripBadge, TopStripDismissButton, TOP_STRIP_ROW_CLASS } from '@/components/layout/TopStripBadge';
import { cn } from '@/lib/utils';

const stripStyles = {
  high: 'bg-gradient-to-r from-amber-900/95 via-amber-800/95 to-amber-900/95 text-amber-50 border-amber-950/30',
  medium: 'bg-gradient-to-r from-sky-900/95 via-sky-800/95 to-sky-900/95 text-sky-50 border-sky-950/30',
};

function AttendanceBadge({ type, urgency }) {
  const isUrgent = urgency === 'high';

  return (
    <>
      <TopStripBadge
        label={type === 'clock_in' ? 'In' : 'Out'}
        pulse={isUrgent}
        dotClassName={isUrgent ? 'bg-amber-400' : 'bg-sky-300'}
        className="sm:hidden"
      />
      <TopStripBadge
        label={type === 'clock_in' ? 'Clock In' : 'Clock Out'}
        pulse={isUrgent}
        dotClassName={isUrgent ? 'bg-amber-400' : 'bg-sky-300'}
        className="hidden sm:flex"
      />
    </>
  );
}

export default function AttendanceReminderStrip({ embedded = false, onVisibilityChange }) {
  const { data: reminder } = useAttendanceReminder();
  const [dismissedKey, setDismissedKey] = useState(() => {
    try {
      return sessionStorage.getItem(ATTENDANCE_REMINDER_DISMISS_KEY);
    } catch {
      return null;
    }
  });

  const currentKey = reminderDismissKey(reminder);
  const isDismissed = currentKey && dismissedKey === currentKey;
  const visible = Boolean(reminder) && !isDismissed;

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [onVisibilityChange, visible]);

  if (!visible) {
    return null;
  }

  const isClockIn = reminder.type === 'clock_in';
  const ActionIcon = isClockIn ? LogIn : LogOut;
  const urgency = reminder.urgency === 'high' ? 'high' : 'medium';
  const minutesLate = Math.max(0, Math.round(Number(reminder.minutes_late) || 0));
  const shortMessage = minutesLate > 0
    ? `${minutesLate} min late — tap to clock ${isClockIn ? 'in' : 'out'}`
    : `Tap to clock ${isClockIn ? 'in' : 'out'}`;

  const dismiss = () => {
    try {
      sessionStorage.setItem(ATTENDANCE_REMINDER_DISMISS_KEY, currentKey);
    } catch {
      // ignore
    }
    setDismissedKey(currentKey);
  };

  return (
    <div
      className={cn(
        'border-b backdrop-blur-sm transition-all duration-200',
        embedded ? 'w-full' : 'sticky top-16 z-20',
        stripStyles[urgency],
      )}
      role="status"
      aria-live="polite"
    >
      <div className={TOP_STRIP_ROW_CLASS}>
        <AttendanceBadge type={reminder.type} urgency={urgency} />

        <Link
          to="/attendance"
          className="flex min-w-0 flex-1 items-center gap-2 self-stretch px-2 text-[10px] leading-none transition-colors hover:bg-white/5 sm:px-3 sm:text-[11px]"
        >
          <ActionIcon className="hidden h-3.5 w-3.5 shrink-0 opacity-90 sm:block" />
          <span className="truncate sm:hidden">{shortMessage}</span>
          <span className="hidden truncate sm:inline">{reminder.message}</span>
        </Link>

        <Link
          to="/attendance"
          className="hidden h-8 shrink-0 items-center gap-1 self-stretch border-l border-white/10 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 transition-colors hover:bg-white/10 sm:flex"
        >
          Open
          <ChevronRight className="h-3 w-3" />
        </Link>

        <TopStripDismissButton onClick={dismiss} ariaLabel="Dismiss attendance reminder" />
      </div>
    </div>
  );
}
