// @ts-nocheck
import db from '@/api/apiClient';
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Download, Loader2, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { extraCheckInFormFields, formatCheckInAnswer, normalizeCheckInFormFields } from '@/lib/eventCheckInForm';

const TABLE_HEAD_CLASS = 'h-11 whitespace-nowrap bg-muted/40 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground';
const TABLE_CELL_CLASS = 'whitespace-nowrap align-middle px-3 py-3';

function displayName(row) {
  return row.display_name || row.user?.name || row.email || '—';
}

function formatOccurrenceLabel(occurrence) {
  if (!occurrence?.start_at) {
    return `Session ${(occurrence?.series_index ?? 0) + 1}`;
  }

  const start = parseISO(occurrence.start_at);
  const dateLabel = occurrence.is_all_day
    ? format(start, 'EEE, MMM d, yyyy')
    : format(start, 'EEE, MMM d, yyyy · h:mm a');
  const count = occurrence.attendance_count ?? 0;

  return `${dateLabel} · ${count} check-in${count === 1 ? '' : 's'}`;
}

export default function EventAttendance() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const eventQuery = useQuery({
    queryKey: ['calendar-event', id],
    queryFn: () => db.entities.CalendarEvent.get(id),
    enabled: Boolean(id),
  });

  const attendanceQuery = useQuery({
    queryKey: ['calendar-event-attendances', id],
    queryFn: () => db.eventCheckIn.listAttendances(id),
    enabled: Boolean(id),
  });

  const seriesQuery = useQuery({
    queryKey: ['calendar-event-series-occurrences', id],
    queryFn: () => db.eventCheckIn.listSeriesOccurrences(id),
    enabled: Boolean(id && eventQuery.data?.series_id),
  });

  const event = eventQuery.data;
  const attendances = Array.isArray(attendanceQuery.data?.attendances)
    ? attendanceQuery.data.attendances
    : [];
  const count = attendanceQuery.data?.count ?? attendances.length;
  const occurrences = Array.isArray(seriesQuery.data?.occurrences)
    ? seriesQuery.data.occurrences
    : [];
  const isRecurring = Boolean(event?.series_id) && occurrences.length > 0;
  const extraFields = extraCheckInFormFields(
    attendanceQuery.data?.check_in_form?.fields
      || normalizeCheckInFormFields(event?.check_in_form_fields)
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return attendances;
    }

    return attendances.filter((row) => {
      const name = displayName(row).toLowerCase();
      const email = String(row.email || '').toLowerCase();
      const answers = row.form_answers && typeof row.form_answers === 'object'
        ? Object.values(row.form_answers).map((value) => formatCheckInAnswer(value)).join(' ').toLowerCase()
        : '';
      return name.includes(q) || email.includes(q) || answers.includes(q);
    });
  }, [attendances, search]);

  const handleExport = async () => {
    if (!id) {
      return;
    }

    setExporting(true);
    try {
      await db.eventCheckIn.exportAttendancesCsv(id);
      toast.success('Attendance export downloaded');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Could not export attendance');
    } finally {
      setExporting(false);
    }
  };

  const handleSessionChange = (nextId) => {
    if (!nextId || String(nextId) === String(id)) {
      return;
    }
    setSearch('');
    navigate(`/calendar/events/${nextId}/attendance`);
  };

  if (eventQuery.isLoading || attendanceQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading attendance…
      </div>
    );
  }

  if (eventQuery.isError || attendanceQuery.isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate('/calendar')}>
          <ArrowLeft className="h-4 w-4" /> Back to calendar
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Unable to load attendance</CardTitle>
            <CardDescription>
              {eventQuery.error?.data?.message
                || attendanceQuery.error?.data?.message
                || eventQuery.error?.message
                || attendanceQuery.error?.message
                || 'You may not have permission to view this event.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const start = event?.start_at ? parseISO(event.start_at) : null;
  const end = event?.end_at ? parseISO(event.end_at) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" asChild>
            <Link to="/calendar">
              <ArrowLeft className="h-4 w-4" /> Back to calendar
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              {event?.title || 'Event attendance'}
              {event?.series_id ? (
                <Badge variant="outline" className="h-5 text-[10px]">Recurring</Badge>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {start
                ? event?.is_all_day
                  ? format(start, 'EEEE, MMM d, yyyy')
                  : `${format(start, 'EEEE, MMM d, yyyy · h:mm a')}${end ? ` – ${format(end, 'h:mm a')}` : ''}`
                : 'Attendance check-ins for this event'}
              {event?.location ? ` · ${event.location}` : ''}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-2 shrink-0"
          onClick={handleExport}
          disabled={exporting || count === 0}
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
        </Button>
      </div>

      {isRecurring ? (
        <Card>
          <CardHeader className="space-y-3">
            <div>
              <CardTitle className="text-base">Session</CardTitle>
              <CardDescription>
                Choose which occurrence in this recurring series to review.
              </CardDescription>
            </div>
            <Select value={String(id)} onValueChange={handleSessionChange}>
              <SelectTrigger className="w-full sm:max-w-md">
                <SelectValue placeholder="Select a session" />
              </SelectTrigger>
              <SelectContent>
                {occurrences.map((occurrence) => (
                  <SelectItem key={occurrence.id} value={String(occurrence.id)}>
                    {formatOccurrenceLabel(occurrence)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Attendance ({count})</CardTitle>
            <CardDescription>
              {filtered.length === count
                ? 'Everyone who checked in for this session'
                : `Showing ${filtered.length} of ${count}`}
            </CardDescription>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or answers"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-0">
          {filtered.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              {count === 0 ? 'No check-ins yet.' : 'No attendees match your search.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={TABLE_HEAD_CLASS}>Name</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Email</TableHead>
                    {extraFields.map((field) => (
                      <TableHead key={field.key} className={TABLE_HEAD_CLASS}>
                        {field.label}
                      </TableHead>
                    ))}
                    <TableHead className={TABLE_HEAD_CLASS}>Type</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Checked in</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className={`${TABLE_CELL_CLASS} font-medium`}>
                        {displayName(row)}
                      </TableCell>
                      <TableCell className={`${TABLE_CELL_CLASS} text-muted-foreground`}>
                        {row.email}
                      </TableCell>
                      {extraFields.map((field) => (
                        <TableCell key={field.key} className={`${TABLE_CELL_CLASS} text-muted-foreground`}>
                          {formatCheckInAnswer(row.form_answers?.[field.key]) || '—'}
                        </TableCell>
                      ))}
                      <TableCell className={TABLE_CELL_CLASS}>
                        <Badge variant={row.is_staff ? 'secondary' : 'outline'}>
                          {row.is_staff ? 'Staff' : 'Public'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`${TABLE_CELL_CLASS} tabular-nums text-muted-foreground`}>
                        {row.checked_in_at
                          ? format(parseISO(row.checked_in_at), 'MMM d, yyyy · h:mm a')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
