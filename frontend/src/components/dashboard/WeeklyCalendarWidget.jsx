import db from '@/api/apiClient';
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar as CalendarIcon, MapPin, Clock, ArrowRight, User } from 'lucide-react';
import { getDisplayName } from '@/lib/profile';
import { format, isPast, isToday, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const DISPLAY_LIMIT = 4;

export default function WeeklyCalendarWidget({ embedded = false }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const fromDate = format(weekStart, 'yyyy-MM-dd');
  const toDate = format(weekEnd, 'yyyy-MM-dd');

  const { data: weekEvents = [], isLoading } = useQuery({
    queryKey: ['calendar-events-week', fromDate, toDate],
    queryFn: () =>
      db.entities.CalendarEvent.filter(
        { from: fromDate, to: toDate },
        'start_at',
        100
      ),
    staleTime: 5 * 60 * 1000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['calendar-users'],
    queryFn: () => db.entities.User.list('full_name', 500),
    staleTime: 5 * 60 * 1000,
  });

  const organizerNameByEmail = useMemo(() => {
    const map = new Map();

    users.forEach((user) => {
      if (user.email) {
        map.set(user.email.toLowerCase(), getDisplayName(user, user.email));
      }
    });

    return map;
  }, [users]);

  const upcomingEvents = useMemo(
    () =>
      weekEvents.filter((event) => {
        const endTime = parseISO(event.end_at || event.start_at);
        return !isPast(endTime);
      }),
    [weekEvents]
  );

  const displayEvents = useMemo(
    () =>
      [...upcomingEvents]
        .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
        .slice(0, DISPLAY_LIMIT),
    [upcomingEvents]
  );

  const eventCount = upcomingEvents.length;
  const hiddenCount = Math.max(0, eventCount - DISPLAY_LIMIT);

  const containerClass = embedded
    ? 'bg-transparent border-0 rounded-none'
    : 'bg-card rounded-2xl border border-border';

  const contentPadding = embedded ? 'px-5 pb-5' : 'px-5 pb-5';

  if (isLoading) {
    return (
      <div className={containerClass}>
        <WidgetHeader
          weekStart={weekStart}
          weekEnd={weekEnd}
          eventCount={0}
        />
        <p className={cn('text-sm text-muted-foreground text-center py-8', contentPadding)}>
          Loading events...
        </p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className={containerClass}>
        <WidgetHeader
          weekStart={weekStart}
          weekEnd={weekEnd}
          eventCount={eventCount}
        />

        <div className={contentPadding}>
          {eventCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Nothing scheduled</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your week is clear so far
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {displayEvents.map((event, index) => (
                <EventItem
                  key={event.id}
                  event={event}
                  index={index}
                  organizerNameByEmail={organizerNameByEmail}
                />
              ))}

              {hiddenCount > 0 ? (
                <Link
                  to="/calendar"
                  className="mt-2 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  +{hiddenCount} more event{hiddenCount !== 1 ? 's' : ''}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function WidgetHeader({ weekStart, weekEnd, eventCount }) {
  return (
    <div className="flex items-start justify-between p-5 pb-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <CalendarIcon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">This Week</h3>
            {eventCount > 0 ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                {eventCount}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
          </p>
        </div>
      </div>
      <Link to="/calendar" className="shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}

function EventDateBadge({ date }) {
  const today = isToday(date);

  return (
    <div
      className={cn(
        'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl',
        today
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'border border-border/70 bg-muted/30'
      )}
    >
      <span
        className={cn(
          'text-[10px] font-semibold uppercase leading-none',
          today ? 'text-primary-foreground/80' : 'text-muted-foreground'
        )}
      >
        {format(date, 'MMM')}
      </span>
      <span className="mt-0.5 text-sm font-bold leading-none">{format(date, 'd')}</span>
    </div>
  );
}

function EventItem({ event, index, organizerNameByEmail }) {
  const startTime = parseISO(event.start_at);
  const endTime = parseISO(event.end_at);
  const today = isToday(startTime);
  const subtitle = event.description || event.location;
  const organizer = event.created_by
    ? organizerNameByEmail.get(event.created_by.toLowerCase()) || event.created_by
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        to="/calendar"
        className={cn(
          'group flex gap-3 rounded-xl p-3 transition-colors hover:bg-muted/40',
          today && 'bg-primary/[0.04] hover:bg-primary/[0.07]'
        )}
      >
        <EventDateBadge date={startTime} />

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="line-clamp-1 text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
                  {event.title}
                </p>
                {today ? (
                  <Badge className="h-4 px-1.5 text-[9px] font-semibold bg-primary/90 hover:bg-primary">
                    Today
                  </Badge>
                ) : null}
              </div>
              {subtitle ? (
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {event.is_all_day ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 font-medium">
                All day
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="h-3 w-3 shrink-0 opacity-70" />
                {format(startTime, 'HH:mm')}
                <span className="opacity-50">–</span>
                {format(endTime, 'HH:mm')}
              </span>
            )}
            {event.location && event.description ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                <span className="line-clamp-1">{event.location}</span>
              </span>
            ) : null}
            {organizer ? (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3 shrink-0 opacity-70" />
                <span className="line-clamp-1">{organizer}</span>
              </span>
            ) : null}
          </div>
        </div>

        <ArrowRight className="mt-3 h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
      </Link>
    </motion.div>
  );
}
