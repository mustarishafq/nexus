import React from 'react';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

function formatSchedule(payload) {
  if (!payload?.start_at) return 'Schedule TBD';

  try {
    const start = parseISO(payload.start_at);
    const end = payload.end_at ? parseISO(payload.end_at) : null;

    if (payload.is_all_day) {
      return `${format(start, 'MMM d, yyyy')} (all day)`;
    }

    if (end) {
      return `${format(start, 'MMM d, yyyy h:mm a')} – ${format(end, 'h:mm a')}`;
    }

    return format(start, 'MMM d, yyyy h:mm a');
  } catch {
    return `${payload.start_at} – ${payload.end_at || ''}`;
  }
}

const actionLabels = {
  created: 'Invitation',
  updated: 'Updated',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
};

export default function CalendarEventPreview({ payload }) {
  if (!payload?.title) return null;

  const action = payload.action || 'created';
  const invitees = Array.isArray(payload.attendee_emails) ? payload.attendee_emails : [];

  return (
    <div className="space-y-2">
      <Label className="text-xs">Calendar preview</Label>
      <p className="text-[11px] text-muted-foreground">
        How this event will appear on the Nexus calendar.
      </p>
      <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-sky-500 shrink-0" />
              <p className="font-medium text-sm truncate">{payload.title}</p>
            </div>
            {payload.description ? (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{payload.description}</p>
            ) : null}
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0 border-sky-500/30 text-sky-700 dark:text-sky-300">
            {actionLabels[action] || action}
          </Badge>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {formatSchedule(payload)}
          </p>
          {payload.location ? (
            <p className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{payload.location}</span>
            </p>
          ) : null}
          {invitees.length > 0 ? (
            <p className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 shrink-0" />
              {invitees.length} invitee{invitees.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>

        {payload.external_event_id ? (
          <p className="text-[10px] font-mono text-muted-foreground/80 pt-1 border-t border-border/60">
            external_event_id: {payload.external_event_id}
          </p>
        ) : null}
      </div>
    </div>
  );
}
