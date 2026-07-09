// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
  ChevronDown, FileDown, Filter, History, Loader2, LogIn, LogOut, MapPin, Monitor, Timer, Users,
} from 'lucide-react';
import AttendancePhotoViewer from '@/components/attendance/AttendancePhotoViewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UserSearchCombobox from '@/components/users/UserSearchCombobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/lib/AuthContext';
import { canManageAttendance } from '@/lib/roles';
import { formatDurationMinutes } from '@/lib/formatDuration';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ADMIN_PAGE_SIZE = 50;
const TABLE_HEAD_CLASS = 'h-11 whitespace-nowrap bg-muted/40 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground';
const TABLE_CELL_CLASS = 'whitespace-nowrap align-middle px-3 py-3';

function formatRecordType(type) {
  return type === 'clock_in' ? 'Clock In' : 'Clock Out';
}

function formatCoordinates(latitude, longitude) {
  if (latitude == null || longitude == null) {
    return '—';
  }

  return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
}

function OvertimeBadge({ policy, className }) {
  if (!policy?.is_overtime) {
    if (policy?.shift_name) {
      return (
        <span className={cn('inline-flex rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground', className)}>
          {policy.shift_name}
        </span>
      );
    }
    return <span className="text-muted-foreground">—</span>;
  }

  const overtime = formatDurationMinutes(policy.overtime_minutes);
  const worked = policy.worked_minutes != null
    ? formatDurationMinutes(policy.worked_minutes)
    : null;

  return (
    <span
      className={cn(
        'inline-flex flex-nowrap items-center gap-1.5 whitespace-nowrap rounded-md bg-warning/10 px-2 py-1 text-xs',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 font-medium text-warning">
        <Timer className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        {overtime} OT
      </span>
      {worked ? (
        <>
          <span className="text-muted-foreground/40" aria-hidden>·</span>
          <span className="tabular-nums text-muted-foreground">{worked} worked</span>
        </>
      ) : null}
    </span>
  );
}

function AttendanceTableShell({ children, className }) {
  return (
    <div
      className={cn(
        'hidden overflow-hidden rounded-xl border border-border md:block',
        '[&>div]:max-h-[min(32rem,70vh)] [&>div]:overflow-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}

function SummaryStatCard({ label, value, icon: Icon, tone = 'muted' }) {
  const tones = {
    muted: 'bg-muted/50 text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function AttendanceUserCell({ record }) {
  const name = record.user?.full_name || record.user?.name;
  const email = record.user?.email;

  return (
    <div className="min-w-0 max-w-[200px] lg:max-w-[240px]">
      <p className="truncate text-sm font-medium leading-tight">{name || email || '—'}</p>
      {name && email ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
      ) : null}
    </div>
  );
}

function LocationCell({ label }) {
  if (!label) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="inline-flex max-w-[220px] items-center gap-1.5 text-sm text-muted-foreground lg:max-w-[280px]">
      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

function DeviceCell({ browser, operatingSystem }) {
  const label = [browser, operatingSystem].filter(Boolean).join(' · ');

  if (!label) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="inline-flex max-w-[180px] items-center gap-1.5 text-xs text-muted-foreground xl:max-w-[220px]">
      <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

function RecordTypeBadge({ type }) {
  const isClockIn = type === 'clock_in';

  return (
    <Badge
      variant={isClockIn ? 'default' : 'secondary'}
      className={cn('gap-1 font-medium', isClockIn ? '' : 'bg-muted text-foreground')}
    >
      {isClockIn ? <LogIn className="h-3 w-3" aria-hidden /> : <LogOut className="h-3 w-3" aria-hidden />}
      {formatRecordType(type)}
    </Badge>
  );
}

function MyAttendanceTable({ records }) {
  return (
    <AttendanceTableShell>
      <Table className="w-full">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(TABLE_HEAD_CLASS, 'pl-4')}>Type</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Time</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Location</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Overtime</TableHead>
            <TableHead className={cn(TABLE_HEAD_CLASS, 'w-14 pr-4 text-right')}>Photo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id} className="hover:bg-muted/30">
              <TableCell className={cn(TABLE_CELL_CLASS, 'pl-4')}>
                <RecordTypeBadge type={record.type} />
              </TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'tabular-nums text-sm')}>
                <div>{format(new Date(record.captured_at), 'MMM d, yyyy')}</div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(record.captured_at), 'h:mm a')}
                </div>
              </TableCell>
              <TableCell className={TABLE_CELL_CLASS}>
                <LocationCell label={record.location_label} />
              </TableCell>
              <TableCell className={TABLE_CELL_CLASS}>
                <OvertimeBadge policy={record.metadata?.policy} />
              </TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'pr-4 text-right')}>
                <AttendancePhotoViewer record={record} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AttendanceTableShell>
  );
}

