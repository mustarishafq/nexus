import React, { useMemo, Suspense, lazy } from 'react';

import MatrixRainOverlay, { usesFullScreenMatrixRain } from '@/components/pwa/splash-animations/MatrixRainOverlay';
import SplashBackground from '@/components/pwa/splash-animations/SplashBackground';
import { buildSplashRuntime, isSplashAnimationInteractive, normalizeSplashConfig } from '@/lib/splashConfig';
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
  const isThumbnail = mode === 'thumbnail';
  const isLive = mode === 'live';
  const fullScreenMatrix = usesFullScreenMatrixRain(variant);
  const interactive = isSplashAnimationInteractive(variant);
  const matrixColumnCount = variant === 'matrix-rain'
    ? (isThumbnail ? 16 : 40)
    : (isThumbnail ? 12 : 24);

  return (
    <div className={className}>
      {showBackground ? <SplashBackground config={splashConfig} /> : null}

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
              onComplete={onComplete}
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
