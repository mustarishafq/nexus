// @ts-nocheck
import db from '@/api/apiClient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Clock, MapPin, QrCode, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const SCANNER_ELEMENT_ID = 'nexus-event-qr-scanner';

export function extractCheckInToken(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/event-check-in\/([^/]+)\/?$/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // Not a full URL — try path or bare token.
  }

  const pathMatch = value.match(/\/event-check-in\/([^/?#]+)/);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }

  return null;
}

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

export default function ScanQr() {
  const queryClient = useQueryClient();
  const scannerRef = useRef(null);
  const handlingRef = useRef(false);
  const mountedRef = useRef(true);
  const [cameraError, setCameraError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(true);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);

  const refreshCalendarViews = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-events-week'] });
  }, [queryClient]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) {
      if (mountedRef.current) {
        setScanning(false);
      }
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // Ignore stop errors when camera already closed.
    }

    try {
      scanner.clear();
    } catch {
      // Ignore clear errors.
    }

    if (mountedRef.current) {
      setScanning(false);
    }
  }, []);

  const handleDecoded = useCallback(async (decodedText) => {
    if (handlingRef.current) {
      return;
    }

    const token = extractCheckInToken(decodedText);
    if (!token) {
      toast.error('This QR code is not an event check-in code.');
      return;
    }

    handlingRef.current = true;
    setLoadingEvent(true);
    setLastResult(null);

    try {
      await stopScanner();
      const event = await db.eventCheckIn.show(token);
      if (!mountedRef.current) {
        return;
      }
      setPendingConfirm({ token, event });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setLastResult({
        status: 'error',
        message: error?.message || 'Could not load this event.',
      });
      toast.error(error?.message || 'Could not load this event.');
    } finally {
      if (mountedRef.current) {
        setLoadingEvent(false);
        setStarting(false);
      }
      handlingRef.current = false;
    }
  }, [stopScanner]);

  const confirmCheckIn = useCallback(async () => {
    if (!pendingConfirm?.token || busy) {
      return;
    }

    setBusy(true);

    try {
      const data = await db.eventCheckIn.checkInMe(pendingConfirm.token);
      if (!mountedRef.current) {
        return;
      }
      setPendingConfirm(null);
      setLastResult({
        status: 'success',
        message: data?.message || 'Checked in successfully.',
        eventTitle: data?.event?.title || pendingConfirm.event?.title,
        attendance: data?.attendance,
      });
      refreshCalendarViews();
      toast.success(
        data?.event?.title || pendingConfirm.event?.title
          ? `Checked in: ${data?.event?.title || pendingConfirm.event?.title}`
          : 'Checked in'
      );
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      if (error?.status === 409) {
        setPendingConfirm(null);
        setLastResult({
          status: 'already',
          message: error?.data?.message || 'Already checked in for this event.',
          eventTitle: pendingConfirm.event?.title,
          attendance: error?.data?.attendance,
        });
        refreshCalendarViews();
        toast.message('Already checked in for this event');
      } else if (error?.status === 403 && error?.data?.code === 'attendance_not_open') {
        toast.error(error?.data?.message || 'Attendance is not open yet.');
        if (error?.data?.event) {
          setPendingConfirm({
            token: pendingConfirm.token,
            event: error.data.event,
          });
        }
      } else {
        toast.error(error?.message || 'Check-in failed.');
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  }, [busy, pendingConfirm, refreshCalendarViews]);

  const startScanner = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }

    setCameraError(null);
    setLastResult(null);
    setPendingConfirm(null);
    setLoadingEvent(false);
    setStarting(true);
    setBusy(false);
    handlingRef.current = false;

    await stopScanner();

    const nextKey = Date.now();
    setScannerKey(nextKey);

    await new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    if (!mountedRef.current) {
      return;
    }

    const host = document.getElementById(SCANNER_ELEMENT_ID);
    if (!host) {
      setStarting(false);
      setCameraError('Camera view is not ready. Try again.');
      return;
    }

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 8,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1,
        },
        (decodedText) => {
          handleDecoded(decodedText);
        },
        () => {}
      );
      if (mountedRef.current) {
        setScanning(true);
        setStarting(false);
      }
    } catch (error) {
      scannerRef.current = null;
      try {
        scanner.clear();
      } catch {
        // ignore
      }
      if (mountedRef.current) {
        setCameraError(error?.message || 'Unable to access the camera.');
        setScanning(false);
        setStarting(false);
      }
    }
  }, [handleDecoded, stopScanner]);

  useEffect(() => {
    mountedRef.current = true;
    startScanner();
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const whenLabel = formatEventWhen(pendingConfirm?.event);
  const attendanceOpen = pendingConfirm?.event?.attendance_open !== false;
  const opensAtLabel = pendingConfirm?.event?.check_in_opens_at
    ? format(parseISO(pendingConfirm.event.check_in_opens_at), 'EEEE, MMM d · h:mm a')
    : null;

  let overlayLabel = null;
  if (busy) {
    overlayLabel = 'Checking in…';
  } else if (loadingEvent) {
    overlayLabel = 'Loading event…';
  } else if (starting && !cameraError) {
    overlayLabel = 'Starting camera…';
  } else if ((lastResult || pendingConfirm) && !scanning) {
    overlayLabel = pendingConfirm
      ? 'Confirm the event below'
      : 'Camera paused — tap Scan another';
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <QrCode className="w-6 h-6 text-primary" />
          Scan QR
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Point your camera at an event QR code, then confirm before checking in.
        </p>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Camera</CardTitle>
          <CardDescription>
            You will review the event details before attendance is recorded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border bg-black/90 min-h-[280px]">
            <div key={scannerKey} id={SCANNER_ELEMENT_ID} className="w-full" />
            {overlayLabel ? (
              <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white/80">
                {overlayLabel}
              </div>
            ) : null}
          </div>

          {cameraError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm text-destructive">{cameraError}</p>
              <Button onClick={startScanner} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" /> Try again
              </Button>
            </div>
          ) : null}

          {pendingConfirm ? (
            <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Confirm check-in
                </p>
                <p className="text-base font-semibold leading-tight">
                  {pendingConfirm.event?.title || 'Event'}
                </p>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                {whenLabel ? (
                  <p className="flex items-start gap-2">
                    <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{whenLabel}</span>
                  </p>
                ) : null}
                {pendingConfirm.event?.location ? (
                  <p className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{pendingConfirm.event.location}</span>
                  </p>
                ) : null}
              </div>

              {!attendanceOpen ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  Attendance opens{opensAtLabel ? ` at ${opensAtLabel}` : ' later'}.
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={startScanner}
                  disabled={busy}
                >
                  <X className="w-4 h-4" />
                  Wrong event
                </Button>
                <Button
                  className="gap-2"
                  onClick={confirmCheckIn}
                  disabled={busy || !attendanceOpen}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {busy ? 'Checking in…' : 'Confirm check-in'}
                </Button>
              </div>
            </div>
          ) : null}

          {lastResult && !pendingConfirm ? (
            <div
              className={`rounded-xl border p-4 space-y-2 ${
                lastResult.status === 'error'
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'border-emerald-500/30 bg-emerald-500/10'
              }`}
            >
              <div className="flex items-start gap-2">
                {lastResult.status !== 'error' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : null}
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-sm">{lastResult.message}</p>
                  {lastResult.eventTitle ? (
                    <p className="text-sm text-muted-foreground">{lastResult.eventTitle}</p>
                  ) : null}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={startScanner}
                disabled={busy || starting || loadingEvent}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Scan another
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
