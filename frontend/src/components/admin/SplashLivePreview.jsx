import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

import SplashStage from '@/components/pwa/splash-animations/SplashStage';
import SplashBackground from '@/components/pwa/splash-animations/SplashBackground';
import SplashMedia from '@/components/pwa/splash-animations/SplashMedia';
import SplashSystemName from '@/components/pwa/splash-animations/SplashSystemName';
import { buildSplashRuntime, detectSplashMediaType, shouldUseFullscreenVideoSplash, SPLASH_VIDEO_BACKDROP_FALLBACK } from '@/lib/splashConfig';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const SPLASH_PREVIEW_DEVICES = {
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
    width: 1440,
    height: 900,
    icon: Monitor,
    radius: '0.75rem',
  },
};

function PreviewCanvas({ settings, splashConfig }) {
  const runtime = useMemo(
    () => buildSplashRuntime(splashConfig, splashConfig.animation_style, settings.system_name),
    [splashConfig, settings.system_name],
  );
  const [videoBackgroundColor, setVideoBackgroundColor] = useState(null);
  const mediaType = splashConfig.logo_url ? detectSplashMediaType(splashConfig.logo_url) : 'default';
  const fullscreenVideo = shouldUseFullscreenVideoSplash(runtime);
  const previewBackgroundColor = videoBackgroundColor
    || (fullscreenVideo ? SPLASH_VIDEO_BACKDROP_FALLBACK : splashConfig.background_color);

  if (!settings.splash_enabled) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20 px-6 text-center text-sm text-muted-foreground">
        Splash screen is disabled
      </div>
    );
  }

  if (settings.splash_animation_style === 'lottie') {
    if (fullscreenVideo) {
      return (
        <div
          className="relative h-full w-full overflow-hidden"
          style={{ backgroundColor: previewBackgroundColor }}
        >
          <SplashMedia
            runtime={runtime}
            mode="fullscreen"
            onBackgroundColor={setVideoBackgroundColor}
          />
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4 text-center">
            {runtime.title.show && runtime.title.position === 'above' ? (
              <SplashSystemName runtime={runtime} />
            ) : null}
            {runtime.title.show && runtime.title.position === 'below' ? (
              <SplashSystemName runtime={runtime} />
            ) : null}
          </div>
        </div>
      );
    }

    if (mediaType === 'image' && splashConfig.logo_url && splashConfig.show_logo) {
      return (
        <div className="relative h-full w-full overflow-hidden">
          <SplashBackground config={splashConfig} />
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4">
            <SplashMedia runtime={runtime} className="h-40 w-40" />
            {runtime.title.show ? <SplashSystemName runtime={runtime} /> : null}
          </div>
        </div>
      );
    }

    return (
      <div className="relative h-full w-full overflow-hidden">
        <SplashBackground config={splashConfig} />
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4 text-center text-white/80">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xs font-medium uppercase tracking-wide">
            Lottie
          </div>
          <span className="text-xs">Original Lottie file plays in the app</span>
        </div>
      </div>
    );
  }

  return (
    <SplashStage
      config={splashConfig}
      variant={settings.splash_animation_style}
      systemName={settings.system_name}
      mode="live"
      className="absolute inset-0 overflow-hidden"
    />
  );
}

export default function SplashLivePreview({ settings, splashConfig, runtime, className = '' }) {
  const [device, setDevice] = useState('mobile');
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  const frame = SPLASH_PREVIEW_DEVICES[device];

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;

    const updateScale = () => {
      const { width, height } = element.getBoundingClientRect();
      const padding = 24;
      const scaleX = (width - padding) / frame.width;
      const scaleY = (height - padding) / frame.height;
      setScale(Math.max(0.2, Math.min(scaleX, scaleY, 1)));
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

  return (
    <div className={cn('max-w-full overflow-hidden rounded-2xl border bg-card shadow-sm', className)}>
      <div className="border-b bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium">Live preview</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Matches the real splash · {frame.label} · ~{(runtime.timing.animationDurationMs / 1000).toFixed(1)}s
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 border-b p-2">
        {Object.values(SPLASH_PREVIEW_DEVICES).map((option) => {
          const Icon = option.icon;
          const active = device === option.id;

          return (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              className="h-9 w-full gap-1.5 px-2 text-xs sm:text-sm"
              onClick={() => setDevice(option.id)}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{option.label}</span>
            </Button>
          );
        })}
      </div>

      <div
        ref={viewportRef}
        className="flex min-h-[240px] min-w-0 max-w-full items-center justify-center overflow-hidden bg-muted/15 p-3 sm:min-h-[320px] sm:p-4"
        style={{ maxHeight: 'min(calc(100dvh - 12rem), 760px)' }}
      >
        <div
          className="relative overflow-hidden bg-black shadow-2xl ring-1 ring-black/10"
          style={{
            width: scaledWidth,
            height: scaledHeight,
            borderRadius: frame.radius,
          }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: frame.width,
              height: frame.height,
              transform: `scale(${scale})`,
            }}
          >
            <PreviewCanvas settings={settings} splashConfig={splashConfig} />
          </div>
        </div>
      </div>

      <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Frame {frame.width}×{frame.height} · shown at {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
