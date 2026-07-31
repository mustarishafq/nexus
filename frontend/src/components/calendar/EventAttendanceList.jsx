// @ts-nocheck
import db from '@/api/apiClient';
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  const count = data?.count ?? (Array.isArray(data?.attendances) ? data.attendances.length : 0);

  return (
    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full justify-between text-xs gap-2"
        asChild
      >
        <Link to={`/calendar/events/${eventId}/attendance`}>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            View attendance ({count})
          </span>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
        </Link>
      </Button>
    </div>
  );
}
