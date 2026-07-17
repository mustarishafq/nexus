// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, MapPin, QrCode } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import PageLoader from '@/components/PageLoader';

function formatEventWhen(event) {
  if (!event?.start_at) {
    return null;
  }

  if (event.is_all_day) {
    return format(parseISO(event.start_at), 'EEEE, MMM d, yyyy');
  }

  const start = format(parseISO(event.start_at), 'EEEE, MMM d · h:mm a');
  const end = event.end_at ? format(parseISO(event.end_at), 'h:mm a') : null;
  return end ? `${start} – ${end}` : start;
}

export default function EventCheckInPublic() {
  const { token } = useParams();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoadingAuth, user, appPublicSettings } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  const appName = appPublicSettings?.system_name || 'EMZI Nexus';

  const refreshCalendarViews = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-events-week'] });
  };

  const eventQuery = useQuery({
    queryKey: ['event-check-in', token],
    queryFn: () => db.eventCheckIn.show(token),
    enabled: Boolean(token),
    retry: false,
  });

  const publicMut = useMutation({
    mutationFn: (payload) => db.eventCheckIn.checkIn(token, payload),
    onSuccess: (data) => {
      setAlreadyCheckedIn(false);
      setResult(data);
      if (isAuthenticated) {
        refreshCalendarViews();
      }
    },
    onError: (error) => {
      if (error?.status === 409) {
        setAlreadyCheckedIn(true);
        setResult(error.data);
        if (isAuthenticated) {
          refreshCalendarViews();
        }
        return;
      }
      setResult(null);
      setAlreadyCheckedIn(false);
    },
  });

  const meMut = useMutation({
    mutationFn: () => db.eventCheckIn.checkInMe(token),
    onSuccess: (data) => {
      setAlreadyCheckedIn(false);
      setResult(data);
      refreshCalendarViews();
    },
    onError: (error) => {
      if (error?.status === 409) {
        setAlreadyCheckedIn(true);
        setResult(error.data);
        refreshCalendarViews();
        return;
      }
      setResult(null);
      setAlreadyCheckedIn(false);
    },
  });

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
      setName(user.full_name || user.name || '');
    }
  }, [user]);

  const handlePublicSubmit = (event) => {
    event.preventDefault();
    publicMut.mutate({
      email: email.trim(),
      name: name.trim() || undefined,
    });
  };

  if (isLoadingAuth || eventQuery.isLoading) {
    return <PageLoader />;
  }

  if (eventQuery.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md rounded-2xl border bg-background p-8 text-center space-y-3">
          <QrCode className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">Check-in not found</h1>
          <p className="text-sm text-muted-foreground">
            This QR code is invalid or the event no longer exists.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const event = eventQuery.data;
  const whenLabel = formatEventWhen(event);
  const attendanceOpen = event?.attendance_open !== false;
  const opensAtLabel = event?.check_in_opens_at
    ? format(parseISO(event.check_in_opens_at), 'EEEE, MMM d · h:mm a')
    : null;
  const formError = (!result && (publicMut.error || meMut.error))
    ? (publicMut.error || meMut.error)?.message
    : null;
  const success = Boolean(result);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md rounded-2xl border bg-background p-8 space-y-6 shadow-sm">
        <div className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{appName}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Event check-in</h1>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
          <p className="font-semibold text-lg leading-tight">{event.title}</p>
          {whenLabel ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              {whenLabel}
            </p>
          ) : null}
          {event.location ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0" />
              {event.location}
            </p>
          ) : null}
        </div>

        {!success && !attendanceOpen ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center space-y-1">
            <p className="font-medium text-amber-900 dark:text-amber-100">Attendance is not open yet</p>
            <p className="text-sm text-amber-800/80 dark:text-amber-200/80">
              {opensAtLabel ? `Opens at ${opensAtLabel}` : 'Please try again later.'}
            </p>
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
            <p className="font-semibold">
              {alreadyCheckedIn ? 'Already checked in' : 'You are checked in'}
            </p>
            <p className="text-sm text-muted-foreground">
              {result?.attendance?.is_staff
                ? 'Linked to your staff account.'
                : result?.attendance?.email
                  ? `Recorded as ${result.attendance.email}.`
                  : 'Attendance recorded.'}
            </p>
          </div>
        ) : !attendanceOpen ? null : isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Checking in as <span className="font-medium text-foreground">{user?.email}</span>
            </p>
            {formError ? (
              <p className="text-sm text-destructive text-center">{formError}</p>
            ) : null}
            <Button
              className="w-full"
              onClick={() => meMut.mutate()}
              disabled={meMut.isPending}
            >
              {meMut.isPending ? 'Checking in…' : 'Check in'}
            </Button>
          </div>
        ) : (
          <form onSubmit={handlePublicSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkin-email">Email</Label>
              <Input
                id="checkin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                Staff emails are linked to your account. Other emails are recorded as public guests.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkin-name">Name (optional)</Label>
              <Input
                id="checkin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={publicMut.isPending}>
              {publicMut.isPending ? 'Checking in…' : 'Check in'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
