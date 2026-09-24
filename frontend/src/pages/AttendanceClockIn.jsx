// @ts-nocheck
import db from '@/api/apiClient';
import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Loader2,
  LogIn,
  LogOut,
  MapPin,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AttendanceCamera from '@/components/attendance/AttendanceCamera';
import ExpActionHint from '@/components/gamification/ExpActionHint';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAttendanceStatus, ATTENDANCE_STATUS_QUERY_KEY } from '@/hooks/useAttendanceReminder';
import { useAuth } from '@/lib/AuthContext';
import { canViewAllAttendance } from '@/lib/roles';
import {
  evaluateLateClockIn,
  findActiveShift,
  findMatchingAttendanceSite,
  findNearestAttendanceSite,
  resolveAttendanceSites,
} from '@/lib/attendancePolicy';
import { getDeviceInfo } from '@/lib/deviceInfo';
import { formatDurationMinutes } from '@/lib/formatDuration';
import { notifyGamificationOffers } from '@/lib/gamification';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function formatRecordType(type) {
  return type === 'clock_in' ? 'Clock in' : 'Clock out';
}

const TONE = {
  muted: {
    softCard: 'border-border/80 bg-card',
    iconWell: 'bg-muted text-muted-foreground',
  },
  info: {
    softCard: 'border-info/25 bg-info/5',
    iconWell: 'bg-info/10 text-info',
    chip: 'border-info/30 bg-info/10 text-info',
  },
  success: {
    softCard: 'border-success/25 bg-success/5',
    iconWell: 'bg-success/10 text-success',
    chip: 'border-success/30 bg-success/10 text-success',
  },
  warning: {
    softCard: 'border-warning/30 bg-warning/5',
    iconWell: 'bg-warning/10 text-warning',
    chip: 'border-warning/35 bg-warning/10 text-warning',
  },
  primary: {
    chip: 'border-primary/25 bg-primary/10 text-primary',
  },
};

function ContextChip({ children, tone = 'muted', className }) {
  const palette = tone === 'muted'
    ? 'border-border/80 bg-muted/60 text-foreground'
    : TONE[tone]?.chip || TONE.primary.chip;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2.5 py-1 text-xs font-medium',
        palette,
        className,
      )}
    >
      {children}
    </span>
  );
}

