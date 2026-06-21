import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Play, Smartphone, Tablet, Maximize2, Layers, PanelBottom } from 'lucide-react';
import LaunchPreviewCanvas from '@/components/applications/launch-animations/LaunchPreviewCanvas';
import { useLaunchOverlayEnergy } from '@/components/applications/launch-animations/useLaunchOverlayEnergy';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useApplicationLaunch } from '@/lib/ApplicationLaunchContext';
import { DEFAULT_BRAND_COLOR } from '@/lib/imageColor';
import {
  getLaunchAnimationMeta,
  getLaunchOverlayLayoutKind,
  getLaunchOverlayLayoutLabel,
  getLaunchOverlayPlacement,
  LAUNCH_OVERLAY_PLACEMENT_LABELS,
  normalizeLaunchAnimation,
} from '@/lib/launchConfig';
import { toast } from 'sonner';

const PREVIEW_DEVICES = {
  mobile: {
    id: 'mobile',
    label: 'Mobile',
    width: 390,
    height: 844,
    icon: Smartphone,
    radius: '1.75rem',
  },
  tablet: {
    id: 'tablet',
    label: 'Tablet',
    width: 768,
    height: 1024,
    icon: Tablet,
    radius: '1.25rem',
  },
  desktop: {
    id: 'desktop',
    label: 'Desktop',
    width: 1280,
    height: 800,
    icon: Monitor,
    radius: '0.75rem',
  },
};

const LAYOUT_KIND_STYLES = {
  fullscreen: { icon: Maximize2, className: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' },
  panel: { icon: Layers, className: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  docked: { icon: PanelBottom, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
};

export default function LaunchLivePreview({ settings, launchConfig }) {
  const [device, setDevice] = useState('mobile');
  const [testing, setTesting] = useState(false);
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(0.45);
  const { previewLaunchAnimation, launchingId } = useApplicationLaunch();
  const frame = PREVIEW_DEVICES[device];
  const previewKey = `${launchConfig.animation_style}-${launchConfig.overlay_mode}-${launchConfig.progress_style}`;
  const { energy, boost } = useLaunchOverlayEnergy(true, previewKey);
  const animationMeta = getLaunchAnimationMeta(launchConfig.animation_style, settings?.launch_animations);
  const layoutLabel = getLaunchOverlayLayoutLabel(launchConfig.overlay_mode, settings?.launch_overlay_modes);
  const layoutKind = getLaunchOverlayLayoutKind(launchConfig.overlay_mode);
  const placement = getLaunchOverlayPlacement(launchConfig.overlay_mode, settings?.launch_overlay_modes);
  const placementLabel = LAUNCH_OVERLAY_PLACEMENT_LABELS[placement] || placement;
  const layoutKindStyle = LAYOUT_KIND_STYLES[layoutKind];
  const LayoutIcon = layoutKindStyle.icon;
  const isInstant = normalizeLaunchAnimation(launchConfig.animation_style) === 'none';

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;

    const updateScale = () => {
      const { width, height } = element.getBoundingClientRect();
      const padding = 32;
      const scaleX = (width - padding) / frame.width;
      const scaleY = (height - padding) / frame.height;
      setScale(Math.max(0.28, Math.min(scaleX, scaleY, 0.72)));
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

  const scaledWidth = useMemo(() => Math.round(frame.width * scale), [frame.width, scale]);
  const scaledHeight = useMemo(() => Math.round(frame.height * scale), [frame.height, scale]);

  const handleProductionTest = async () => {
    if (isInstant) {
      toast.info('Instant launch has no overlay to preview.');
      return;
    }

    setTesting(true);
    try {
      const result = await previewLaunchAnimation(launchConfig, {
        animationCatalog: settings?.launch_animations,
        durationCatalog: settings?.launch_durations,
        application: {
          id: 'launch-preview',
          name: settings?.system_name || 'Preview App',
          color: DEFAULT_BRAND_COLOR,
          is_enabled: true,
        },
      });

      if (result?.skipped && result.reason === 'busy') {
        toast.info('A launch preview is already running.');
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="overflow-visible rounded-2xl border bg-card shadow-sm">
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium">Live preview</p>
            {isInstant ? (
              <p className="text-xs text-muted-foreground">
                Instant launch — applications open with no overlay.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="font-medium text-foreground">{animationMeta.label}</span>
                  <span className="text-muted-foreground/50" aria-hidden>·</span>
                  <span className="text-muted-foreground">{layoutLabel.modeLabel}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                      layoutKindStyle.className,
                    )}
                  >
                    <LayoutIcon className="h-3 w-3 shrink-0" />
                    {placementLabel}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {layoutLabel.hint}. Tap the device frame to simulate boosts.
                </p>
              </>
            )}
          </div>
          {!isInstant ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              disabled={testing || Boolean(launchingId)}
              onClick={handleProductionTest}
            >
              <Play className="h-3.5 w-3.5" />
              {testing ? 'Running…' : 'Test full screen'}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b p-2">
        {Object.values(PREVIEW_DEVICES).map((option) => {
          const Icon = option.icon;
          const active = device === option.id;

          return (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              className="h-8 gap-1.5 px-2.5"
              onClick={() => setDevice(option.id)}
            >
              <Icon className="h-3.5 w-3.5" />
              {option.label}
            </Button>
          );
        })}
      </div>

      <div
        ref={viewportRef}
        className="flex min-h-[360px] items-center justify-center bg-muted/15 p-4"
        style={{ maxHeight: 'min(calc(100vh - 10rem), 720px)' }}
      >
        {isInstant ? (
          <div className="flex max-w-xs flex-col items-center gap-3 rounded-2xl border border-dashed bg-background px-6 py-10 text-center">
            <p className="text-sm font-medium">Instant launch</p>
            <p className="text-xs text-muted-foreground">
              Applications open immediately with no overlay. Pick any other animation to preview it here.
            </p>
          </div>
        ) : (
          <div
            className="relative overflow-hidden bg-zinc-900 shadow-2xl ring-2 ring-zinc-700/80"
            style={{
              width: scaledWidth,
              height: scaledHeight,
              borderRadius: frame.radius,
            }}
            onPointerDown={() => boost(0.14)}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: frame.width,
                height: frame.height,
                transform: `scale(${scale})`,
              }}
            >
              <LaunchPreviewCanvas
                launchConfig={launchConfig}
                settings={settings}
                energy={energy}
                onBoost={boost}
                ready={false}
                showLayoutGuide={false}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[11px] text-muted-foreground">
        <span>
          Frame {frame.width}×{frame.height} · {Math.round(scale * 100)}%
        </span>
        {!isInstant ? (
          <span className="text-muted-foreground/80">Test full screen uses your current settings — no app opens</span>
        ) : null}
      </div>
    </div>
  );
}
