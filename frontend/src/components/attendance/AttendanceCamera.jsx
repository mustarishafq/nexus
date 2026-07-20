import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
const MIRROR_STORAGE_KEY = 'attendance-camera-mirror';
const FILTER_STORAGE_KEY = 'attendance-camera-filter';

function readMirrorPreference() {
  try {
    return localStorage.getItem(MIRROR_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function persistMirrorPreference(mirror) {
  try {
    localStorage.setItem(MIRROR_STORAGE_KEY, String(mirror));
  } catch {
    // Ignore storage errors (private browsing, etc.).
  }
}

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
  const [mirrorPreview, setMirrorPreview] = useState(readMirrorPreference);
  const [selfieFilter, setSelfieFilter] = useState(readFilterPreference);
  const [previewUrl, setPreviewUrl] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [locationTick, setLocationTick] = useState(0);
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

  const handleMirrorChange = (checked) => {
    setMirrorPreview(checked);
    persistMirrorPreference(checked);
  };

  const handleFilterChange = (filterId) => {
    setSelfieFilter(filterId);
    persistFilterPreference(filterId);
  };

  const watermarkLines = useMemo(
    () => buildWatermarkLines(config, buildContext()),
    [config, buildContext, locationTick],
  );

  return (
    <div className={cn('space-y-3', className)}>
      <div
        ref={viewportRef}
        className="relative overflow-hidden rounded-2xl border bg-black aspect-[3/4] sm:aspect-[4/3]"
      >
        <video ref={videoRef} playsInline muted autoPlay className="hidden" />

        {status === 'preview' && previewUrl ? (
          <img src={previewUrl} alt="Captured attendance photo" className="block h-full w-full" />
        ) : (
          <canvas ref={canvasRef} className="block h-full w-full" />
        )}

        {status === 'loading' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Starting camera…</span>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
            <p className="text-sm">{error || 'Camera unavailable'}</p>
            <Button type="button" variant="secondary" size="sm" onClick={startCamera} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Retry camera
            </Button>
          </div>
        ) : null}
      </div>

      {status !== 'preview' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-sm font-medium">Filter</p>
            <p className="text-xs text-muted-foreground">Applied to the saved photo</p>
          </div>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex w-max gap-2" role="listbox" aria-label="Selfie filters">
              {ATTENDANCE_SELFIE_FILTERS.map((filter) => {
                const selected = selfieFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={disabled || capturing || status !== 'live'}
                    onClick={() => handleFilterChange(filter.id)}
                    className={cn(
                      'min-w-[4.5rem] rounded-xl border px-3 py-2 text-center text-xs font-medium transition-colors',
                      'disabled:pointer-events-none disabled:opacity-50',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted',
                    )}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {status !== 'preview' ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <div className="min-w-0">
            <Label htmlFor="attendance-camera-mirror" className="text-sm font-medium">
              Mirror preview
            </Label>
            <p className="text-xs text-muted-foreground">
              Flip the camera like a selfie mirror. Your choice is remembered on this device.
            </p>
          </div>
          <Switch
            id="attendance-camera-mirror"
            checked={mirrorPreview}
            onCheckedChange={handleMirrorChange}
            disabled={disabled || capturing || status !== 'live'}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {status === 'preview' ? (
          <Button type="button" variant="outline" onClick={retake} disabled={disabled || capturing} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retake
          </Button>
        ) : (
          <>
            <Button
              type="button"
              onClick={handleCapture}
              disabled={disabled || capturing || status !== 'live'}
              className="gap-2"
            >
              {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {capturing ? 'Capturing…' : 'Capture photo'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={toggleCamera}
              disabled={disabled || capturing || status !== 'live'}
              className="gap-2"
            >
              <SwitchCamera className="h-4 w-4" /> Flip camera
            </Button>
          </>
        )}
      </div>

      {status === 'live' && watermarkLines.length ? (
        <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Watermark on photo</p>
          {locationRef.current.locationError != null && locationRef.current.latitude == null ? (
            <p className="mb-2 text-amber-600 dark:text-amber-400">
              Location permission is required for address and GPS lines in the watermark.
            </p>
          ) : null}
          {watermarkLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
