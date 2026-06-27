// @ts-nocheck
import db from '@/api/base44Client';
import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { LogIn, LogOut, MapPin, Camera, Loader2, Shield } from 'lucide-react';
import AttendanceCamera from '@/components/attendance/AttendanceCamera';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAttendanceStatus, ATTENDANCE_STATUS_QUERY_KEY } from '@/hooks/useAttendanceReminder';
import { useAuth } from '@/lib/AuthContext';
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
  const isAdmin = user?.role === 'admin';

  const [capture, setCapture] = useState(null);

  const deviceInfo = useMemo(() => getDeviceInfo(), []);

  const { data: status, isLoading: statusLoading } = useAttendanceStatus({
    enabled: true,
  });

  const clockMutation = useMutation({
    mutationFn: async () => {
      if (!capture?.blob) {
        throw new Error('Capture a photo before clocking in or out.');
      }

      const upload = await db.integrations.Core.UploadFile({
        file: new File([capture.blob], `attendance-${Date.now()}.jpg`, { type: 'image/jpeg' }),
        folder: 'attendance-photos',
      });

      return db.attendance.clock({
        type: status?.next_type,
        photo_url: upload.file_url,
        latitude: capture.location?.latitude ?? null,
        longitude: capture.location?.longitude ?? null,
        location_label: capture.location?.locationLabel ?? null,
        browser: deviceInfo.browser,
        browser_version: deviceInfo.browser_version,
        operating_system: deviceInfo.operating_system,
        device_type: deviceInfo.device_type,
        screen_resolution: deviceInfo.screen_resolution,
        timezone: deviceInfo.timezone,
        captured_at: capture.capturedAt,
        metadata: {
          watermark_lines: capture.watermarkLines,
        },
      });
    },
    onSuccess: (record) => {
      const policy = record?.metadata?.policy;
      if (policy?.is_overtime) {
        toast.success(`Clocked out with ${formatDurationMinutes(policy.overtime_minutes, { style: 'long' })} overtime`);
      } else {
        toast.success(status?.next_type === 'clock_in' ? 'Clocked in successfully' : 'Clocked out successfully');
      }
      setCapture(null);
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_STATUS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendance-my-history'] });
      if (isAdmin) {
        queryClient.invalidateQueries({ queryKey: ['attendance-dashboard'] });
      }
    },
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to record attendance');
    },
  });

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

  const nextType = status?.next_type || 'clock_in';
  const isClockIn = nextType === 'clock_in';
  const ActionIcon = isClockIn ? LogIn : LogOut;
  const scheduleHint = status?.schedule_hint;

  return (
    <div className="space-y-4">
      {!status?.reminder && scheduleHint ? (
        <Card className="rounded-2xl border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Shift schedule</CardTitle>
            <CardDescription>{scheduleHint.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {policy ? (
        <Card className="rounded-2xl border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Department rules
            </CardTitle>
            <CardDescription>{describeAttendancePolicy(policy)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            {activeShift ? (
              <Badge variant="secondary">Active shift: {activeShift.name}</Badge>
            ) : policy.shifts?.length ? (
              <Badge variant="outline">Outside scheduled shift</Badge>
            ) : null}
            {nearestSite ? (
              <Badge variant={matchedSite ? 'secondary' : 'destructive'}>
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" /> Camera capture
            </CardTitle>
            <CardDescription>
              Watermark is shown live on the camera and burned into the saved photo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceCamera
              watermarkConfig={appPublicSettings}
              userName={user?.full_name || user?.name || user?.email}
              deviceInfo={deviceInfo}
              attendanceSites={attendanceSites}
              siteRadiusMeters={policy?.radius_meters ?? 200}
              disabled={clockMutation.isPending}
              onCapture={setCapture}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current status</CardTitle>
              <CardDescription>
                {statusLoading ? 'Loading status…' : isClockIn ? 'You are ready to clock in.' : 'You are clocked in.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status?.last_record ? (
                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{formatRecordType(status.last_record.type)}</span>
                    <Badge variant="secondary">
                      {format(new Date(status.last_record.captured_at), 'MMM d, h:mm a')}
                    </Badge>
                  </div>
                  {status.last_record.location_label ? (
                    <p className="mt-2 flex items-start gap-1.5 text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {status.last_record.location_label}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No attendance records yet.</p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border p-3">
                  <div className="text-muted-foreground">Today clock-ins</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{status?.today_summary?.clock_ins ?? 0}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-muted-foreground">Today clock-outs</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{status?.today_summary?.clock_outs ?? 0}</div>
                </div>
              </div>

              <Button
                className="w-full gap-2"
                size="lg"
                disabled={!capture || clockMutation.isPending || statusLoading}
                onClick={() => clockMutation.mutate()}
              >
                {clockMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ActionIcon className="h-4 w-4" />
                )}
                {clockMutation.isPending
                  ? 'Submitting…'
                  : isClockIn
                    ? 'Clock In'
                    : 'Clock Out'}
              </Button>

              {!capture ? (
                <p className="text-center text-xs text-muted-foreground">
                  Capture a photo first, then tap {isClockIn ? 'Clock In' : 'Clock Out'}.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {capture?.watermarkLines?.length ? (
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Watermark preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 rounded-xl border bg-muted/20 p-3 font-mono text-xs">
                  {capture.watermarkLines.map((line) => (
                    <div key={line}>{line}</div>
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
