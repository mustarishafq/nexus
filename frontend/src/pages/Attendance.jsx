// @ts-nocheck
import React, { useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Clock, History, LogIn } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';
import { normalizeAttendanceWatermarkConfig } from '@/lib/watermarkConfig';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'clock-in', label: 'Clock In', icon: LogIn, path: '/attendance' },
  { id: 'records', label: 'Records', icon: History, path: '/attendance/records' },
];

function AttendanceSectionNav({ activeSection }) {
  return (
    <div
      className="flex w-fit items-center gap-1 rounded-xl border border-border bg-muted/30 p-1"
      role="tablist"
      aria-label="Attendance sections"
    >
      {SECTIONS.map((section) => {
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

  const activeSection = location.pathname.startsWith('/attendance/records') ? 'records' : 'clock-in';

  if (!attendanceConfig.enabled) {
    return (
      <Card className="mx-auto w-full max-w-5xl rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" /> Attendance unavailable
          </CardTitle>
          <CardDescription>Clock in/out has been disabled by an administrator.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        'mx-auto w-full min-w-0 max-w-full space-y-3 overflow-x-hidden sm:space-y-4',
        activeSection === 'records' ? 'max-w-none' : 'max-w-5xl',
      )}
    >
      <div className="min-w-0 space-y-2.5 sm:space-y-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <Clock className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" /> Attendance
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {activeSection === 'clock-in'
              ? 'Take a selfie, then clock in or out with date, time, and location.'
              : 'Review your attendance history and export organization-wide records.'}
          </p>
        </div>

        <AttendanceSectionNav activeSection={activeSection} />
      </div>

      <Outlet />
    </div>
  );
}