function AdminAttendanceTable({ records }) {
  return (
    <AttendanceTableShell>
      <Table className="w-full">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(TABLE_HEAD_CLASS, 'pl-4')}>User</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Type</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Time</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Location</TableHead>
            <TableHead className={cn(TABLE_HEAD_CLASS, 'hidden lg:table-cell')}>Coordinates</TableHead>
            <TableHead className={cn(TABLE_HEAD_CLASS, 'hidden xl:table-cell')}>Device</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Overtime</TableHead>
            <TableHead className={cn(TABLE_HEAD_CLASS, 'w-14 pr-4 text-right')}>Photo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id} className="hover:bg-muted/30">
              <TableCell className={cn(TABLE_CELL_CLASS, 'pl-4')}>
                <AttendanceUserCell record={record} />
              </TableCell>
              <TableCell className={TABLE_CELL_CLASS}>
                <RecordTypeBadge type={record.type} />
              </TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'tabular-nums text-sm')}>
                <div>{format(new Date(record.captured_at), 'MMM d, yyyy')}</div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(record.captured_at), 'h:mm a')}
                </div>
              </TableCell>
              <TableCell className={TABLE_CELL_CLASS}>
                <LocationCell label={record.location_label} />
              </TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'hidden text-xs text-muted-foreground tabular-nums lg:table-cell')}>
                {formatCoordinates(record.latitude, record.longitude)}
              </TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'hidden xl:table-cell')}>
                <DeviceCell browser={record.browser} operatingSystem={record.operating_system} />
              </TableCell>
              <TableCell className={TABLE_CELL_CLASS}>
                <OvertimeBadge policy={record.metadata?.policy} />
              </TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'pr-4 text-right')}>
                <AttendancePhotoViewer record={record} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AttendanceTableShell>
  );
}

