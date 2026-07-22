import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, LogIn, LogOut, RefreshCw, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ATTENDANCE_SELFIE_FILTERS,
  buildWatermarkLines,
  captureCanvasWithWatermark,
  drawVideoFrameWithWatermark,
  getCurrentLocation,
  loadWatermarkLogo,
  normalizeAttendanceWatermarkConfig,
  reverseGeocodeAddress,
  startLocationWatch,
} from '@/lib/watermarkConfig';
import { resolveAttendanceSiteLabel } from '@/lib/attendancePolicy';

const CAMERA_START_TIMEOUT_MS = 12000;
const LIVE_DRAW_INTERVAL_MS = 50;
const FILTER_STORAGE_KEY = 'attendance-camera-filter';

function readFilterPreference() {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (ATTENDANCE_SELFIE_FILTERS.some((filter) => filter.id === stored)) {
      return stored;
    }
  } catch {
    // Ignore storage errors (private browsing, etc.).
  }
  return 'none';
}

function persistFilterPreference(filterId) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, filterId);
  } catch {
    // Ignore storage errors (private browsing, etc.).
  }
}

function waitForVideoReady(video, timeoutMs = CAMERA_START_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Camera timed out. Check browser permissions and try again.'));
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('Camera failed to start.'));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('error', onError);

    const playPromise = video.play();
    if (playPromise?.catch) {
      playPromise.catch(onError);
    }
  });
}

async function openCameraStream(facingMode) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not supported in this browser.');
  }

  const baseVideo = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...baseVideo, facingMode },
    });
  } catch (error) {
    if (error?.name === 'OverconstrainedError' || error?.name === 'ConstraintNotSatisfiedError') {
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: baseVideo,
      });
    }
    throw error;
  }
}

