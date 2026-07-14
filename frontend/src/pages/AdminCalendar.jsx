// @ts-nocheck
import db from '@/api/apiClient';
import React, { useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon,
  Plus,
  MapPin,
  ExternalLink,
  Clock,
  ChevronsUpDown,
  Check,
  X,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import { format, isSameDay, isToday, parseISO, startOfDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

function toDateTimeLocalValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function canManageEvent(event, user) {
  if (!user?.email || !event) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  return normalizeEmail(event.created_by) === normalizeEmail(user.email);
}

function isInvitedEvent(event, user) {
  if (!user?.email || !event || canManageEvent(event, user)) {
    return false;
  }

  const attendees = Array.isArray(event.attendee_emails) ? event.attendee_emails : [];

  return attendees.some((email) => normalizeEmail(email) === normalizeEmail(user.email));
}

function defaultStartForDate(date) {
  const base = startOfDay(date);
  const now = new Date();

  if (isSameDay(base, now)) {
    const rounded = new Date(now);
    rounded.setMinutes(Math.ceil(rounded.getMinutes() / 15) * 15, 0, 0);
    return rounded;
  }

  base.setHours(9, 0, 0, 0);
  return base;
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

function CalendarDayContent({ date, eventCount }) {
  return (
    <span className="relative flex h-full w-full flex-col items-center justify-center">
      <span>{date.getDate()}</span>
      {eventCount > 0 ? (
        <span className="absolute bottom-0.5 flex gap-0.5">
          {Array.from({ length: Math.min(eventCount, 3) }).map((_, index) => (
            <span key={index} className="h-1 w-1 rounded-full bg-primary" />
          ))}
        </span>
      ) : null}
    </span>
  );
}

export default function AdminCalendar() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [focusedEventId, setFocusedEventId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [inviteePickerOpen, setInviteePickerOpen] = useState(false);
  const [selectedUserEmails, setSelectedUserEmails] = useState([]);
  const [customInvitees, setCustomInvitees] = useState([]);
  const [customInviteeInput, setCustomInviteeInput] = useState('');
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState(toDateTimeLocalValue(new Date()));
  const [endAt, setEndAt] = useState(toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [isAllDay, setIsAllDay] = useState(false);

  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => db.entities.CalendarEvent.list('start_at', 500),
  });

  const { data: rosterData } = useQuery({
    queryKey: ['user-roster'],
    queryFn: () => db.getUserRoster(),
  });

  const userOptions = useMemo(() => {
    const users = Array.isArray(rosterData?.users) ? rosterData.users : [];

    return users
      .filter((user) => user.email)
      .map((user) => {
        const displayName = user.name?.trim() || user.full_name?.trim();
        return {
          email: user.email,
          label: displayName ? `${displayName} (${user.email})` : user.email,
        };
      });
  }, [rosterData]);

  const userEmailLookup = useMemo(() => {
    const map = new Map();

    userOptions.forEach((option) => {
      map.set(option.email.toLowerCase(), option.email);
    });

    return map;
  }, [userOptions]);

  const eventsByDateKey = useMemo(() => {
    const map = new Map();

    events.forEach((event) => {
      const key = format(parseISO(event.start_at), 'yyyy-MM-dd');

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(event);
    });

    return map;
  }, [events]);

  const eventDates = useMemo(() => {
    return events.map((event) => parseISO(event.start_at));
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    return events
      .filter((event) => isSameDay(parseISO(event.start_at), selectedDate))
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  }, [events, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((event) => new Date(event.end_at) >= now)
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
      .slice(0, 8);
  }, [events]);

  const handleMutationError = (error) => {
    toast.error(error?.data?.message || error?.message || 'Something went wrong');
  };

  const createMut = useMutation({
    mutationFn: (payload) => db.entities.CalendarEvent.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events-week'] });
      resetForm();
      toast.success('Event created');
    },
    onError: handleMutationError,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => db.entities.CalendarEvent.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events-week'] });
      resetForm();
      toast.success('Event updated');
    },
    onError: handleMutationError,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => db.entities.CalendarEvent.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events-week'] });
      if (editingId) {
        resetForm();
      }
      setPendingDeleteEvent(null);
      setFocusedEventId(null);
      toast.success('Event deleted');
    },
    onError: handleMutationError,
  });

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error('Please provide valid start and end date/time');
      return;
    }

    if (end < start) {
      toast.error('End date/time must be after start date/time');
      return;
    }

    const allInvitees = Array.from(new Set(
      [...selectedUserEmails, ...customInvitees]
        .map((email) => String(email).trim().toLowerCase())
        .filter(Boolean)
    ));

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      is_all_day: isAllDay,
      attendee_emails: allInvitees.length ? allInvitees : null,
    };

    if (editingId) {
      updateMut.mutate({ id: editingId, payload });
      return;
    }

    createMut.mutate(payload);
  };

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setTitle('');
    setDescription('');
    setLocation('');
    setStartAt(toDateTimeLocalValue(new Date()));
    setEndAt(toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)));
    setSelectedUserEmails([]);
    setCustomInvitees([]);
    setCustomInviteeInput('');
    setIsAllDay(false);
    setInviteePickerOpen(false);
  };

  const openCreateForm = (date = selectedDate) => {
    const start = defaultStartForDate(date);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    setEditingId(null);
    setTitle('');
    setDescription('');
    setLocation('');
    setStartAt(toDateTimeLocalValue(start));
    setEndAt(toDateTimeLocalValue(end));
    setSelectedUserEmails([]);
    setCustomInvitees([]);
    setCustomInviteeInput('');
    setIsAllDay(false);
    setInviteePickerOpen(false);
    setFormOpen(true);
  };

  const startEdit = (event) => {
    if (!canManageEvent(event, user)) {
      toast.error('You can only edit events you created.');
      return;
    }

    const attendeeList = Array.isArray(event.attendee_emails) ? event.attendee_emails : [];
    const selected = [];
    const custom = [];

    attendeeList.forEach((email) => {
      const normalized = String(email).trim().toLowerCase();

      if (!normalized) {
        return;
      }

      const matchingUserEmail = userEmailLookup.get(normalized);

      if (matchingUserEmail) {
        selected.push(matchingUserEmail.toLowerCase());
      } else {
        custom.push(normalized);
      }
    });

    setEditingId(event.id);
    setTitle(event.title || '');
    setDescription(event.description || '');
    setLocation(event.location || '');
    setStartAt(toDateTimeLocalValue(new Date(event.start_at)));
    setEndAt(toDateTimeLocalValue(new Date(event.end_at)));
    setSelectedUserEmails(Array.from(new Set(selected)));
    setCustomInvitees(Array.from(new Set(custom)));
    setCustomInviteeInput('');
    setIsAllDay(Boolean(event.is_all_day));
    setFormOpen(true);
  };

  const isMutating = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const handleFormOpenChange = (open) => {
    if (!open) {
      if (isMutating) {
        return;
      }

      resetForm();
      return;
    }

    setFormOpen(open);
  };

  const isValidEmail = (value) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(String(value || '').trim());
  };

  const addCustomInvitee = () => {
    const normalized = customInviteeInput.trim().toLowerCase();

    if (!normalized) {
      return;
    }

    if (!isValidEmail(normalized)) {
      toast.error('Please enter a valid guest email address');
      return;
    }

    if (selectedUserEmails.includes(normalized) || customInvitees.includes(normalized)) {
      setCustomInviteeInput('');
      return;
    }

    setCustomInvitees((prev) => [...prev, normalized]);
    setCustomInviteeInput('');
  };

  const toggleUserInvitee = (email) => {
    const normalized = String(email || '').trim().toLowerCase();

    if (!normalized) {
      return;
    }

    setSelectedUserEmails((prev) => (
      prev.includes(normalized)
        ? prev.filter((item) => item !== normalized)
        : [...prev, normalized]
    ));
  };

  const removeInvitee = (email) => {
    const normalized = String(email || '').trim().toLowerCase();
    setSelectedUserEmails((prev) => prev.filter((item) => item !== normalized));
    setCustomInvitees((prev) => prev.filter((item) => item !== normalized));
  };

  const confirmDelete = () => {
    if (!pendingDeleteEvent || !canManageEvent(pendingDeleteEvent, user)) {
      return;
    }

    deleteMut.mutate(pendingDeleteEvent.id);
  };

  const jumpToEvent = (event) => {
    const eventDate = parseISO(event.start_at);
    setSelectedDate(eventDate);
    setFocusedEventId(event.id);
  };

  const calendarDayContent = useMemo(() => {
    return ({ date }) => {
      const key = format(date, 'yyyy-MM-dd');
      const count = eventsByDateKey.get(key)?.length || 0;

      return <CalendarDayContent date={date} eventCount={count} />;
    };
  }, [eventsByDateKey]);

  const renderEventCard = (event, index) => {
    const manageable = canManageEvent(event, user);
    const invited = isInvitedEvent(event, user);
    const isFocused = focusedEventId === event.id;
    const attendeeCount = Array.isArray(event.attendee_emails) ? event.attendee_emails.length : 0;

    return (
      <motion.div
        key={event.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
      >
        <button
          type="button"
          onClick={() => setFocusedEventId(isFocused ? null : event.id)}
          className={cn(
            'group w-full rounded-xl border p-3 text-left transition-all hover:border-primary/30 hover:bg-muted/30',
            invited && 'bg-muted/20',
            isFocused && 'border-primary/50 bg-primary/[0.04] ring-1 ring-primary/20'
          )}
        >
          <div className="flex items-start gap-3">
            <EventDateBadge date={parseISO(event.start_at)} />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
                      {event.title}
                    </p>
                    {invited ? <Badge variant="outline" className="h-5 text-[10px]">Invited</Badge> : null}
                    {event.is_all_day ? <Badge variant="secondary" className="h-5 text-[10px]">All day</Badge> : null}
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5 tabular-nums">
                      <Clock className="h-3 w-3 shrink-0 opacity-70" />
                      {event.is_all_day
                        ? format(parseISO(event.start_at), 'MMM d, yyyy')
                        : `${format(parseISO(event.start_at), 'MMM d, h:mm a')} – ${format(parseISO(event.end_at), 'h:mm a')}`}
                    </p>
                    {event.location ? (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                        <span className="line-clamp-1">{event.location}</span>
                      </p>
                    ) : null}
                    {attendeeCount > 0 ? (
                      <p className="flex items-center gap-1.5">
                        <Users className="h-3 w-3 shrink-0 opacity-70" />
                        {attendeeCount} invitee{attendeeCount !== 1 ? 's' : ''}
                      </p>
                    ) : null}
                  </div>

                  <AnimatePresence>
                    {isFocused ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        {event.description ? (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{event.description}</p>
                        ) : null}
                        {event.created_by ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">Organized by {event.created_by}</p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                          {event.google_calendar_url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1"
                              onClick={() => window.open(event.google_calendar_url, '_blank', 'noopener,noreferrer')}
                            >
                              <ExternalLink className="w-3 h-3" /> Google Calendar
                            </Button>
                          ) : null}
                          {manageable ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => startEdit(event)}
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1 text-destructive hover:text-destructive"
                                onClick={() => setPendingDeleteEvent(event)}
                                disabled={deleteMut.isPending}
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </button>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" /> Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse events, jump to dates, and manage your schedule.
          </p>
        </div>
        <Button onClick={() => openCreateForm()} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          New Event
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="rounded-2xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Schedule</CardTitle>
                <Badge variant="secondary" className="font-medium">
                  {events.length} event{events.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/10 p-2 sm:p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setFocusedEventId(null);
                    }
                  }}
                  modifiers={{ hasEvent: eventDates }}
                  modifiersClassNames={{
                    hasEvent: 'font-semibold text-primary',
                  }}
                  components={{ DayContent: calendarDayContent }}
                  className="w-full"
                  classNames={{
                    months: 'w-full',
                    month: 'w-full space-y-4',
                    caption: 'flex justify-center pt-1 relative items-center mb-2',
                    caption_label: 'text-sm font-semibold',
                    nav_button: 'h-8 w-8',
                    table: 'w-full border-collapse',
                    head_row: 'grid grid-cols-7 mb-1',
                    row: 'grid grid-cols-7 mt-1',
                    head_cell: 'text-muted-foreground rounded-md w-full font-medium text-[0.75rem] text-center uppercase tracking-wide',
                    cell: 'relative p-0.5 text-center text-sm',
                    day: 'h-11 w-full rounded-lg transition-colors hover:bg-accent',
                    day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-bold',
                    day_today: 'bg-accent/80 font-semibold',
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {format(selectedDate, 'EEEE, MMM d')}
                  {isToday(selectedDate) ? (
                    <Badge className="h-5 text-[10px]">Today</Badge>
                  ) : null}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs shrink-0"
                  onClick={() => openCreateForm(selectedDate)}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((item) => (
                    <div key={item} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : selectedDayEvents.length === 0 ? (
                <button
                  type="button"
                  onClick={() => openCreateForm(selectedDate)}
                  className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                >
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No events on this day</p>
                  <p className="mt-1 text-xs text-muted-foreground">Tap to schedule something</p>
                </button>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((event, index) => renderEventCard(event, index))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                Upcoming
                {upcomingEvents.length > 0 ? (
                  <Badge variant="secondary" className="h-5 text-[10px]">
                    {upcomingEvents.length}
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
            {upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Nothing coming up</p>
              </div>
            ) : (
              <div className="space-y-1">
                {upcomingEvents.map((event, index) => {
                  const invited = isInvitedEvent(event, user);
                  const isFocused = focusedEventId === event.id;

                  return (
                    <motion.button
                      key={event.id}
                      type="button"
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => jumpToEvent(event)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/40',
                        isFocused && 'bg-primary/[0.06] ring-1 ring-primary/20'
                      )}
                    >
                      <EventDateBadge date={parseISO(event.start_at)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium">{event.title}</p>
                          {invited ? (
                            <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px]">
                              Invited
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {format(parseISO(event.start_at), 'EEE, MMM d · h:mm a')}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={formOpen} onOpenChange={handleFormOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? 'Edit Event' : 'New Event'}</SheetTitle>
            <SheetDescription>
              {editingId
                ? 'Update the details below and save your changes.'
                : 'Fill in the details to add an event to the calendar.'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Event Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Townhall meeting" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Agenda and details" />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="HQ Meeting Room A / Google Meet" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Invitees</Label>
              <Popover open={inviteePickerOpen} onOpenChange={setInviteePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedUserEmails.length > 0
                      ? `${selectedUserEmails.length} system user(s) selected`
                      : 'Select users from system'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search users by name/email" />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup>
                        {userOptions.map((option) => {
                          const normalized = option.email.toLowerCase();
                          const checked = selectedUserEmails.includes(normalized);

                          return (
                            <CommandItem
                              key={option.email}
                              value={`${option.email} ${option.label}`}
                              onSelect={() => toggleUserInvitee(option.email)}
                            >
                              <Checkbox checked={checked} className="mr-2" />
                              <span className="truncate">{option.label}</span>
                              <Check className={cn('ml-auto h-4 w-4', checked ? 'opacity-100' : 'opacity-0')} />
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="flex gap-2">
                <Input
                  value={customInviteeInput}
                  onChange={(e) => setCustomInviteeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomInvitee();
                    }
                  }}
                  placeholder="Add guest email (not in system)"
                />
                <Button type="button" variant="outline" onClick={addCustomInvitee}>Add</Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {[...selectedUserEmails, ...customInvitees].map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1 pr-1">
                    {email}
                    <button
                      type="button"
                      className="rounded-full hover:bg-black/10 p-0.5"
                      onClick={() => removeInvitee(email)}
                      aria-label={`Remove ${email}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">All-day event</p>
                <p className="text-xs text-muted-foreground">Use date range as full-day event</p>
              </div>
              <Switch checked={isAllDay} onCheckedChange={setIsAllDay} />
            </div>
          </div>

          <SheetFooter className="mt-6 gap-2 sm:gap-0">
            <Button variant="outline" onClick={resetForm} disabled={isMutating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} className="gap-2" disabled={isMutating}>
              {editingId ? (
                updateMut.isPending ? 'Updating...' : 'Update Event'
              ) : (
                createMut.isPending ? 'Saving...' : 'Create Event'
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(pendingDeleteEvent)} onOpenChange={(open) => !open && setPendingDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteEvent
                ? `"${pendingDeleteEvent.title}" will be permanently removed.`
                : 'This event will be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? 'Deleting...' : 'Delete Event'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
