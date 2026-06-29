import React, { useMemo, Suspense, lazy, useState, useEffect } from 'react';

import MatrixRainOverlay, { usesFullScreenMatrixRain } from '@/components/pwa/splash-animations/MatrixRainOverlay';
import SplashBackground from '@/components/pwa/splash-animations/SplashBackground';
import SplashMedia from '@/components/pwa/splash-animations/SplashMedia';
import { buildSplashRuntime, isSplashAnimationInteractive, normalizeSplashConfig, shouldUseFullscreenVideoSplash, SPLASH_VIDEO_BACKDROP_FALLBACK } from '@/lib/splashConfig';
import { cn } from '@/lib/utils';

const SplashAnimationVariants = lazy(() => import('@/components/pwa/splash-animations/SplashAnimationVariants'));

/**
 * Shared splash renderer used by the app and admin previews.
 * mode="live" matches the real PWA splash. mode="thumbnail" is a compact picker tile.
 */
export default function SplashStage({
  config,
  variant,
  systemName = '',
  mode = 'live',
  onComplete,
  className = 'relative flex h-full w-full items-center justify-center overflow-hidden',
  showBackground = true,
}) {
  const splashConfig = useMemo(() => normalizeSplashConfig(config), [config]);
  const runtime = useMemo(() => buildSplashRuntime(splashConfig, variant, systemName), [splashConfig, variant, systemName]);
  const [videoBackgroundColor, setVideoBackgroundColor] = useState(null);
  const isThumbnail = mode === 'thumbnail';
  const isLive = mode === 'live';
  const fullScreenMatrix = usesFullScreenMatrixRain(variant);
  const interactive = isSplashAnimationInteractive(variant);
  const fullscreenVideo = shouldUseFullscreenVideoSplash(runtime);
  const stageBackgroundColor = videoBackgroundColor
    || (fullscreenVideo ? SPLASH_VIDEO_BACKDROP_FALLBACK : splashConfig.background_color);
  const matrixColumnCount = variant === 'matrix-rain'
    ? (isThumbnail ? 16 : 40)
    : (isThumbnail ? 12 : 24);

  useEffect(() => {
    if (!isLive || !fullscreenVideo || !runtime.media.loop || !onComplete) return undefined;

    const durationTimer = window.setTimeout(onComplete, runtime.timing.minDurationMs);
    return () => window.clearTimeout(durationTimer);
  }, [fullscreenVideo, isLive, onComplete, runtime.media.loop, runtime.timing.minDurationMs]);

  return (
    <div
      className={cn(className, fullscreenVideo && 'overflow-hidden')}
      style={fullscreenVideo ? { backgroundColor: stageBackgroundColor } : undefined}
    >
      {showBackground && !fullscreenVideo ? <SplashBackground config={splashConfig} /> : null}

      {fullscreenVideo ? (
        <SplashMedia
          runtime={runtime}
          mode="fullscreen"
          onBackgroundColor={setVideoBackgroundColor}
          onEnded={!runtime.media.loop ? onComplete : undefined}
        />
      ) : null}

      {fullScreenMatrix ? (
        <MatrixRainOverlay
          config={splashConfig}
          variant={variant}
          systemName={systemName}
          columnCount={matrixColumnCount}
        />
      ) : null}

      <div
        className={cn(
          'absolute inset-0 z-10 flex items-center justify-center p-4',
          interactive && isLive && 'touch-manipulation',
        )}
      >
        <div className={cn('flex max-h-full max-w-full items-center justify-center', isThumbnail && 'pointer-events-none scale-[0.72]')}>
          <Suspense fallback={null}>
            <SplashAnimationVariants
              variant={variant}
              config={splashConfig}
              systemName={systemName}
              preview={isThumbnail}
              onComplete={fullscreenVideo ? undefined : onComplete}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export function SplashStageMeta({ config, variant, systemName = '' }) {
  const splashConfig = normalizeSplashConfig(config);
  const runtime = buildSplashRuntime(splashConfig, variant, systemName);

  return {
    runtime,
    splashConfig,
    interactive: isSplashAnimationInteractive(variant),
    fullScreenMatrix: usesFullScreenMatrixRain(variant),
  };
}
