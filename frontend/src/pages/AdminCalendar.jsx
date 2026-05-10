// @ts-nocheck
import db from '@/api/base44Client';
import React, { useEffect, useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Plus, MapPin, ExternalLink, Clock, ChevronsUpDown, Check, X } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
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
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

function toDateTimeLocalValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AdminCalendar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
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

  const { data: oauthStatus, isLoading: loadingOAuthStatus } = useQuery({
    queryKey: ['google-oauth-status'],
    queryFn: () => db.googleOAuth.status(),
  });

  const connectOAuthMut = useMutation({
    mutationFn: () => db.googleOAuth.connect(),
    onSuccess: (data) => {
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    },
    onError: (error) => {
      toast.error(error?.message || 'Unable to start Google connection');
    },
  });

  const disconnectOAuthMut = useMutation({
    mutationFn: () => db.googleOAuth.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-oauth-status'] });
      toast.success('Google account disconnected');
    },
  });

  useEffect(() => {
    const oauthFlag = searchParams.get('google_oauth');

    if (!oauthFlag) {
      return;
    }

    if (oauthFlag === 'connected') {
      toast.success('Google account connected successfully');
      queryClient.invalidateQueries({ queryKey: ['google-oauth-status'] });
    } else if (oauthFlag === 'error') {
      const reason = searchParams.get('reason') || 'unknown_error';
      toast.error(`Google connection failed: ${reason}`);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('google_oauth');
    next.delete('reason');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, queryClient]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => db.entities.CalendarEvent.list('start_at', 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['calendar-users'],
    queryFn: () => db.entities.User.list('full_name', 500),
  });

  const userOptions = useMemo(() => {
    return users
      .filter((user) => user.email)
      .map((user) => ({
        email: user.email,
        label: user.full_name ? `${user.full_name} (${user.email})` : user.email,
      }));
  }, [users]);

  const userEmailLookup = useMemo(() => {
    const map = new Map();

    userOptions.forEach((option) => {
      map.set(option.email.toLowerCase(), option.email);
    });

    return map;
  }, [userOptions]);

  const createMut = useMutation({
    mutationFn: (payload) => db.entities.CalendarEvent.create(payload),
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      resetForm();

      if (event?.google_sync_status === 'failed') {
        toast.error(`Event saved, but Google sync failed: ${event.google_sync_error || 'Unknown error'}`);
      } else {
        toast.success('Event created and synced to Google Calendar');
      }
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => db.entities.CalendarEvent.update(id, payload),
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      resetForm();

      if (event?.google_sync_status === 'failed') {
        toast.error(`Event updated, but Google sync failed: ${event.google_sync_error || 'Unknown error'}`);
      } else {
        toast.success('Event updated and synced to Google Calendar');
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => db.entities.CalendarEvent.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      if (editingId) {
        resetForm();
      }
      setPendingDeleteEvent(null);
      toast.success('Event deleted');
    },
  });

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
      .slice(0, 6);
  }, [events]);

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
  };

  const startEdit = (event) => {
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
    if (!pendingDeleteEvent) {
      return;
    }

    deleteMut.mutate(pendingDeleteEvent.id);
  };

  const isMutating = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarIcon className="w-6 h-6 text-primary" /> Admin Calendar
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add events for the team and generate Google Calendar invites instantly.
        </p>
      </motion.div>

      <Card className="rounded-2xl">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Google Calendar Connection</p>
            <p className="text-xs text-muted-foreground mt-1">
              {loadingOAuthStatus
                ? 'Checking connection status...'
                : oauthStatus?.connected
                  ? 'Connected with OAuth. Attendee invites can be sent by Google Calendar.'
                  : 'Not connected. Connect Google account to enable attendee invites.'}
            </p>
          </div>
          {oauthStatus?.connected ? (
            <Button
              variant="outline"
              onClick={() => disconnectOAuthMut.mutate()}
              disabled={disconnectOAuthMut.isPending}
            >
              {disconnectOAuthMut.isPending ? 'Disconnecting...' : 'Disconnect Google'}
            </Button>
          ) : (
            <Button onClick={() => connectOAuthMut.mutate()} disabled={connectOAuthMut.isPending}>
              {connectOAuthMut.isPending ? 'Connecting...' : 'Connect Google Account'}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Create Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{editingId ? 'Edit Event Title' : 'Event Title'}</Label>
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
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleCreate} className="w-full gap-2" disabled={isMutating}>
                <Plus className="w-4 h-4" />
                {editingId ? (updateMut.isPending ? 'Updating...' : 'Update Event') : (createMut.isPending ? 'Saving...' : 'Add Event')}
              </Button>
              {editingId ? (
                <Button variant="outline" onClick={resetForm} className="w-full sm:w-auto" disabled={isMutating}>
                  Cancel Edit
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Event Calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => setSelectedDate(date || new Date())}
                modifiers={{ hasEvent: eventDates }}
                modifiersClassNames={{
                  hasEvent: 'border border-primary text-primary font-semibold',
                }}
                className="w-full"
                classNames={{
                  months: 'w-full',
                  month: 'w-full space-y-4',
                  table: 'w-full border-collapse',
                  head_row: 'grid grid-cols-7',
                  row: 'grid grid-cols-7 mt-2',
                  head_cell: 'text-muted-foreground rounded-md w-full font-normal text-[0.8rem] text-center',
                  cell: 'relative p-1 text-center text-sm',
                  day: 'h-10 w-full rounded-md',
                }}
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                Events on {format(selectedDate, 'EEEE, MMM d, yyyy')}
              </h3>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading events...</p>
              ) : selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events on this date.</p>
              ) : (
                selectedDayEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{event.title}</p>
                      {event.is_all_day ? <Badge variant="secondary">All day</Badge> : null}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                      <p className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(event.start_at), 'MMM d, yyyy h:mm a')} - {format(parseISO(event.end_at), 'h:mm a')}
                      </p>
                      {event.location ? (
                        <p className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {event.location}
                        </p>
                      ) : null}
                    </div>
                    {event.google_calendar_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-8 text-xs gap-1"
                        onClick={() => window.open(event.google_calendar_url, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="w-3 h-3" /> Open Google Calendar Invite
                      </Button>
                    ) : null}
                    <div className="flex gap-2 mt-2">
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => startEdit(event)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive"
                        onClick={() => setPendingDeleteEvent(event)}
                        disabled={deleteMut.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-xl border p-3">
              <h3 className="text-sm font-semibold mb-2">Upcoming Events</h3>
              <div className="space-y-2">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming events yet.</p>
                ) : (
                  upcomingEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(event.start_at), 'EEE, MMM d h:mm a')}
                        </p>
                      </div>
                      {event.google_calendar_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => window.open(event.google_calendar_url, '_blank', 'noopener,noreferrer')}
                        >
                          Invite
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(pendingDeleteEvent)} onOpenChange={(open) => !open && setPendingDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteEvent
                ? `"${pendingDeleteEvent.title}" will be removed from this system and Google Calendar.`
                : 'This event will be removed from this system and Google Calendar.'}
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
