// @ts-nocheck
import db from '@/api/apiClient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Clock, MapPin, Minus, Plus, QrCode, RefreshCw, X } from 'lucide-react';
import ExpActionHint from '@/components/gamification/ExpActionHint';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { notifyGamificationOffers } from '@/lib/gamification';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import EventCheckInAnswersFields from '@/components/calendar/EventCheckInAnswersFields';
import { emptyCheckInAnswers, staffMustFillCheckInForm } from '@/lib/eventCheckInForm';

const SCANNER_ELEMENT_ID = 'nexus-event-qr-scanner';
const ZOOM_DECODER_ELEMENT_ID = 'nexus-event-qr-zoom-decoder';
const DIGITAL_ZOOM = { mode: 'digital', min: 1, max: 4, step: 0.1, value: 1 };
const DIGITAL_ZOOM_SCAN_MS = 350;
const VIDEO_READY_TIMEOUT_MS = 8000;

function waitForNextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function waitForScannerVideo(host, timeoutMs = VIDEO_READY_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      const video = host?.querySelector('video');
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        const playPromise = video.play?.();
        if (playPromise?.catch) {
          playPromise.catch(() => {});
        }
        resolve(video);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Camera preview timed out. Try again.'));
        return;
      }

      window.requestAnimationFrame(check);
    };

    check();
  });
}

/**
 * Hardware zoom of the running camera track, when the browser/device exposes
 * it (most Android Chrome devices; many iPhones and desktop webcams do not).
 */
function readZoomCapability(scanner) {
  try {
    const zoom = scanner?.getRunningTrackCameraCapabilities?.()?.zoomFeature?.();
    if (!zoom?.isSupported?.()) {
      return { ...DIGITAL_ZOOM };
    }
    const min = Number(zoom.min());
    const max = Number(zoom.max());
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      return { ...DIGITAL_ZOOM };
    }
    const step = Number(zoom.step()) || 0.1;
    const value = Number(zoom.value()) || min;
    return { mode: 'hardware', feature: zoom, min, max, step, value };
  } catch {
    return { ...DIGITAL_ZOOM };
  }
}

/**
 * Digital zoom fallback: crop the centre of the camera frame at full sensor
 * resolution. html5-qrcode's own loop shrinks its scan box to a 240px canvas,
 * so this crop gives the decoder far more pixels for small or distant codes.
 */
async function captureZoomedFrame(video, zoomLevel) {
  if (!video?.videoWidth || !video?.videoHeight) return null;

  const side = Math.min(video.videoWidth, video.videoHeight) / zoomLevel;
  const sx = (video.videoWidth - side) / 2;
  const sy = (video.videoHeight - side) / 2;
  const output = Math.round(Math.min(1024, Math.max(side, 480)));

  const canvas = document.createElement('canvas');
  canvas.width = output;
  canvas.height = output;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(video, sx, sy, side, side, 0, 0, output, output);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  return blob ? new File([blob], 'zoom-frame.jpg', { type: 'image/jpeg' }) : null;
}

