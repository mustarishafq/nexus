import React, { useCallback, useRef } from 'react';

import { DEFAULT_LOGO_SRC, sampleVideoBackgroundColor } from '@/lib/splashConfig';
import { toAbsoluteUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

export function applySplashBackdropColor(color) {
  if (!color || typeof document === 'undefined') return;

  try {
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', color);
    }
  } catch {
    // ignore DOM write failures
  }
}

const FULLSCREEN_VIDEO_STYLE = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  minWidth: '100%',
  minHeight: '100%',
  width: 'auto',
  height: 'auto',
  transform: 'translate(-50%, -50%) scale(1.06)',
  transformOrigin: 'center center',
  objectFit: 'cover',
  objectPosition: 'center',
};

export default function SplashMedia({
  runtime,
  className = 'h-24 w-24 sm:h-28 sm:w-28',
  mode = 'inline',
  onBackgroundColor,
}) {
  const sampledRef = useRef(false);

  const handleVideoFrame = useCallback((event) => {
    if (sampledRef.current) return;

    const sampled = sampleVideoBackgroundColor(event.currentTarget);
    if (!sampled) return;

    sampledRef.current = true;
    applySplashBackdropColor(sampled);
    onBackgroundColor?.(sampled);
  }, [onBackgroundColor]);

  if (!runtime.media.show) {
    return null;
  }

  const isFullscreen = mode === 'fullscreen' || runtime.media.fullscreen;
  const src = toAbsoluteUrl(runtime.media.customUrl || DEFAULT_LOGO_SRC);

  if (runtime.media.type === 'video' && runtime.media.customUrl) {
    if (isFullscreen) {
      return (
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <video
            src={src}
            autoPlay
            muted={runtime.media.muted}
            loop={runtime.media.loop}
            playsInline
            onLoadedData={handleVideoFrame}
            onCanPlay={handleVideoFrame}
            style={FULLSCREEN_VIDEO_STYLE}
          />
        </div>
      );
    }

    return (
      <video
        src={src}
        autoPlay
        muted={runtime.media.muted}
        loop={runtime.media.loop}
        playsInline
        aria-hidden="true"
        style={{
          objectFit: runtime.media.fit,
          transform: `scale(${runtime.timing.logoScale})`,
        }}
        className={cn('relative z-10 drop-shadow-[0_12px_32px_rgba(0,0,0,0.35)]', className)}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{
        transform: `scale(${runtime.timing.logoScale})`,
        objectFit: runtime.media.fit,
      }}
      className={cn('relative z-10 object-contain drop-shadow-[0_12px_32px_rgba(0,0,0,0.35)]', className)}
    />
  );
}