export default function AttendanceCamera({
  watermarkConfig,
  userName,
  deviceInfo,
  attendanceSites = [],
  siteRadiusMeters = 200,
  onCapture,
  onSubmit,
  actionType = 'clock_in',
  submitting = false,
  canSubmit = false,
  disabled = false,
  className = '',
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const lastDrawAtRef = useRef(0);
  const displayAspectRef = useRef(3 / 4);
  const logoImageRef = useRef(null);
  const locationRef = useRef({
    latitude: null,
    longitude: null,
    locationLabel: null,
    locatingAddress: false,
    locatingPosition: true,
    locationError: null,
  });
  const userNameRef = useRef(userName);
  const deviceInfoRef = useRef(deviceInfo);
  const attendanceSitesRef = useRef(attendanceSites);
  const siteRadiusRef = useRef(siteRadiusMeters);
  attendanceSitesRef.current = attendanceSites;
  siteRadiusRef.current = siteRadiusMeters;

  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [facingMode, setFacingMode] = useState('user');
  const [selfieFilter, setSelfieFilter] = useState(readFilterPreference);
  const [previewUrl, setPreviewUrl] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [locationTick, setLocationTick] = useState(0);
  // Front camera mirrors like a selfie; rear camera stays unmirrored.
  const mirrorPreview = facingMode === 'user';
  const mirrorRef = useRef(mirrorPreview);
  mirrorRef.current = mirrorPreview;
  const filterRef = useRef(selfieFilter);
  filterRef.current = selfieFilter;

  const config = useMemo(
    () => normalizeAttendanceWatermarkConfig(watermarkConfig),
    [watermarkConfig],
  );
  const configRef = useRef(config);
  configRef.current = config;
  userNameRef.current = userName;
  deviceInfoRef.current = deviceInfo;

  const buildContext = useCallback((capturedAt = new Date()) => ({
    userName: userNameRef.current,
    capturedAt,
    timezone: deviceInfoRef.current?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    locationLabel: locationRef.current.locationLabel,
    latitude: locationRef.current.latitude,
    longitude: locationRef.current.longitude,
    locatingAddress: locationRef.current.locatingAddress,
    locatingPosition: locationRef.current.locatingPosition,
    deviceInfo: deviceInfoRef.current,
  }), []);

  const stopStream = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);

  const drawLiveFrame = useCallback((timestamp = performance.now()) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState < 2) {
      frameRef.current = requestAnimationFrame(drawLiveFrame);
      return;
    }

    if (timestamp - lastDrawAtRef.current >= LIVE_DRAW_INTERVAL_MS) {
      lastDrawAtRef.current = timestamp;
      const ctx = canvas.getContext('2d');
      drawVideoFrameWithWatermark(
        ctx,
        canvas,
        video,
        configRef.current,
        buildContext(),
        displayAspectRef.current,
        logoImageRef.current,
        mirrorRef.current,
        filterRef.current,
        false,
      );
    }

    frameRef.current = requestAnimationFrame(drawLiveFrame);
  }, [buildContext]);

  const startCamera = useCallback(async () => {
    stopStream();
    setStatus('loading');
    setError('');

    try {
      const stream = await openCameraStream(facingMode);
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('Camera element is not ready.');
      }

      video.srcObject = stream;
      await waitForVideoReady(video);

      setStatus('live');
      frameRef.current = requestAnimationFrame(drawLiveFrame);
    } catch (cameraError) {
      stopStream();
      setStatus('error');
      setError(cameraError?.message || 'Unable to access the camera.');
    }
  }, [facingMode, stopStream, drawLiveFrame]);

  useEffect(() => {
    if (!config.show_logo || !config.logo_url) {
      logoImageRef.current = null;
      return undefined;
    }

    let active = true;
    loadWatermarkLogo(config.logo_url).then((image) => {
      if (active) {
        logoImageRef.current = image;
        setLocationTick((tick) => tick + 1);
      }
    });

    return () => {
      active = false;
    };
  }, [config.show_logo, config.logo_url]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;

    const updateAspect = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) {
        displayAspectRef.current = width / height;
      }
    };

    updateAspect();
    const observer = new ResizeObserver(updateAspect);
    observer.observe(element);
    window.addEventListener('resize', updateAspect);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateAspect);
    };
  }, []);

  useEffect(() => {
    let active = true;

    startCamera().finally(() => {
      if (!active) {
        stopStream();
      }
    });

    return () => {
      active = false;
      stopStream();
    };
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const resolveSiteLabel = (latitude, longitude) => (
      resolveAttendanceSiteLabel(
        attendanceSitesRef.current,
        latitude,
        longitude,
        siteRadiusRef.current,
      )
    );

    const stopWatch = startLocationWatch(
      (location) => {
        const previous = locationRef.current;
        locationRef.current = {
          ...locationRef.current,
          ...location,
        };

        if (
          previous.locationLabel !== location.locationLabel
          || previous.locatingAddress !== location.locatingAddress
          || previous.locatingPosition !== location.locatingPosition
          || previous.locationError !== location.locationError
        ) {
          setLocationTick((tick) => tick + 1);
        }
      },
      () => {
        locationRef.current = {
          ...locationRef.current,
          locatingPosition: false,
          locatingAddress: false,
        };
        setLocationTick((tick) => tick + 1);
      },
      { resolveLabel: resolveSiteLabel },
    );

    return () => stopWatch();
  }, []);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || capturing || disabled || status !== 'live') return;

    setCapturing(true);
    try {
      let location = { ...locationRef.current };
      if (location.latitude == null || location.longitude == null) {
        location = await getCurrentLocation();
        locationRef.current = location;
        setLocationTick((tick) => tick + 1);
      }

      const siteLabel = resolveAttendanceSiteLabel(
        attendanceSitesRef.current,
        location.latitude,
        location.longitude,
        siteRadiusRef.current,
      );

      if (siteLabel) {
        location = { ...location, locationLabel: siteLabel };
      } else if (location.locationLabel == null && !location.locatingAddress) {
        const locationLabel = await reverseGeocodeAddress(location.latitude, location.longitude);
        location = { ...location, locationLabel };
      }

      locationRef.current = location;
      setLocationTick((tick) => tick + 1);

      const capturedAt = new Date();
      const context = {
        ...buildContext(capturedAt),
        locationLabel: location.locationLabel,
        latitude: location.latitude,
        longitude: location.longitude,
        locatingAddress: false,
        locatingPosition: false,
      };

      const blob = await captureCanvasWithWatermark(
        video,
        configRef.current,
        context,
        displayAspectRef.current,
        logoImageRef.current,
        mirrorRef.current,
        filterRef.current,
      );
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setStatus('preview');
      stopStream();

      await onCapture?.({
        blob,
        previewUrl: url,
        location,
        watermarkLines: buildWatermarkLines(configRef.current, context),
        capturedAt: capturedAt.toISOString(),
      });
    } catch (captureError) {
      setError(captureError?.message || 'Failed to capture photo.');
      setStatus('error');
    } finally {
      setCapturing(false);
    }
  };

  const retake = async () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    onCapture?.(null);
    await startCamera();
  };

  const toggleCamera = () => {
    setFacingMode((current) => (current === 'user' ? 'environment' : 'user'));
  };

  const handleFilterChange = (filterId) => {
    setSelfieFilter(filterId);
    persistFilterPreference(filterId);
  };

  const watermarkLines = useMemo(
    () => buildWatermarkLines(config, buildContext()),
    [config, buildContext, locationTick],
  );

  const isClockIn = actionType === 'clock_in';
  const ActionIcon = isClockIn ? LogIn : LogOut;
  const actionLabel = isClockIn ? 'Clock In' : 'Clock Out';
  const busy = capturing || submitting;
  const controlsLocked = disabled || busy;
  const hasPreview = status === 'preview';

  return (
    <div className={cn('min-w-0 max-w-full overflow-x-hidden', className)}>
      <div
        ref={viewportRef}
        className={cn(
          'relative mx-auto w-full max-w-full overflow-hidden bg-black',
          // Fill the parent card; controls sit inside the frame as an overlay.
          'aspect-[3/4] max-h-[min(72dvh,36rem)] sm:max-h-none sm:aspect-[4/3]',
        )}
      >
        <video ref={videoRef} playsInline muted autoPlay className="hidden" />

        {hasPreview && previewUrl ? (
          <img
            src={previewUrl}
            alt="Captured attendance photo"
            className="absolute inset-0 block h-full w-full max-w-full object-cover"
          />
        ) : (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 block h-full w-full max-w-full object-cover"
          />
        )}

        {status === 'loading' ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Starting camera…</span>
          </div>
        ) : null}

        {hasPreview && submitting ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/65 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm font-medium">
              {isClockIn ? 'Clocking in…' : 'Clocking out…'}
            </span>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
            <p className="text-sm">{error || 'Camera unavailable'}</p>
            <Button type="button" variant="secondary" size="sm" onClick={startCamera} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Retry camera
            </Button>
          </div>
        ) : null}

        {status !== 'error' && status !== 'loading' ? (
          <>
            {/* Top: filters + flip */}
            {!hasPreview ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/50 via-black/15 to-transparent pb-12">
                <div className="pointer-events-auto flex items-center gap-2 px-3 pt-3 sm:px-4 sm:pt-4">
                  <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex h-10 w-max items-center gap-1.5" role="listbox" aria-label="Selfie filters">
                      {ATTENDANCE_SELFIE_FILTERS.map((filter) => {
                        const selected = selfieFilter === filter.id;
                        return (
                          <button
                            key={filter.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            disabled={controlsLocked || status !== 'live'}
                            onClick={() => handleFilterChange(filter.id)}
                            className={cn(
                              'inline-flex h-8 touch-manipulation items-center justify-center rounded-full border px-3 text-center text-xs font-medium transition-all',
                              'shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl',
                              'disabled:pointer-events-none disabled:opacity-50',
                              selected
                                ? 'border-white/55 bg-white/35 text-white'
                                : 'border-white/20 bg-white/10 text-white/90 hover:border-white/35 hover:bg-white/18',
                            )}
                          >
                            {filter.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleCamera}
                    disabled={controlsLocked || status !== 'live'}
                    aria-label="Flip camera"
                    className={cn(
                      'inline-flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-full',
                      'border border-white/25 bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
                      'backdrop-blur-xl transition-all hover:border-white/40 hover:bg-white/20',
                      'disabled:pointer-events-none disabled:opacity-50',
                    )}
                  >
                    <SwitchCamera className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* Bottom: shutter / confirm actions */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/55 via-black/15 to-transparent pt-16">
              <div className="pointer-events-auto px-4 pb-4 sm:pb-5">
                {hasPreview ? (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={retake}
                      disabled={controlsLocked}
                      className={cn(
                        'inline-flex h-12 min-w-[7rem] touch-manipulation items-center justify-center gap-2 rounded-full',
                        'border border-white/25 bg-white/12 px-5 text-sm font-medium text-white',
                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl',
                        'transition-all hover:border-white/40 hover:bg-white/20',
                        'disabled:pointer-events-none disabled:opacity-50',
                      )}
                    >
                      {capturing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Retake
                    </button>

                    <button
                      type="button"
                      onClick={() => onSubmit?.()}
                      disabled={controlsLocked || !canSubmit}
                      className={cn(
                        'inline-flex h-12 min-w-[9rem] touch-manipulation items-center justify-center gap-2 rounded-full',
                        'border border-primary/40 bg-primary/75 px-6 text-sm font-semibold text-primary-foreground',
                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-xl',
                        'transition-all hover:bg-primary/85 disabled:pointer-events-none disabled:opacity-50',
                      )}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ActionIcon className="h-4 w-4" />
                      )}
                      {submitting
                        ? (isClockIn ? 'Clocking in…' : 'Clocking out…')
                        : actionLabel}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleCapture}
                      disabled={controlsLocked || status !== 'live'}
                      aria-label={capturing ? 'Capturing photo' : 'Take photo'}
                      className={cn(
                        'group relative flex h-[4.5rem] w-[4.5rem] touch-manipulation items-center justify-center rounded-full',
                        'border border-white/45 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_24px_rgba(0,0,0,0.25)]',
                        'backdrop-blur-xl transition-all active:scale-95',
                        'hover:border-white/60 hover:bg-white/16',
                        'disabled:pointer-events-none disabled:opacity-50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-[3.4rem] w-[3.4rem] items-center justify-center rounded-full',
                          'border border-white/35 bg-white/25 text-white',
                          'shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-md',
                          'transition-colors group-hover:bg-white/35',
                        )}
                      >
                        {capturing ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Camera className="h-5 w-5" />
                        )}
                      </span>
                    </button>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium tracking-wide text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl">
                      {capturing ? 'Capturing…' : 'Take photo'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {hasPreview && watermarkLines.length ? (
        <div className="hidden space-y-3 border-t p-3 text-xs text-muted-foreground sm:block sm:p-4">
          <div className="rounded-xl border bg-muted/20 p-3">
            <p className="mb-1 font-medium text-foreground">Watermark on photo</p>
            {locationRef.current.locationError != null && locationRef.current.latitude == null ? (
              <p className="mb-2 text-amber-600 dark:text-amber-400">
                Location permission is required for address and GPS lines in the watermark.
              </p>
            ) : null}
            {watermarkLines.map((line) => (
              <div key={line} className="break-words">{line}</div>
            ))}
          </div>
        </div>
      ) : null}

      {status === 'live'
        && locationRef.current.locationError != null
        && locationRef.current.latitude == null ? (
          <p className="border-t px-3 py-2 text-xs text-amber-600 dark:text-amber-400 sm:hidden">
            Location permission is required for address and GPS lines in the watermark.
          </p>
        ) : null}
    </div>
  );
}
