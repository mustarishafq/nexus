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
    <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const active = activeSection === section.id;

        return (
          <Link
            key={section.id}
            to={section.path}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors min-h-[40px]',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
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
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" /> Attendance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeSection === 'clock-in'
              ? 'Take a watermarked photo to clock in or out with date, time, and location.'
              : 'Review your attendance history and export organization-wide records.'}
          </p>
        </div>

        <AttendanceSectionNav activeSection={activeSection} />
      </div>

      <Outlet />
    </div>
  );
}
