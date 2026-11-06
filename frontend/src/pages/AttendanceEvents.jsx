// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
  CalendarCheck, CalendarDays, ChevronDown, FileDown, Filter, Loader2, MapPin, QrCode, Search, UserCheck, Users,
} from 'lucide-react';
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
import { canManageCalendar, canViewAllEventAttendance } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MY_PAGE_SIZE = 20;
const ADMIN_PAGE_SIZE = 50;
const TABLE_HEAD_CLASS = 'h-11 whitespace-nowrap bg-muted/40 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground';
const TABLE_CELL_CLASS = 'whitespace-nowrap align-middle px-3 py-3';

function formatEventDate(event) {
  if (!event?.start_at) return '—';
  const start = new Date(event.start_at);
  if (event.is_all_day) return format(start, 'EEE, MMM d, yyyy');
  return format(start, 'EEE, MMM d, yyyy · h:mm a');
}

function formatCheckedIn(value) {
  if (!value) return '—';
  return format(new Date(value), 'MMM d, yyyy · h:mm a');
}

function SourceBadge({ source }) {
  const isPublic = source === 'public_form';
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap text-[11px] font-medium', isPublic ? 'text-muted-foreground' : 'text-primary')}>
      {isPublic ? 'Public form' : 'In-app'}
    </Badge>
  );
}

function EventTitle({ record, linkable }) {
  const title = record.event?.title || 'Deleted event';
  if (linkable && record.event?.id) {
    return (
      <Link
        to={`/calendar/events/${record.event.id}/attendance`}
        className="truncate font-medium text-foreground hover:text-primary hover:underline"
      >
        {title}
      </Link>
    );
  }
  return <span className="truncate font-medium">{title}</span>;
}

function TableShell({ children }) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-border md:block [&>div]:max-h-[min(32rem,70vh)] [&>div]:overflow-auto">
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

function AttendeeCell({ record }) {
  const name = record.user?.name || record.display_name;
  const email = record.user?.email || record.email;

  return (
    <div className="min-w-0 max-w-[220px] lg:max-w-[260px]">
      <p className="truncate text-sm font-medium leading-tight">
        {name || email || '—'}
        {!record.is_staff ? (
          <span className="ml-1.5 align-middle text-[10px] font-normal uppercase tracking-wide text-muted-foreground">guest</span>
        ) : null}
      </p>
      {name && email ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p> : null}
    </div>
  );
}

function EventRecordCard({ record, showAttendee = false, linkable = false }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 text-sm">
            <EventTitle record={record} linkable={linkable} />
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
            {formatEventDate(record.event)}
          </p>
          {record.event?.location ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{record.event.location}</span>
            </p>
          ) : null}
        </div>
        <SourceBadge source={record.source} />
      </div>
      {showAttendee ? (
        <div className="mt-2.5 border-t border-border/60 pt-2.5">
          <AttendeeCell record={record} />
          {record.user?.department ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{record.user.department}</p>
          ) : null}
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        Checked in <span className="text-foreground">{formatCheckedIn(record.checked_in_at)}</span>
      </p>
    </div>
  );
}

function EventRecordMobileList({ records, showAttendee = false, linkable = false }) {
  return (
    <div className="space-y-2.5 md:hidden">
      {records.map((record) => (
        <EventRecordCard key={record.id} record={record} showAttendee={showAttendee} linkable={linkable} />
      ))}
    </div>
  );
}

function MyEventsTable({ records }) {
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={TABLE_HEAD_CLASS}>Event</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Event date</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Location</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Checked in</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell className={cn(TABLE_CELL_CLASS, 'max-w-[280px]')}>
                <div className="flex min-w-0"><EventTitle record={record} /></div>
              </TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'text-sm')}>{formatEventDate(record.event)}</TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'max-w-[220px] truncate text-sm text-muted-foreground')}>
                {record.event?.location || '—'}
              </TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'text-sm tabular-nums')}>{formatCheckedIn(record.checked_in_at)}</TableCell>
              <TableCell className={TABLE_CELL_CLASS}><SourceBadge source={record.source} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}

