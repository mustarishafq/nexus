import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  drawWatermarkOnCanvas,
  drawVideoFrameWithWatermark,
  loadWatermarkLogo,
  normalizeAttendanceWatermarkConfig,
} from '@/lib/watermarkConfig';

const PREVIEW_DEVICES = {
  mobile: {
    id: 'mobile',
    label: 'Mobile',
    width: 390,
    height: 520,
    icon: Smartphone,
    radius: '1.5rem',
  },
  desktop: {
    id: 'desktop',
    label: 'Desktop',
    width: 720,
    height: 480,
    icon: Monitor,
    radius: '0.75rem',
  },
};

const PREVIEW_SOURCES = {
  sample: { id: 'sample', label: 'Sample scene' },
  camera: { id: 'camera', label: 'Live selfie' },
};

const SAMPLE_CONTEXT = {
  userName: 'Alex Morgan',
  capturedAt: new Date('2026-06-21T14:30:45'),
  timezone: 'America/New_York',
  locationLabel: 'Market Street, San Francisco',
  latitude: 40.7128,
  longitude: -74.006,
  deviceInfo: {
    device_type: 'mobile',
    operating_system: 'iOS',
    browser: 'Safari',
  },
};

function SamplePreviewCanvas({ settings, width, height }) {
  const canvasRef = useRef(null);
  const config = useMemo(() => normalizeAttendanceWatermarkConfig(settings), [settings]);
  const [logoImage, setLogoImage] = useState(null);

  useEffect(() => {
    if (!config.show_logo || !config.logo_url) {
      setLogoImage(null);
      return undefined;
    }

    let active = true;
    setLogoImage(null);

    loadWatermarkLogo(config.logo_url).then((image) => {
      if (active) setLogoImage(image);
    });

    return () => {
      active = false;
    };
  }, [config.show_logo, config.logo_url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1e293b');
    gradient.addColorStop(0.5, '#334155');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.38, Math.min(width, height) * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = `600 ${Math.round(width * 0.04)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Camera preview', width * 0.5, height * 0.39);
    ctx.font = `400 ${Math.round(width * 0.028)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('Sample face / scene area', width * 0.5, height * 0.46);

    drawWatermarkOnCanvas(ctx, canvas, config, SAMPLE_CONTEXT, logoImage);
  }, [config, width, height, logoImage]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block h-full w-full"
    />
  );
}

async function openSelfieStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not supported in this browser.');
  }

  const baseVideo = {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: baseVideo,
    });
  } catch (error) {
    if (error?.name === 'OverconstrainedError' || error?.name === 'ConstraintNotSatisfiedError') {
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    }
    throw error;
  }
}

function waitForVideoReady(video, timeoutMs = 12000) {
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

function LiveSelfiePreviewCanvas({ settings, width, height }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const logoImageRef = useRef(null);
  const configRef = useRef(normalizeAttendanceWatermarkConfig(settings));
  const contextRef = useRef({
    ...SAMPLE_CONTEXT,
    capturedAt: new Date(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || SAMPLE_CONTEXT.timezone,
  });
  const displayAspectRef = useRef(width / height);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  configRef.current = normalizeAttendanceWatermarkConfig(settings);
  displayAspectRef.current = width / height;

  useEffect(() => {
    const interval = window.setInterval(() => {
      contextRef.current = {
        ...contextRef.current,
        capturedAt: new Date(),
      };
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!configRef.current.show_logo || !configRef.current.logo_url) {
      logoImageRef.current = null;
      return undefined;
    }

    let active = true;
    loadWatermarkLogo(configRef.current.logo_url).then((image) => {
      if (active) logoImageRef.current = image;
    });

    return () => {
      active = false;
    };
  }, [settings]);

  const stopCamera = useCallback(() => {
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

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }

    if (video.readyState < 2) {
      frameRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    setStatus((current) => (current === 'loading' ? 'live' : current));

    const ctx = canvas.getContext('2d');
    drawVideoFrameWithWatermark(
      ctx,
      canvas,
      video,
      configRef.current,
      contextRef.current,
      displayAspectRef.current,
      logoImageRef.current,
      true,
    );
    frameRef.current = requestAnimationFrame(drawFrame);
  }, []);

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      stopCamera();
      setStatus('loading');
      setError('');

      try {
        const stream = await openSelfieStream();
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          throw new Error('Camera element is not ready.');
        }

        video.srcObject = stream;
        await waitForVideoReady(video);

        if (!active) {
          return;
        }

        frameRef.current = requestAnimationFrame(drawFrame);
      } catch (cameraError) {
        if (!active) return;
        stopCamera();
        setStatus('error');
        setError(cameraError?.message || 'Unable to access the camera.');
      }
    };

    startCamera();

    return () => {
      active = false;
      stopCamera();
    };
  }, [drawFrame, stopCamera, width, height]);

  return (
    <div className="relative h-full w-full bg-black">
      <video ref={videoRef} playsInline muted autoPlay className="hidden" />
      <canvas ref={canvasRef} className="block h-full w-full" />

      {status === 'loading' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-xs">Starting camera…</span>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-xs text-white">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default function WatermarkLivePreview({ settings, className = '' }) {
  const [device, setDevice] = useState('mobile');
  const [previewSource, setPreviewSource] = useState('sample');
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(0.6);
  const frame = PREVIEW_DEVICES[device];

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;

    const updateScale = () => {
      const { width, height } = element.getBoundingClientRect();
      const padding = 24;
      const scaleX = (width - padding) / frame.width;
      const scaleY = (height - padding) / frame.height;
      setScale(Math.max(0.25, Math.min(scaleX, scaleY, 1)));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [frame.width, frame.height]);

  const scaledWidth = Math.round(frame.width * scale);
  const scaledHeight = Math.round(frame.height * scale);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-2 gap-2">
        {Object.values(PREVIEW_DEVICES).map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={device === item.id ? 'default' : 'outline'}
              onClick={() => setDevice(item.id)}
              className="h-9 w-full gap-2"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Object.values(PREVIEW_SOURCES).map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={previewSource === item.id ? 'default' : 'outline'}
            onClick={() => setPreviewSource(item.id)}
            className="h-9 w-full gap-2"
          >
            {item.id === 'camera' ? <Camera className="h-4 w-4 shrink-0" /> : null}
            {item.label}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {previewSource === 'camera'
          ? 'Live selfie shows your real camera with the watermark caption overlaid. Sample name and location are used here.'
          : 'Sample scene uses placeholder graphics with example name and location data.'}
      </p>

      <div
        ref={viewportRef}
        className="flex min-h-[220px] items-center justify-center rounded-2xl border bg-muted/20 p-3 sm:min-h-[320px] sm:p-4"
      >
        <div
          className="relative overflow-hidden border bg-black shadow-2xl"
          style={{
            width: scaledWidth,
            height: scaledHeight,
            borderRadius: frame.radius,
          }}
        >
          <div
            className="origin-top-left"
            style={{
              width: frame.width,
              height: frame.height,
              transform: `scale(${scale})`,
            }}
          >
            {previewSource === 'camera' ? (
              <LiveSelfiePreviewCanvas
                key={`camera-${device}`}
                settings={settings}
                width={frame.width}
                height={frame.height}
              />
            ) : (
              <SamplePreviewCanvas settings={settings} width={frame.width} height={frame.height} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
