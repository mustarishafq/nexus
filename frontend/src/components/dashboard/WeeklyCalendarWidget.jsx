import db from '@/api/base44Client';
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar as CalendarIcon, MapPin, Clock, ArrowRight } from 'lucide-react';
import { format, isToday, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function WeeklyCalendarWidget() {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
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
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const eventsGroupedByDay = useMemo(() => {
    const grouped = {};

    weekEvents.forEach((event) => {
      const eventDate = parseISO(event.start_at);
      const dateKey = format(eventDate, 'yyyy-MM-dd');

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });

    // Sort events within each day
    Object.keys(grouped).forEach((date) => {
      grouped[date].sort(
        (a, b) => new Date(a.start_at) - new Date(b.start_at)
      );
    });

    return grouped;
  }, [weekEvents]);

  const todayEvents = useMemo(() => {
    const todayKey = format(today, 'yyyy-MM-dd');
    return eventsGroupedByDay[todayKey] || [];
  }, [eventsGroupedByDay, today]);

  const eventCount = weekEvents.length;
  const todayEventCount = todayEvents.length;

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border">
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">This Week</h3>
          </div>
        </div>
        <div className="px-3 pb-3">
          <p className="text-sm text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="bg-card rounded-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">This Week</h3>
          </div>
          <Link to="/admin/calendar">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>

        {/* Date range subtitle */}
        <div className="px-5">
          <p className="text-xs text-muted-foreground">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
          </p>
        </div>

        {/* Content */}
        <div className="px-3 pb-3 pt-2">
          {eventCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No events scheduled this week
            </p>
          ) : (
            <div className="space-y-4">
              {/* Today's Events Section */}
              {todayEventCount > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="default" className="bg-red-500 hover:bg-red-600">
                      Today
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {todayEventCount} event{todayEventCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {todayEvents.map((event) => (
                      <TodayEventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}

              {/* Other Days' Events */}
              {weekEvents
                .filter((e) => !isToday(parseISO(e.start_at)))
                .slice(0, 3)
                .map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}

              {/* Show more indicator */}
              {eventCount > (todayEventCount > 0 ? 4 : 3) && (
                <p className="text-xs text-muted-foreground pt-2">
                  +{eventCount - (todayEventCount > 0 ? 4 : 3)} more event
                  {eventCount - (todayEventCount > 0 ? 4 : 3) !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TodayEventCard({ event }) {
  const startTime = parseISO(event.start_at);
  const endTime = parseISO(event.end_at);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'p-3 rounded-lg border-2 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900',
        'hover:shadow-md transition-shadow'
      )}
    >
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="font-medium text-sm line-clamp-1">{event.title}</p>
          {event.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {event.description}
            </p>
          )}
          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
            {event.is_all_day ? (
              <span>All day</span>
            ) : (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  {format(startTime, 'HH:mm')} – {format(endTime, 'HH:mm')}
                </span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{event.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EventRow({ event }) {
  const eventDate = parseISO(event.start_at);
  const startTime = eventDate;

  return (
    <div className="flex gap-2 py-2 text-sm border-b border-border/50 last:border-0">
      <div className="w-12 flex-shrink-0 text-right">
        <div className="font-medium text-xs">
          {format(eventDate, 'MMM d')}
        </div>
        {!event.is_all_day && (
          <div className="text-xs text-muted-foreground">
            {format(startTime, 'HH:mm')}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm line-clamp-1">{event.title}</p>
        {event.location && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {event.location}
          </p>
        )}
      </div>
    </div>
  );
}