function MobileDetailRow({ label, children, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 text-xs', className)}>
      <span className="shrink-0 pt-0.5 text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  );
}

function AttendanceRecordCard({ record, showUser = false }) {
  const policy = record.metadata?.policy;
  const deviceLabel = [record.browser, record.operating_system].filter(Boolean).join(' · ');
  const capturedAt = format(new Date(record.captured_at), 'MMM d, yyyy · h:mm a');
  const coordinates = formatCoordinates(record.latitude, record.longitude);
  const hasOvertimeInfo = policy?.is_overtime || policy?.shift_name;

  return (
    <article className="px-1 py-3.5 sm:px-0">
      {showUser ? (
        <p className="mb-2 truncate text-sm font-medium leading-tight">
          {record.user?.full_name || record.user?.name || record.user?.email || '—'}
        </p>
      ) : null}

      <div className="flex items-center gap-2.5">
        <Badge
          variant={record.type === 'clock_in' ? 'default' : 'secondary'}
          className="shrink-0"
        >
          {formatRecordType(record.type)}
        </Badge>
        <time className="min-w-0 flex-1 truncate text-xs text-muted-foreground tabular-nums">
          {capturedAt}
        </time>
        <AttendancePhotoViewer
          record={record}
          buttonClassName="h-9 w-9 touch-manipulation"
        />
      </div>

      {record.location_label ? (
        <p className="mt-2.5 flex items-start gap-1.5 text-sm leading-snug text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
          <span>{record.location_label}</span>
        </p>
      ) : null}

      {(hasOvertimeInfo || deviceLabel || (showUser && coordinates !== '—')) ? (
        <div className="mt-2.5 space-y-1.5 rounded-lg bg-muted/30 px-3 py-2.5">
          {hasOvertimeInfo ? (
            <MobileDetailRow label="Overtime">
              <OvertimeBadge policy={policy} />
            </MobileDetailRow>
          ) : null}
          {showUser && deviceLabel ? (
            <MobileDetailRow label="Device">
              <span className="inline-flex items-center justify-end gap-1 text-foreground">
                <Monitor className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                {deviceLabel}
              </span>
            </MobileDetailRow>
          ) : null}
          {showUser && coordinates !== '—' ? (
            <MobileDetailRow label="Coords">
              <span className="tabular-nums text-muted-foreground">{coordinates}</span>
            </MobileDetailRow>
          ) : null}
          {!showUser && deviceLabel ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Monitor className="h-3 w-3 shrink-0" aria-hidden />
              {deviceLabel}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function AttendanceRecordMobileList({ records, showUser = false }) {
  if (!records?.length) {
    return null;
  }

  return (
    <div className="divide-y divide-border md:hidden">
      {records.map((record) => (
        <AttendanceRecordCard key={record.id} record={record} showUser={showUser} />
      ))}
    </div>
  );
}

function MyAttendanceHistory() {
  const { user } = useAuth();

  const { data: history, isLoading } = useQuery({
    queryKey: ['attendance-my-history'],
    queryFn: () => db.attendance.myHistory({ limit: 20 }),
    enabled: Boolean(user),
  });

  return (
    <Card className="w-full rounded-2xl border-border/70">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-4 pb-3 sm:p-6 sm:pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" /> My recent records
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Your latest clock in and clock out entries.
          </CardDescription>
        </div>
        {!isLoading && history?.records?.length ? (
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {history.records.length} entries
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history?.records?.length ? (
          <>
            <AttendanceRecordMobileList records={history.records} />
            <MyAttendanceTable records={history.records} />
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No attendance history yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AttendanceAdminReport() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const canViewAllRecords = canManageAttendance(user);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [userId, setUserId] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (isMobile) {
      setFiltersOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    setPage(0);
  }, [dateFrom, dateTo, userId, type]);

  const filters = useMemo(() => ({
    date_from: dateFrom,
    date_to: dateTo,
    limit: ADMIN_PAGE_SIZE,
    offset: page * ADMIN_PAGE_SIZE,
    ...(userId ? { user_id: userId } : {}),
    ...(type ? { type } : {}),
  }), [dateFrom, dateTo, userId, type, page]);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-dashboard', filters],
    queryFn: () => db.attendance.dashboard(filters),
    enabled: canViewAllRecords,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-attendance-admin'],
    queryFn: () => db.entities.User.list('-created_date', 200),
    enabled: canViewAllRecords,
    staleTime: 120_000,
  });

  const totalRecords = data?.summary?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / ADMIN_PAGE_SIZE));
  const pageStart = totalRecords === 0 ? 0 : page * ADMIN_PAGE_SIZE + 1;
  const pageEnd = Math.min(totalRecords, (page + 1) * ADMIN_PAGE_SIZE);
  const activeFilterCount = [userId, type].filter(Boolean).length;

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

  if (!canViewAllRecords) {
    return null;
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
            <FileDown className="h-4 w-4 shrink-0 text-primary" />
            All attendance records
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Filter and export clock in/out activity across the organization.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting}
          className="h-10 w-full shrink-0 gap-2 touch-manipulation sm:w-auto lg:h-9"
        >
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
        <Card className="w-full rounded-2xl border-border/70">
          <CollapsibleTrigger asChild disabled={!isMobile}>
            <CardHeader
              className={cn(
                'flex flex-row items-center justify-between space-y-0 p-4 pb-3 sm:p-6 sm:pb-4',
                isMobile && 'cursor-pointer select-none touch-manipulation',
              )}
            >
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4 shrink-0" />
                Filters
                {activeFilterCount > 0 ? (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1.5 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                ) : null}
              </CardTitle>
              {isMobile ? (
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform duration-200',
                    filtersOpen && 'rotate-180',
                  )}
                />
              ) : (
                <p className="hidden text-xs text-muted-foreground md:block">
                  {format(new Date(`${dateFrom}T00:00:00`), 'MMM d, yyyy')}
                  {' – '}
                  {format(new Date(`${dateTo}T00:00:00`), 'MMM d, yyyy')}
                </p>
              )}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3 border-t border-border/60 p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                  <UserSearchCombobox
                    users={users}
                    value={userId}
                    onValueChange={setUserId}
                    placeholder="All users"
                  />
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

      <Card className="w-full rounded-2xl border-border/70">
        <CardHeader className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="space-y-1">
            <CardTitle className="text-base">Summary</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {totalRecords > 0 ? (
                <>
                  <span className="sm:hidden">
                    {pageStart}–{pageEnd} of {totalRecords} records
                  </span>
                  <span className="hidden sm:inline">
                    Showing {pageStart}–{pageEnd} of {totalRecords} matching records. Export CSV includes all matches.
                  </span>
                </>
              ) : (
                'Filter and review clock in/out activity across the organization.'
              )}
            </CardDescription>
          </div>
          {totalPages > 1 ? (
            <p className="hidden shrink-0 text-sm text-muted-foreground md:block">
              Page {page + 1} of {totalPages}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
                <SummaryStatCard
                  label="Total records"
                  value={data?.summary?.total ?? 0}
                  icon={History}
                  tone="muted"
                />
                <SummaryStatCard
                  label="Clock-ins"
                  value={data?.summary?.clock_ins ?? 0}
                  icon={LogIn}
                  tone="primary"
                />
                <SummaryStatCard
                  label="Clock-outs"
                  value={data?.summary?.clock_outs ?? 0}
                  icon={LogOut}
                  tone="success"
                />
                <SummaryStatCard
                  label="Unique users"
                  value={data?.summary?.unique_users ?? 0}
                  icon={Users}
                  tone="warning"
                />
              </div>

              {data?.records?.length ? (
                <>
                  <AttendanceRecordMobileList records={data.records} showUser />
                  <AdminAttendanceTable records={data.records} />
                  {totalPages > 1 ? (
                    <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-center text-xs text-muted-foreground sm:text-left sm:text-sm md:hidden">
                        Page {page + 1} of {totalPages}
                      </p>
                      <p className="hidden flex-1 text-sm text-muted-foreground md:block">
                        Showing {pageStart}–{pageEnd} of {totalRecords}
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={page === 0}
                          className="h-10 touch-manipulation sm:h-9"
                          onClick={() => setPage((current) => Math.max(0, current - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages - 1}
                          className="h-10 touch-manipulation sm:h-9"
                          onClick={() => setPage((current) => current + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
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

export default function AttendanceRecords() {
  return (
    <div className="w-full space-y-4 lg:space-y-6">
      <MyAttendanceHistory />
      <AttendanceAdminReport />
    </div>
  );
}
