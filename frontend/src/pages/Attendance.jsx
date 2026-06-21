// @ts-nocheck
import db from '@/api/base44Client';
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
  Clock, LogIn, LogOut, MapPin, Camera, History, Loader2, FileDown, Filter, ChevronDown, Shield,
} from 'lucide-react';
import AttendanceCamera from '@/components/attendance/AttendanceCamera';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAttendanceStatus, ATTENDANCE_STATUS_QUERY_KEY } from '@/hooks/useAttendanceReminder';
import { useAuth } from '@/lib/AuthContext';
import { describeAttendancePolicy, findActiveShift, haversineMeters } from '@/lib/attendancePolicy';
import { getDeviceInfo } from '@/lib/deviceInfo';
import { normalizeAttendanceWatermarkConfig } from '@/lib/watermarkConfig';
import { toAbsoluteUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function formatRecordType(type) {
  return type === 'clock_in' ? 'Clock In' : 'Clock Out';
}

export default function Attendance() {
  const { user, appPublicSettings } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [capture, setCapture] = useState(null);

  const attendanceConfig = useMemo(
    () => normalizeAttendanceWatermarkConfig(appPublicSettings),
    [appPublicSettings],
  );

  const deviceInfo = useMemo(() => getDeviceInfo(), []);

  const { data: status, isLoading: statusLoading } = useAttendanceStatus({
    enabled: attendanceConfig.enabled,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['attendance-my-history'],
    queryFn: () => db.attendance.myHistory({ limit: 20 }),
    enabled: Boolean(user) && attendanceConfig.enabled,
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
        toast.success(`Clocked out with ${policy.overtime_minutes} min overtime`);
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
  const distanceMeters = useMemo(() => {
    if (!policy?.geofence_enabled || !capture?.location?.latitude || !capture?.location?.longitude) {
      return null;
    }
    if (policy.center_latitude == null || policy.center_longitude == null) {
      return null;
    }
    return haversineMeters(
      Number(policy.center_latitude),
      Number(policy.center_longitude),
      capture.location.latitude,
      capture.location.longitude,
    );
  }, [policy, capture]);

  if (!attendanceConfig.enabled) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" /> Attendance unavailable
          </CardTitle>
          <CardDescription>Clock in/out has been disabled by an administrator.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const nextType = status?.next_type || 'clock_in';
  const isClockIn = nextType === 'clock_in';
  const ActionIcon = isClockIn ? LogIn : LogOut;
  const reminder = status?.reminder;
  const scheduleHint = status?.schedule_hint;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" /> Clock In / Out
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Take a watermarked photo to record your attendance with date, time, and location.
        </p>
      </div>

      {!reminder && scheduleHint ? (
        <Card className="rounded-2xl border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Shift schedule
            </CardTitle>
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
            {distanceMeters != null ? (
              <Badge variant={distanceMeters <= policy.radius_meters ? 'secondary' : 'destructive'}>
                {Math.round(distanceMeters)}m from site
              </Badge>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
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
                  <div className="mt-1 text-2xl font-semibold">{status?.today_summary?.clock_ins ?? 0}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-muted-foreground">Today clock-outs</div>
                  <div className="mt-1 text-2xl font-semibold">{status?.today_summary?.clock_outs ?? 0}</div>
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

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Recent records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history?.records?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Photo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Badge variant={record.type === 'clock_in' ? 'default' : 'secondary'}>
                        {formatRecordType(record.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(record.captured_at), 'MMM d, yyyy h:mm a')}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {record.location_label || '—'}
                    </TableCell>
                    <TableCell>
                      <a
                        href={toAbsoluteUrl(record.photo_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No attendance history yet.</p>
          )}
        </CardContent>
      </Card>
      {isAdmin ? <AttendanceAdminReport /> : null}
    </div>
  );
}

function AttendanceAdminReport() {
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [userId, setUserId] = useState('');
  const [type, setType] = useState('');

  useEffect(() => {
    if (isMobile) {
      setFiltersOpen(false);
    }
  }, [isMobile]);

  const filters = useMemo(() => ({
    date_from: dateFrom,
    date_to: dateTo,
    limit: 500,
    ...(userId ? { user_id: userId } : {}),
    ...(type ? { type } : {}),
  }), [dateFrom, dateTo, userId, type]);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-dashboard', filters],
    queryFn: () => db.attendance.dashboard(filters),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-attendance-admin'],
    queryFn: () => db.entities.User.list('-created_date', 500),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await db.attendance.exportCsv({
        date_from: dateFrom,
        date_to: dateTo,
        ...(userId ? { user_id: userId } : {}),
        ...(type ? { type } : {}),
      });
      toast.success('Attendance export downloaded');
    } catch {
      toast.error('Failed to export attendance CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileDown className="h-4 w-4 text-primary" />
            All attendance records
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Filter and export clock in/out activity across the organization.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting} className="gap-2 shrink-0">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Export CSV
        </Button>
      </div>

      <Collapsible
        open={isMobile ? filtersOpen : true}
        onOpenChange={(open) => {
          if (isMobile) setFiltersOpen(open);
        }}
      >
        <Card className="rounded-2xl">
          <CollapsibleTrigger asChild disabled={!isMobile}>
            <CardHeader className={cn('pb-3', isMobile && 'cursor-pointer select-none')}>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4" />
                Filters
                {isMobile ? (
                  <ChevronDown
                    className={cn(
                      'ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200',
                      filtersOpen && 'rotate-180',
                    )}
                  />
                ) : null}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Date from</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Date to</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">User</label>
                  <Select value={userId || 'all'} onValueChange={(value) => setUserId(value === 'all' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {users.map((entry) => (
                        <SelectItem key={entry.id} value={String(entry.id)}>
                          {entry.full_name || entry.name || entry.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Type</label>
                  <Select value={type || 'all'} onValueChange={(value) => setType(value === 'all' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="clock_in">Clock In</SelectItem>
                      <SelectItem value="clock_out">Clock Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Summary</CardTitle>
          <CardDescription>
            Showing up to 500 records in the table. Export CSV includes all matching records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-muted-foreground">Total</div>
                  <div className="mt-1 text-2xl font-semibold">{data?.summary?.total ?? 0}</div>
                </div>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-muted-foreground">Clock-ins</div>
                  <div className="mt-1 text-2xl font-semibold">{data?.summary?.clock_ins ?? 0}</div>
                </div>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-muted-foreground">Clock-outs</div>
                  <div className="mt-1 text-2xl font-semibold">{data?.summary?.clock_outs ?? 0}</div>
                </div>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-muted-foreground">Users</div>
                  <div className="mt-1 text-2xl font-semibold">{data?.summary?.unique_users ?? 0}</div>
                </div>
              </div>

              {data?.records?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Coordinates</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Photo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {record.user?.full_name || record.user?.name || record.user?.email || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.type === 'clock_in' ? 'default' : 'secondary'}>
                            {formatRecordType(record.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(record.captured_at), 'MMM d, yyyy h:mm a')}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">
                          {record.location_label || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {record.latitude != null && record.longitude != null
                            ? `${record.latitude}, ${record.longitude}`
                            : '—'}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                          {[record.browser, record.operating_system].filter(Boolean).join(' · ') || '—'}
                        </TableCell>
                        <TableCell>
                          {record.metadata?.policy?.is_overtime ? (
                            <Badge variant="destructive">{record.metadata.policy.overtime_minutes}m</Badge>
                          ) : record.metadata?.policy?.shift_name ? (
                            <Badge variant="secondary">{record.metadata.policy.shift_name}</Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <a
                            href={toAbsoluteUrl(record.photo_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            View
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No attendance records match the selected filters.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