function touchDistance(touches) {
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scannerRef = useRef(null);
  const handlingRef = useRef(false);
  const mountedRef = useRef(true);
  const startGenerationRef = useRef(0);
  const [cameraError, setCameraError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(true);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [scannerSession, setScannerSession] = useState(0);
  const [answers, setAnswers] = useState({});
  // { mode: 'hardware' | 'digital', min, max, step, value, feature? } while the camera runs.
  const [zoom, setZoom] = useState(null);
  const zoomDecoderRef = useRef(null);
  const zoomRef = useRef(null);
  zoomRef.current = zoom;
  const pinchRef = useRef(null);
  const zoomApplyRef = useRef({ inFlight: false, pending: null });

  const refreshCalendarViews = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-events-week'] });
  }, [queryClient]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    pinchRef.current = null;
    if (mountedRef.current) {
      setZoom(null);
    }
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

  // Apply zoom without queueing a constraint per slider tick: keep only the
  // latest requested value while one apply() is in flight.
  const applyZoom = useCallback((requested) => {
    const current = zoomRef.current;
    if (!current) return;

    const steps = Math.round((requested - current.min) / current.step);
    const value = Math.min(current.max, Math.max(current.min, current.min + steps * current.step));
    setZoom((state) => (state ? { ...state, value } : state));
    if (current.mode !== 'hardware') return;

    const queue = zoomApplyRef.current;
    queue.pending = value;
    if (queue.inFlight) return;

    const flush = async () => {
      queue.inFlight = true;
      while (queue.pending != null) {
        const next = queue.pending;
        queue.pending = null;
        try {
          await current.feature.apply(next);
        } catch {
          // Some devices report zoom but reject certain values; keep the UI responsive.
        }
      }
      queue.inFlight = false;
    };
    flush();
  }, []);

  const handlePinchStart = useCallback((event) => {
    if (event.touches.length !== 2 || !zoomRef.current) return;
    pinchRef.current = { distance: touchDistance(event.touches), zoom: zoomRef.current.value };
  }, []);

  const handlePinchMove = useCallback((event) => {
    const pinch = pinchRef.current;
    if (!pinch || event.touches.length !== 2) return;
    const ratio = touchDistance(event.touches) / Math.max(1, pinch.distance);
    applyZoom(pinch.zoom * ratio);
  }, [applyZoom]);

  const handlePinchEnd = useCallback((event) => {
    if (event.touches.length < 2) {
      pinchRef.current = null;
    }
  }, []);

  const digitalZoomLevel = zoom?.mode === 'digital' ? zoom.value : 1;

  // Digital zoom preview: scale the video around its centre (the scan box).
  useEffect(() => {
    const video = document.getElementById(SCANNER_ELEMENT_ID)?.querySelector('video');
    if (!video) return undefined;
    video.style.transformOrigin = 'center center';
    video.style.transform = digitalZoomLevel > 1 ? `scale(${digitalZoomLevel})` : '';
    return () => {
      video.style.transform = '';
    };
  }, [digitalZoomLevel, scanning, scannerKey]);

  // Digital zoom decode loop: runs alongside html5-qrcode's own loop.
  useEffect(() => {
    if (!scanning || digitalZoomLevel <= 1) return undefined;

    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const video = document.getElementById(SCANNER_ELEMENT_ID)?.querySelector('video');
        const file = await captureZoomedFrame(video, digitalZoomLevel);
        if (file && !cancelled && !handlingRef.current) {
          if (!zoomDecoderRef.current) {
            zoomDecoderRef.current = new Html5Qrcode(ZOOM_DECODER_ELEMENT_ID, { verbose: false });
          }
          const result = await zoomDecoderRef.current.scanFileV2(file, false);
          if (!cancelled && result?.decodedText) {
            handleDecodedRef.current(result.decodedText);
            return;
          }
        }
      } catch {
        // No code in this frame — keep trying.
      }
      if (!cancelled) {
        timer = window.setTimeout(tick, DIGITAL_ZOOM_SCAN_MS);
      }
    };

    timer = window.setTimeout(tick, DIGITAL_ZOOM_SCAN_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [scanning, digitalZoomLevel]);

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
      const fields = event?.check_in_form?.fields;
      const nextAnswers = emptyCheckInAnswers(fields);
      if (nextAnswers.name !== undefined) {
        nextAnswers.name = user?.full_name || user?.name || '';
      }
      setAnswers(nextAnswers);
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
  }, [stopScanner, user]);

  const handleDecodedRef = useRef(handleDecoded);
  handleDecodedRef.current = handleDecoded;

  const confirmCheckIn = useCallback(async () => {
    if (!pendingConfirm?.token || busy) {
      return;
    }

    setBusy(true);

    try {
      const data = await db.eventCheckIn.checkInMe(pendingConfirm.token, { answers });
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
      notifyGamificationOffers(data);
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
  }, [answers, busy, pendingConfirm, refreshCalendarViews]);

  const startScanner = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }

    setCameraError(null);
    setLastResult(null);
    setPendingConfirm(null);
    setAnswers({});
    setLoadingEvent(false);
    setStarting(true);
    setScanning(false);
    setBusy(false);
    handlingRef.current = false;

    await stopScanner();

    if (!mountedRef.current) {
      return;
    }

    // Remount the scanner host, then start after React commits it.
    setScannerKey(Date.now());
    setScannerSession((value) => value + 1);
  }, [stopScanner]);

  useEffect(() => {
    mountedRef.current = true;
    startScanner();
    return () => {
      mountedRef.current = false;
      startGenerationRef.current += 1;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scannerSession === 0) {
      return undefined;
    }

    let cancelled = false;
    const generation = ++startGenerationRef.current;

    const cleanupScanner = async (scanner) => {
      try {
        if (scanner?.isScanning) {
          await scanner.stop();
        }
      } catch {
        // ignore
      }
      try {
        scanner?.clear();
      } catch {
        // ignore
      }
    };

    const startOnHost = async (host) => {
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
            handleDecodedRef.current(decodedText);
          },
          () => {}
        );
      } catch (firstError) {
        // Some devices reject environment-only constraints on first open.
        await cleanupScanner(scanner);
        if (cancelled || !mountedRef.current || generation !== startGenerationRef.current) {
          throw firstError;
        }

        const fallback = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = fallback;
        try {
          await fallback.start(
            { facingMode: { ideal: 'environment' } },
            {
              fps: 8,
              qrbox: { width: 240, height: 240 },
              aspectRatio: 1,
            },
            (decodedText) => {
              handleDecodedRef.current(decodedText);
            },
            () => {}
          );
        } catch {
          await cleanupScanner(fallback);
          scannerRef.current = null;
          throw firstError;
        }
      }

      if (cancelled || !mountedRef.current || generation !== startGenerationRef.current) {
        await cleanupScanner(scannerRef.current);
        if (scannerRef.current) {
          scannerRef.current = null;
        }
        return false;
      }

      // start() can resolve before the preview paints (esp. first open / WebView).
      await waitForScannerVideo(host);

      if (cancelled || !mountedRef.current || generation !== startGenerationRef.current) {
        return false;
      }

      setScanning(true);
      setStarting(false);
      setZoom(readZoomCapability(scannerRef.current));
      return true;
    };

    const run = async () => {
      // Wait for the remounted scanner host to be in the DOM with layout.
      await waitForNextPaint();
      if (cancelled || !mountedRef.current || generation !== startGenerationRef.current) {
        return;
      }

      let lastError = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (cancelled || !mountedRef.current || generation !== startGenerationRef.current) {
          return;
        }

        if (attempt > 0) {
          await stopScanner();
          if (!mountedRef.current || generation !== startGenerationRef.current) {
            return;
          }
          setScannerKey(Date.now());
          await waitForNextPaint();
          // Give WebView/camera stack a beat before retrying the first-open blank case.
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }

        const host = document.getElementById(SCANNER_ELEMENT_ID);
        if (!host) {
          lastError = new Error('Camera view is not ready. Try again.');
          continue;
        }

        try {
          const started = await startOnHost(host);
          if (started) {
            return;
          }
          return;
        } catch (error) {
          lastError = error;
          if (scannerRef.current) {
            await cleanupScanner(scannerRef.current);
            scannerRef.current = null;
          }
        }
      }

      if (!cancelled && mountedRef.current && generation === startGenerationRef.current) {
        setCameraError(lastError?.message || 'Unable to access the camera.');
        setScanning(false);
        setStarting(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [scannerSession, stopScanner]);

  const whenLabel = formatEventWhen(pendingConfirm?.event);
  const attendanceOpen = pendingConfirm?.event?.attendance_open !== false;
  const opensAtLabel = pendingConfirm?.event?.check_in_opens_at
    ? format(parseISO(pendingConfirm.event.check_in_opens_at), 'EEEE, MMM d · h:mm a')
    : null;
  const pendingForm = pendingConfirm?.event?.check_in_form;
  const staffFillsForm = staffMustFillCheckInForm(pendingForm);
  const pendingFields = Array.isArray(pendingForm?.fields) ? pendingForm.fields : [];

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
          <div
            className="relative overflow-hidden rounded-xl border bg-black/90 min-h-[280px]"
            // pan-y keeps page scrolling but stops the browser's own pinch-zoom here.
            style={zoom ? { touchAction: 'pan-y' } : undefined}
            onTouchStart={zoom ? handlePinchStart : undefined}
            onTouchMove={zoom ? handlePinchMove : undefined}
            onTouchEnd={zoom ? handlePinchEnd : undefined}
            onTouchCancel={zoom ? handlePinchEnd : undefined}
          >
            <div
              key={scannerKey}
              id={SCANNER_ELEMENT_ID}
              className="relative w-full min-h-[280px] [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_img]:absolute [&_img]:inset-0 [&_img]:h-full [&_img]:w-full"
            />
            {overlayLabel ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-sm text-white/80 bg-black/40">
                {overlayLabel}
              </div>
            ) : null}
          </div>
          {zoom && scanning ? (
            <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-2 py-1.5">
              <button
                type="button"
                onClick={() => applyZoom(zoom.value - Math.max(zoom.step, (zoom.max - zoom.min) / 10))}
                disabled={zoom.value <= zoom.min}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted disabled:opacity-40"
                aria-label="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={zoom.min}
                max={zoom.max}
                step={zoom.step}
                value={zoom.value}
                onChange={(event) => applyZoom(Number(event.target.value))}
                className="h-1 min-w-0 flex-1 cursor-pointer accent-primary"
                aria-label="Camera zoom"
              />
              <button
                type="button"
                onClick={() => applyZoom(zoom.value + Math.max(zoom.step, (zoom.max - zoom.min) / 10))}
                disabled={zoom.value >= zoom.max}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted disabled:opacity-40"
                aria-label="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </button>
              <span className="w-10 shrink-0 pr-1 text-right text-xs font-medium tabular-nums text-muted-foreground">
                {(zoom.mode === 'hardware' ? zoom.value / (zoom.min || 1) : zoom.value).toFixed(1)}×
              </span>
            </div>
          ) : null}
          {/* Off-screen host for decoding digitally zoomed frames. */}
          <div id={ZOOM_DECODER_ELEMENT_ID} className="hidden" aria-hidden />

          {cameraError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm text-destructive">{cameraError}</p>
              <Button onClick={startScanner} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" /> Try again
              </Button>
            </div>
          ) : null}

          {pendingConfirm ? (
            <form
              className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                confirmCheckIn();
              }}
            >
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
                {user?.email ? (
                  <p className="text-xs">
                    Checking in as <span className="font-medium text-foreground">{user.email}</span>
                  </p>
                ) : null}
              </div>

              {!attendanceOpen ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  Attendance opens{opensAtLabel ? ` at ${opensAtLabel}` : ' later'}.
                </div>
              ) : null}

              {attendanceOpen && staffFillsForm ? (
                <EventCheckInAnswersFields
                  fields={pendingFields}
                  values={answers}
                  onChange={(key, value) => {
                    setAnswers((current) => ({ ...current, [key]: value }));
                  }}
                  disabled={busy}
                  idPrefix="scan-checkin"
                />
              ) : null}

              {attendanceOpen ? (
                <div className="flex justify-end">
                  <ExpActionHint actionKey="event_check_in" />
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={startScanner}
                  disabled={busy}
                >
                  <X className="w-4 h-4" />
                  Wrong event
                </Button>
                <Button
                  type="submit"
                  className="gap-2"
                  disabled={busy || !attendanceOpen}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {busy ? 'Checking in…' : 'Confirm check-in'}
                </Button>
              </div>
            </form>
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