function AdminEventsTable({ records, linkable }) {
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={TABLE_HEAD_CLASS}>Attendee</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Department</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Event</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Event date</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Checked in</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell className={TABLE_CELL_CLASS}><AttendeeCell record={record} /></TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'text-sm text-muted-foreground')}>{record.user?.department || '—'}</TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'max-w-[260px]')}>
                <div className="flex min-w-0"><EventTitle record={record} linkable={linkable} /></div>
              </TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'text-sm')}>{formatEventDate(record.event)}</TableCell>
              <TableCell className={cn(TABLE_CELL_CLASS, 'text-sm tabular-nums')}>{formatCheckedIn(record.checked_in_at)}</TableCell>
              <TableCell className={TABLE_CELL_CLASS}><SourceBadge source={record.source} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function MyEventHistory() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(MY_PAGE_SIZE);
  const debouncedSearch = useDebouncedValue(search.trim());

  useEffect(() => {
    setLimit(MY_PAGE_SIZE);
  }, [debouncedSearch]);

  const filters = useMemo(() => ({
    limit,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }), [limit, debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['event-attendance-my-history', filters],
    queryFn: () => db.eventAttendance.myHistory(filters),
    enabled: Boolean(user),
    placeholderData: keepPreviousData,
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const hasMore = records.length < total;

  return (
    <Card className="w-full rounded-2xl border-border/70">
      <CardHeader className="flex flex-col gap-3 space-y-0 p-4 pb-3 sm:flex-row sm:items-start sm:justify-between sm:p-6 sm:pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4 text-primary" /> My events
            {!isLoading && total > 0 ? (
              <Badge variant="secondary" className="ml-1 tabular-nums">{total}</Badge>
            ) : null}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Events you've checked in to by scanning the event QR code.
          </CardDescription>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events"
            className="h-9 pl-8"
            aria-label="Search my events"
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length ? (
          <>
            <EventRecordMobileList records={records} />
            <MyEventsTable records={records} />
            {hasMore ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isFetching}
                  className="h-10 touch-manipulation sm:h-9"
                  onClick={() => setLimit((current) => Math.min(current + MY_PAGE_SIZE, 200))}
                >
                  {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Load more ({records.length} of {total})
                </Button>
              </div>
            ) : null}
          </>
        ) : debouncedSearch ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No events match “{debouncedSearch}”.</p>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">You haven't checked in to any events yet.</p>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/scan-qr"><QrCode className="h-4 w-4" /> Scan event QR</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventAttendanceReport() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const canViewReport = canViewAllEventAttendance(user);
  const linkable = canManageCalendar(user);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [userId, setUserId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search.trim());

  useEffect(() => {
    if (isMobile) setFiltersOpen(false);
  }, [isMobile]);

  useEffect(() => {
    setPage(0);
  }, [dateFrom, dateTo, userId, departmentId, type, debouncedSearch]);

  const baseFilters = useMemo(() => ({
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    ...(userId ? { user_id: userId } : {}),
    ...(departmentId ? { department_id: departmentId } : {}),
    ...(type ? { type } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }), [dateFrom, dateTo, userId, departmentId, type, debouncedSearch]);

  const filters = useMemo(() => ({
    ...baseFilters,
    limit: ADMIN_PAGE_SIZE,
    offset: page * ADMIN_PAGE_SIZE,
  }), [baseFilters, page]);

  const { data, isLoading } = useQuery({
    queryKey: ['event-attendance-report', filters],
    queryFn: () => db.eventAttendance.report(filters),
    enabled: canViewReport,
    placeholderData: keepPreviousData,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-attendance-admin'],
    queryFn: () => db.entities.User.list('-created_date', 200),
    enabled: canViewReport,
    staleTime: 120_000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => db.listDepartments(),
    enabled: canViewReport,
    staleTime: 60_000,
  });

  const summary = data?.summary ?? {};
  const totalRecords = summary.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / ADMIN_PAGE_SIZE));
  const pageStart = totalRecords === 0 ? 0 : page * ADMIN_PAGE_SIZE + 1;
  const pageEnd = Math.min(totalRecords, (page + 1) * ADMIN_PAGE_SIZE);
  const activeFilterCount = [userId, departmentId, type, debouncedSearch].filter(Boolean).length;
  const selectedUser = userId ? users.find((u) => String(u.id) === String(userId)) : null;

  const handleExport = async () => {
    setExporting(true);
    try {
      await db.eventAttendance.exportCsv(baseFilters);
      toast.success('Event attendance export downloaded');
    } catch {
      toast.error('Failed to export event attendance CSV');
    } finally {
      setExporting(false);
    }
  };

  if (!canViewReport) return null;

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
            <Users className="h-4 w-4 shrink-0 text-primary" />
            All event attendance
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Check which events each staff member has attended. Pick a user to see their full event history.
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
                  className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', filtersOpen && 'rotate-180')}
                />
              ) : null}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3 border-t border-border/60 p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Checked in from</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Checked in to</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">User</label>
                  <UserSearchCombobox users={users} value={userId} onValueChange={setUserId} placeholder="All users" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Department</label>
                  <Select value={departmentId || 'all'} onValueChange={(value) => setDepartmentId(value === 'all' ? '' : value)}>
                    <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Attendee type</label>
                  <Select value={type || 'all'} onValueChange={(value) => setType(value === 'all' ? '' : value)}>
                    <SelectTrigger><SelectValue placeholder="All attendees" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All attendees</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="public">Public / guest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Search</label>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Event, name or email" />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card className="w-full rounded-2xl border-border/70">
        <CardHeader className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {selectedUser ? `Events attended by ${selectedUser.full_name || selectedUser.name || selectedUser.email}` : 'Summary'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {totalRecords > 0
                ? `Showing ${pageStart}–${pageEnd} of ${totalRecords} check-ins. Export CSV includes all matches.`
                : 'Event check-ins across the organization.'}
            </CardDescription>
          </div>
          {totalPages > 1 ? (
            <p className="hidden shrink-0 text-sm text-muted-foreground md:block">Page {page + 1} of {totalPages}</p>
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
                <SummaryStatCard label="Check-ins" value={summary.total ?? 0} icon={CalendarCheck} tone="muted" />
                <SummaryStatCard label="Events" value={summary.unique_events ?? 0} icon={CalendarDays} tone="primary" />
                <SummaryStatCard label="Attendees" value={summary.unique_attendees ?? 0} icon={Users} tone="success" />
                <SummaryStatCard
                  label="Staff / Public"
                  value={`${summary.staff ?? 0} / ${summary.public ?? 0}`}
                  icon={UserCheck}
                  tone="warning"
                />
              </div>

              {data?.records?.length ? (
                <>
                  <EventRecordMobileList records={data.records} showAttendee linkable={linkable} />
                  <AdminEventsTable records={data.records} linkable={linkable} />
                  {totalPages > 1 ? (
                    <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-center text-xs text-muted-foreground sm:text-left sm:text-sm">
                        Page {page + 1} of {totalPages}
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
                  No event check-ins match the selected filters.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AttendanceEvents() {
  return (
    <div className="w-full space-y-4 lg:space-y-6">
      <MyEventHistory />
      <EventAttendanceReport />
    </div>
  );
}