export default function AttendanceClockIn() {
  const { user, appPublicSettings } = useAuth();
  const queryClient = useQueryClient();
  const canViewAllRecords = canViewAllAttendance(user);

  const [capture, setCapture] = useState(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [lateClockInReason, setLateClockInReason] = useState('');

  const deviceInfo = useMemo(() => getDeviceInfo(), []);

  const { data: status, isLoading: statusLoading } = useAttendanceStatus({
    enabled: true,
  });

  const nextType = status?.next_type || 'clock_in';
  const isClockIn = nextType === 'clock_in';
  const policy = status?.policy;
  const activeSpecialRelease = policy?.active_special_release || null;
  const allowOutsideRadius = isClockIn
    ? Boolean(activeSpecialRelease
      ? activeSpecialRelease.allow_outside_radius
      : policy?.allow_outside_radius)
    : Boolean(policy?.allow_clock_out_outside_radius || activeSpecialRelease?.allow_outside_radius);

  const lateClockIn = useMemo(() => {
    if (!isClockIn || !policy?.require_late_clock_in_reason) {
      return { is_late: false, late_minutes: 0 };
    }
    const at = capture?.capturedAt ? new Date(capture.capturedAt) : new Date();
    return evaluateLateClockIn(policy, at);
  }, [isClockIn, policy, capture?.capturedAt]);

  const needsLateReason = Boolean(
    isClockIn && policy?.require_late_clock_in_reason && lateClockIn.is_late,
  );
  const reasonReady = !needsLateReason || lateClockInReason.trim().length > 0;

  const clockMutation = useMutation({
    mutationFn: async ({ photoCapture, lateReason, requireLateReason }) => {
      if (!photoCapture?.blob) {
        throw new Error('Capture a photo before clocking in or out.');
      }

      const trimmedLate = String(lateReason || '').trim();
      if (requireLateReason && !trimmedLate) {
        throw new Error('Please enter a reason for clocking in late.');
      }

      const upload = await db.integrations.Core.UploadFile({
        file: new File([photoCapture.blob], `attendance-${Date.now()}.jpg`, { type: 'image/jpeg' }),
        folder: 'attendance-photos',
      });

      const payload = {
        type: nextType,
        photo_url: upload.file_url,
        latitude: photoCapture.location?.latitude ?? null,
        longitude: photoCapture.location?.longitude ?? null,
        location_label: photoCapture.location?.locationLabel ?? null,
        browser: deviceInfo.browser,
        browser_version: deviceInfo.browser_version,
        operating_system: deviceInfo.operating_system,
        device_type: deviceInfo.device_type,
        screen_resolution: deviceInfo.screen_resolution,
        timezone: deviceInfo.timezone,
        captured_at: photoCapture.capturedAt,
        metadata: {
          watermark_lines: photoCapture.watermarkLines,
          location_accuracy_meters: photoCapture.location?.accuracy ?? null,
        },
      };

      if (requireLateReason && trimmedLate) {
        payload.late_clock_in_reason = trimmedLate;
      }

      return db.attendance.clock(payload);
    },
    onSuccess: (record) => {
      const recordPolicy = record?.metadata?.policy;
      if (recordPolicy?.is_overtime) {
        toast.success(`Clocked out with ${formatDurationMinutes(recordPolicy.overtime_minutes, { style: 'long' })} overtime`);
      } else if (recordPolicy?.is_late) {
        toast.success(`Clocked in late (+${formatDurationMinutes(recordPolicy.late_minutes, { style: 'long' })})`);
      } else {
        toast.success(isClockIn ? 'Clocked in successfully' : 'Clocked out successfully');
      }
      notifyGamificationOffers(record);
      setCapture(null);
      setLateClockInReason('');
      setCameraKey((key) => key + 1);
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_STATUS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendance-my-history'] });
      if (canViewAllRecords) {
        queryClient.invalidateQueries({ queryKey: ['attendance-dashboard'] });
      }
    },
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to record attendance');
    },
  });

  const handleCapture = useCallback((photoCapture) => {
    setCapture(photoCapture);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!capture?.blob || clockMutation.isPending || !reasonReady) return;
    clockMutation.mutate({
      photoCapture: capture,
      lateReason: lateClockInReason,
      requireLateReason: needsLateReason,
    });
  }, [capture, clockMutation, lateClockInReason, needsLateReason, reasonReady]);

  const submitHint = !reasonReady ? 'Enter a late clock-in reason first' : '';

  const attendanceSites = useMemo(() => {
    const departmentRadius = Number(policy?.radius_meters);
    const departmentSites = resolveAttendanceSites(policy).map((site) => ({
      ...site,
      radius_meters: Number.isFinite(departmentRadius) ? departmentRadius : undefined,
    }));
    if (activeSpecialRelease?.center_latitude != null && activeSpecialRelease?.center_longitude != null) {
      const typeLabel = activeSpecialRelease.type === 'wfh'
        ? 'WFH'
        : activeSpecialRelease.type === 'outstation'
          ? 'Outstation'
          : 'Other';
      return [
        {
          name: `Special release (${typeLabel})`,
          latitude: Number(activeSpecialRelease.center_latitude),
          longitude: Number(activeSpecialRelease.center_longitude),
          radius_meters: Number(activeSpecialRelease.radius_meters) || 100,
        },
        ...departmentSites,
      ];
    }
    return departmentSites;
  }, [policy, activeSpecialRelease]);
  const siteRadiusMeters = [
    Number(activeSpecialRelease?.radius_meters),
    Number(policy?.radius_meters),
  ].reduce((max, value) => (Number.isFinite(value) && value > max ? value : max), 0) || 200;
  const liveLocation = capture?.location;
  const nearestSite = useMemo(() => (
    findNearestAttendanceSite(attendanceSites, liveLocation?.latitude, liveLocation?.longitude)
  ), [attendanceSites, liveLocation?.latitude, liveLocation?.longitude]);
  const matchedSite = useMemo(() => (
    findMatchingAttendanceSite(
      attendanceSites,
      liveLocation?.latitude,
      liveLocation?.longitude,
      siteRadiusMeters,
    )
  ), [attendanceSites, liveLocation?.latitude, liveLocation?.longitude, siteRadiusMeters]);

  const scheduleHint = status?.schedule_hint;
  const activeShift = policy ? findActiveShift(policy) : null;
  const specialReleaseTypeLabel = activeSpecialRelease
    ? (activeSpecialRelease.type === 'wfh'
      ? 'WFH'
      : activeSpecialRelease.type === 'outstation'
        ? 'Outstation'
        : 'Other')
    : null;

  const statusTone = statusLoading ? 'muted' : (isClockIn ? 'info' : 'success');
  const StatusIcon = isClockIn ? LogIn : LogOut;
  const statusTitle = statusLoading
    ? 'Checking status…'
    : isClockIn
      ? 'Ready to clock in'
      : 'You are clocked in';
  const statusSubtitle = statusLoading
    ? 'Loading your shift and last punch.'
    : scheduleHint?.message
      || (isClockIn
        ? 'Take a selfie to start your shift.'
        : 'Take a selfie when you leave.');

  const lastRecord = status?.last_record;
  const todayIns = status?.today_summary?.clock_ins ?? 0;
  const todayOuts = status?.today_summary?.clock_outs ?? 0;
  const showContextChips = Boolean(
    activeShift
    || policy?.planned_shift?.name
    || nearestSite
    || activeSpecialRelease
    || (policy?.shifts?.length && !activeShift)
    || policy?.grace_period_minutes,
  );

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <div className={cn('overflow-hidden rounded-2xl border shadow-sm', TONE[statusTone].softCard)}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                TONE[statusTone].iconWell,
              )}
            >
              {statusLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <StatusIcon className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight">{statusTitle}</p>
              <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{statusSubtitle}</p>
              {!statusLoading ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <ExpActionHint actionKey={isClockIn ? 'clock_in' : 'clock_out'} />
                  {isClockIn ? <ExpActionHint actionKey="clock_in_early" /> : null}
                </div>
              ) : null}
              {lastRecord ? (
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  Last {formatRecordType(lastRecord.type).toLowerCase()} ·{' '}
                  {format(new Date(lastRecord.captured_at), 'MMM d, h:mm a')}
                  {lastRecord.location_label ? ` · ${lastRecord.location_label}` : ''}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[12rem]">
            <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">In</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">{todayIns}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Out</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">{todayOuts}</p>
            </div>
          </div>
        </div>

        {showContextChips ? (
          <div className="flex flex-wrap gap-1.5 border-t border-border/60 bg-background/40 px-4 py-3 sm:px-5">
            {activeShift ? (
              <ContextChip tone="primary">Shift · {activeShift.name}</ContextChip>
            ) : policy?.shifts?.length ? (
              <ContextChip tone="warning">Outside scheduled shift</ContextChip>
            ) : null}
            {policy?.planned_shift?.name ? (
              <ContextChip>Rostered · {policy.planned_shift.name}</ContextChip>
            ) : null}
            {activeSpecialRelease ? (
              <ContextChip tone="info">
                {specialReleaseTypeLabel} · {activeSpecialRelease.radius_meters}m pin
                {activeSpecialRelease.overwrite_shift && activeSpecialRelease.shift_start_time && activeSpecialRelease.shift_end_time
                  ? ` · ${activeSpecialRelease.shift_start_time}–${activeSpecialRelease.shift_end_time}`
                  : ''}
              </ContextChip>
            ) : null}
            {nearestSite ? (
              <ContextChip tone={matchedSite ? 'success' : 'warning'} className="max-w-[18rem]">
                <MapPin className="h-3 w-3 shrink-0 opacity-80" />
                {matchedSite
                  ? `At ${matchedSite.site.name}`
                  : `~${Math.round(nearestSite.distance)}m from ${nearestSite.site.name}`}
              </ContextChip>
            ) : null}
            {allowOutsideRadius && !matchedSite && nearestSite ? (
              <ContextChip>Outside radius allowed</ContextChip>
            ) : null}
            {policy?.grace_period_minutes ? (
              <ContextChip>
                {formatDurationMinutes(policy.grace_period_minutes, { style: 'long' })} grace
              </ContextChip>
            ) : null}
          </div>
        ) : null}
      </div>

      {activeSpecialRelease ? (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-medium">Special release · {specialReleaseTypeLabel}</p>
            <p className="mt-0.5 text-muted-foreground text-pretty">
              Clock within {activeSpecialRelease.radius_meters}m of your approved pin or at your department location
              {allowOutsideRadius ? ' (outstation outside those sites still allowed with a warning)' : ''}.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start">
        <Card className="order-1 min-w-0 overflow-hidden rounded-2xl border-border/80 p-0 shadow-sm">
          <CardContent className="p-0">
            <AttendanceCamera
              key={cameraKey}
              watermarkConfig={appPublicSettings}
              userName={user?.full_name || user?.name || user?.email}
              deviceInfo={deviceInfo}
              attendanceSites={attendanceSites}
              siteRadiusMeters={siteRadiusMeters}
              requirePreciseLocation={Boolean(policy?.geofence_enabled)}
              actionType={nextType}
              submitting={clockMutation.isPending}
              canSubmit={Boolean(capture?.blob) && reasonReady}
              submitHint={submitHint}
              disabled={clockMutation.isPending || statusLoading}
              onCapture={handleCapture}
              onSubmit={handleSubmit}
            />
          </CardContent>
        </Card>

        <div className="order-2 min-w-0 space-y-3">
          {needsLateReason ? (
            <Card className="min-w-0 overflow-hidden rounded-2xl border-warning/30 bg-warning/5">
              <CardHeader className="space-y-1 p-4 pb-3 sm:p-5 sm:pb-3">
                <CardTitle className="text-base">Late clock-in reason</CardTitle>
                <CardDescription className="text-pretty">
                  You are clocking in
                  {lateClockIn.late_minutes
                    ? ` ${formatDurationMinutes(lateClockIn.late_minutes, { style: 'long' })} late`
                    : ' late'}
                  . A reason is required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
                <Label htmlFor="late-clock-in-reason">Reason</Label>
                <Textarea
                  id="late-clock-in-reason"
                  value={lateClockInReason}
                  onChange={(event) => setLateClockInReason(event.target.value)}
                  placeholder="Why are you clocking in late?"
                  maxLength={500}
                  rows={3}
                  disabled={clockMutation.isPending}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl border-border/80 shadow-sm">
              <CardHeader className="space-y-1 p-4 pb-3 sm:p-5 sm:pb-3">
                <CardTitle className="text-base">Before you punch</CardTitle>
                <CardDescription className="text-pretty">
                  Face the camera, wait for GPS, then capture. Your photo is stamped with time and location.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0 text-sm text-muted-foreground sm:p-5 sm:pt-0">
                {policy?.geofence_enabled ? (
                  <p>
                    Stay within {siteRadiusMeters}m of your assigned site
                    {allowOutsideRadius ? ', or clock outside with a warning' : ''}.
                  </p>
                ) : null}
                {policy?.require_late_clock_in_reason ? (
                  <p>Late clock-in needs a reason.</p>
                ) : null}
                {policy?.require_early_clock_out_reason ? (
                  <p>Early clock-out needs a reason.</p>
                ) : null}
                <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
                  <Link to="/attendance/records">View today’s punches</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
