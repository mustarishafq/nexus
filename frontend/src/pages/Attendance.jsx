// @ts-nocheck
import React, { useMemo } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { CalendarCheck, Clock, History, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { normalizeAttendanceWatermarkConfig } from '@/lib/watermarkConfig';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'clock-in', label: 'Clock In', icon: LogIn, path: '/attendance', requiresClockIn: true },
  { id: 'records', label: 'Records', icon: History, path: '/attendance/records', requiresClockIn: true },
  { id: 'events', label: 'Events', icon: CalendarCheck, path: '/attendance/events', requiresClockIn: false },
];

const SECTION_DESCRIPTIONS = {
  'clock-in': 'Punch in or out with a photo and location.',
  records: 'Review your attendance history and export organization-wide records.',
  events: "Events you've checked in to, and organization-wide event attendance.",
};

function resolveActiveSection(pathname) {
  if (pathname.startsWith('/attendance/events')) return 'events';
  if (pathname.startsWith('/attendance/records')) return 'records';
  return 'clock-in';
}

function AttendanceSectionNav({ sections, activeSection }) {
  return (
    <div
      className="flex w-fit items-center gap-1 rounded-xl border border-border bg-muted/30 p-1"
      role="tablist"
      aria-label="Attendance sections"
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const active = activeSection === section.id;

        return (
          <Link
            key={section.id}
            to={section.path}
            role="tab"
            aria-selected={active}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors touch-manipulation',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {section.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function Attendance() {
  const { appPublicSettings } = useAuth();
  const location = useLocation();

  const attendanceConfig = useMemo(
    () => normalizeAttendanceWatermarkConfig(appPublicSettings),
    [appPublicSettings],
  );

  const clockInEnabled = attendanceConfig.enabled;
  const activeSection = resolveActiveSection(location.pathname);
  const sections = clockInEnabled ? SECTIONS : SECTIONS.filter((section) => !section.requiresClockIn);

  // Clock in/out disabled: event attendance history is still available.
  if (!clockInEnabled && activeSection !== 'events') {
    return <Navigate to="/attendance/events" replace />;
  }

  return (
    <div
      className={cn(
        'mx-auto w-full min-w-0 max-w-full space-y-3 overflow-x-hidden sm:space-y-4',
        activeSection === 'clock-in' ? 'max-w-5xl' : 'max-w-none',
      )}
    >
      <div className="min-w-0 space-y-2.5 sm:space-y-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <Clock className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" /> Attendance
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {SECTION_DESCRIPTIONS[activeSection]}
          </p>
        </div>

        {sections.length > 1 ? (
          <AttendanceSectionNav sections={sections} activeSection={activeSection} />
        ) : null}
      </div>

      <Outlet />
    </div>
  );
}
