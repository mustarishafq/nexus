// @ts-nocheck
import db from '@/api/apiClient';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function EventAttendanceList({ eventId, enabled }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['calendar-event-attendances', eventId],
    queryFn: () => db.eventCheckIn.listAttendances(eventId),
    enabled: Boolean(enabled && eventId),
  });

  if (!enabled) {
    return null;
  }

  if (isLoading) {
    return <p className="mt-2 text-[11px] text-muted-foreground">Loading attendance…</p>;
  }

  if (isError) {
    return <p className="mt-2 text-[11px] text-destructive">Could not load attendance.</p>;
  }

  const attendances = Array.isArray(data?.attendances) ? data.attendances : [];
  const count = data?.count ?? attendances.length;

  return (
    <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      <p className="text-[11px] font-medium text-muted-foreground">
        Attendance ({count})
      </p>
      {attendances.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No check-ins yet.</p>
      ) : (
        <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {attendances.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-2 text-[11px]">
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {row.display_name || row.user?.name || row.email}
                </p>
                <p className="text-muted-foreground truncate">{row.email}</p>
              </div>
              <div className="shrink-0 text-right space-y-0.5">
                <Badge variant={row.is_staff ? 'secondary' : 'outline'} className="h-4 text-[9px] px-1.5">
                  {row.is_staff ? 'Staff' : 'Public'}
                </Badge>
                {row.checked_in_at ? (
                  <p className="text-muted-foreground tabular-nums">
                    {format(parseISO(row.checked_in_at), 'h:mm a')}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
