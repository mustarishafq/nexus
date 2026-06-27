// @ts-nocheck
import db from '@/api/base44Client';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
  FileDown, Filter, ChevronDown, History, Loader2, MapPin,
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
import { formatDurationMinutes } from '@/lib/formatDuration';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ADMIN_PAGE_SIZE = 50;

function formatRecordType(type) {
  return type === 'clock_in' ? 'Clock In' : 'Clock Out';
}

function formatCoordinates(latitude, longitude) {
  if (latitude == null || longitude == null) {
    return '—';
  }

  return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
}

function OvertimeBadge({ policy }) {
  if (!policy?.is_overtime) {
    if (policy?.shift_name) {
      return <Badge variant="secondary">{policy.shift_name}</Badge>;
    }
    return '—';
  }

  const overtime = formatDurationMinutes(policy.overtime_minutes);
  const worked = policy.worked_minutes != null
    ? formatDurationMinutes(policy.worked_minutes)
    : null;

  return (
    <div className="flex flex-col gap-1">
      <Badge variant="destructive">{overtime} OT</Badge>
      {worked ? (
        <span className="text-xs text-muted-foreground">{worked} worked</span>
      ) : null}
    </div>
  );
}

function AttendanceRecordCard({ record, showUser = false }) {
  const policy = record.metadata?.policy;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {showUser ? (
            <p className="font-medium truncate">
              {record.user?.full_name || record.user?.name || record.user?.email || '—'}
            </p>
          ) : null}
          <Badge variant={record.type === 'clock_in' ? 'default' : 'secondary'}>
            {formatRecordType(record.type)}
          </Badge>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">
          {format(new Date(record.captured_at), 'MMM d, h:mm a')}
        </p>
      </div>

      {record.location_label ? (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{record.location_label}</span>
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
          {policy?.is_overtime || policy?.shift_name ? (
            <OvertimeBadge policy={policy} />
          ) : null}
          {[record.browser, record.operating_system].filter(Boolean).length ? (
            <span className="text-muted-foreground">
              {[record.browser, record.operating_system].filter(Boolean).join(' · ')}
            </span>
          ) : null}
        </div>
        <AttendancePhotoViewer record={record} />
      </div>
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
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> My recent records
        </CardTitle>
        <CardDescription>Your latest clock in and clock out entries.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history?.records?.length ? (
          <>
            <div className="space-y-3 md:hidden">
              {history.records.map((record) => (
                <AttendanceRecordCard key={record.id} record={record} />
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Overtime</TableHead>
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
                        <OvertimeBadge policy={record.metadata?.policy} />
                      </TableCell>
                      <TableCell>
                        <AttendancePhotoViewer record={record} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
  const isAdmin = user?.role === 'admin';
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
    enabled: isAdmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-attendance-admin'],
    queryFn: () => db.entities.User.list('-created_date', 200),
    enabled: isAdmin,
    staleTime: 120_000,
  });

  const totalRecords = data?.summary?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / ADMIN_PAGE_SIZE));
  const pageStart = totalRecords === 0 ? 0 : page * ADMIN_PAGE_SIZE + 1;
  const pageEnd = Math.min(totalRecords, (page + 1) * ADMIN_PAGE_SIZE);

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

  if (!isAdmin) {
    return null;
  }

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

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Summary</CardTitle>
          <CardDescription>
            {totalRecords > 0
              ? `Showing ${pageStart}–${pageEnd} of ${totalRecords} matching records. Export CSV includes all matches.`
              : 'Filter and review clock in/out activity across the organization.'}
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
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{data?.summary?.total ?? 0}</div>
                </div>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-muted-foreground">Clock-ins</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{data?.summary?.clock_ins ?? 0}</div>
                </div>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-muted-foreground">Clock-outs</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{data?.summary?.clock_outs ?? 0}</div>
                </div>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="text-muted-foreground">Users</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{data?.summary?.unique_users ?? 0}</div>
                </div>
              </div>

              {data?.records?.length ? (
                <>
                  <div className="space-y-3 md:hidden">
                    {data.records.map((record) => (
                      <AttendanceRecordCard key={record.id} record={record} showUser />
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
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
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatCoordinates(record.latitude, record.longitude)}
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                              {[record.browser, record.operating_system].filter(Boolean).join(' · ') || '—'}
                            </TableCell>
                            <TableCell>
                              <OvertimeBadge policy={record.metadata?.policy} />
                            </TableCell>
                            <TableCell>
                              <AttendancePhotoViewer record={record} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 ? (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {page + 1} of {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={page === 0}
                          onClick={() => setPage((current) => Math.max(0, current - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages - 1}
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
    <div className="space-y-4">
      <MyAttendanceHistory />
      <AttendanceAdminReport />
    </div>
  );
}
