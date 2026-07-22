// @ts-nocheck
import db from '@/api/apiClient';
import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MapPin, Shield } from 'lucide-react';
import AttendanceCamera from '@/components/attendance/AttendanceCamera';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAttendanceStatus, ATTENDANCE_STATUS_QUERY_KEY } from '@/hooks/useAttendanceReminder';
import { useAuth } from '@/lib/AuthContext';
import { canManageAttendance } from '@/lib/roles';
import {
  describeAttendancePolicy,
  findActiveShift,
  findMatchingAttendanceSite,
  findNearestAttendanceSite,
  resolveAttendanceSites,
} from '@/lib/attendancePolicy';
import { getDeviceInfo } from '@/lib/deviceInfo';
import { formatDurationMinutes } from '@/lib/formatDuration';
import { toast } from 'sonner';

function formatRecordType(type) {
  return type === 'clock_in' ? 'Clock In' : 'Clock Out';
}

export default function AttendanceClockIn() {
  const { user, appPublicSettings } = useAuth();
  const queryClient = useQueryClient();
  const canViewAllRecords = canManageAttendance(user);

  const [capture, setCapture] = useState(null);
  const [cameraKey, setCameraKey] = useState(0);

  const deviceInfo = useMemo(() => getDeviceInfo(), []);

  const { data: status, isLoading: statusLoading } = useAttendanceStatus({
    enabled: true,
  });

  const nextType = status?.next_type || 'clock_in';
  const isClockIn = nextType === 'clock_in';

  const clockMutation = useMutation({
    mutationFn: async (photoCapture) => {
      if (!photoCapture?.blob) {
        throw new Error('Capture a photo before clocking in or out.');
      }

      const upload = await db.integrations.Core.UploadFile({
        file: new File([photoCapture.blob], `attendance-${Date.now()}.jpg`, { type: 'image/jpeg' }),
        folder: 'attendance-photos',
      });

      return db.attendance.clock({
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
        },
      });
    },
    onSuccess: (record) => {
      const policy = record?.metadata?.policy;
      if (policy?.is_overtime) {
        toast.success(`Clocked out with ${formatDurationMinutes(policy.overtime_minutes, { style: 'long' })} overtime`);
      } else {
        toast.success(isClockIn ? 'Clocked in successfully' : 'Clocked out successfully');
      }
      setCapture(null);
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
    if (!capture?.blob || clockMutation.isPending) return;
    clockMutation.mutate(capture);
  }, [capture, clockMutation]);

  const policy = status?.policy;
  const activeShift = policy ? findActiveShift(policy) : null;
  const attendanceSites = useMemo(() => resolveAttendanceSites(policy), [policy]);
  const liveLocation = capture?.location;
  const nearestSite = useMemo(() => (
    findNearestAttendanceSite(attendanceSites, liveLocation?.latitude, liveLocation?.longitude)
  ), [attendanceSites, liveLocation?.latitude, liveLocation?.longitude]);
  const matchedSite = useMemo(() => (
    findMatchingAttendanceSite(
      attendanceSites,
      liveLocation?.latitude,
      liveLocation?.longitude,
      policy?.radius_meters ?? 200,
    )
  ), [attendanceSites, liveLocation?.latitude, liveLocation?.longitude, policy?.radius_meters]);

  const scheduleHint = status?.schedule_hint;

  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-x-hidden sm:space-y-4">
      {!status?.reminder && scheduleHint ? (
        <Card className="min-w-0 rounded-2xl border-dashed">
          <CardHeader className="space-y-1 p-4 pb-3 sm:p-6 sm:pb-3">
            <CardTitle className="text-base">Shift schedule</CardTitle>
            <CardDescription className="text-pretty">{scheduleHint.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {policy ? (
        <Card className="min-w-0 rounded-2xl border-primary/20 bg-primary/5">
          <CardHeader className="space-y-1 p-4 pb-3 sm:p-6 sm:pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 shrink-0 text-primary" /> Department rules
            </CardTitle>
            <CardDescription className="text-pretty">{describeAttendancePolicy(policy)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 p-4 pt-0 text-sm sm:p-6 sm:pt-0">
            {activeShift ? (
              <Badge variant="secondary">Active shift: {activeShift.name}</Badge>
            ) : policy.shifts?.length ? (
              <Badge variant="outline">Outside scheduled shift</Badge>
            ) : null}
            {nearestSite ? (
              <Badge variant={matchedSite ? 'secondary' : 'destructive'} className="max-w-full truncate">
                {matchedSite
                  ? `At ${matchedSite.site.name}`
                  : `~${Math.round(nearestSite.distance)}m from ${nearestSite.site.name}`}
              </Badge>
            ) : null}
            {policy?.allow_outside_radius && !matchedSite && nearestSite ? (
              <Badge variant="outline">Outstation allowed</Badge>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="min-w-0 overflow-hidden rounded-2xl p-0">
          <CardContent className="p-0">
            <AttendanceCamera
              key={cameraKey}
              watermarkConfig={appPublicSettings}
              userName={user?.full_name || user?.name || user?.email}
              deviceInfo={deviceInfo}
              attendanceSites={attendanceSites}
              siteRadiusMeters={policy?.radius_meters ?? 200}
              actionType={nextType}
              submitting={clockMutation.isPending}
              canSubmit={Boolean(capture?.blob)}
              disabled={clockMutation.isPending || statusLoading}
              onCapture={handleCapture}
              onSubmit={handleSubmit}
            />
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-3 sm:space-y-4">
          <Card className="min-w-0 overflow-hidden rounded-2xl">
            <CardHeader className="space-y-1 p-4 pb-3 sm:p-6 sm:pb-3">
              <CardTitle className="text-base">Current status</CardTitle>
              <CardDescription className="text-pretty">
                {statusLoading
                  ? 'Loading status…'
                  : isClockIn
                    ? 'You are ready to clock in.'
                    : 'You are clocked in.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
              {status?.last_record ? (
                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{formatRecordType(status.last_record.type)}</span>
                    <Badge variant="secondary" className="shrink-0">
                      {format(new Date(status.last_record.captured_at), 'MMM d, h:mm a')}
                    </Badge>
                  </div>
                  {status.last_record.location_label ? (
                    <p className="mt-2 flex items-start gap-1.5 text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 break-words">{status.last_record.location_label}</span>
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No attendance records yet.</p>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm sm:gap-3">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground sm:text-sm">Today clock-ins</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{status?.today_summary?.clock_ins ?? 0}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground sm:text-sm">Today clock-outs</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{status?.today_summary?.clock_outs ?? 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {capture?.watermarkLines?.length ? (
            <Card className="hidden min-w-0 overflow-hidden rounded-2xl sm:block">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Watermark preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 overflow-x-auto rounded-xl border bg-muted/20 p-3 font-mono text-xs">
                  {capture.watermarkLines.map((line) => (
                    <div key={line} className="whitespace-nowrap sm:whitespace-normal sm:break-words">{line}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
