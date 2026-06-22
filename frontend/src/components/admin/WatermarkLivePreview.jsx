import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  buildWatermarkLines,
  drawWatermarkOnCanvas,
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

function PreviewCanvas({ settings, width, height }) {
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

export default function WatermarkLivePreview({ settings, className = '' }) {
  const [device, setDevice] = useState('mobile');
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
            <PreviewCanvas settings={settings} width={frame.width} height={frame.height} />
          </div>
        </div>
      </div>
    </div>
  );
}
