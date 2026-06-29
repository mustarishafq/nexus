import React, { useCallback, useMemo, useRef } from 'react';

import {
  buildFullscreenVideoStyle,
  DEFAULT_LOGO_SRC,
  sampleVideoBackgroundColor,
  SPLASH_VIDEO_BACKDROP_FALLBACK,
} from '@/lib/splashConfig';
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

const AMBIENT_VIDEO_STYLE = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  minWidth: '112%',
  minHeight: '112%',
  width: 'auto',
  height: 'auto',
  transform: 'translate(-50%, -50%)',
  transformOrigin: 'center center',
  objectFit: 'cover',
  objectPosition: 'center',
  filter: 'blur(36px)',
  opacity: 0.92,
};

function AmbientVideoLayer({ src, muted, loop }) {
  return (
    <video
      src={src}
      autoPlay
      muted={muted}
      loop={loop}
      playsInline
      tabIndex={-1}
      aria-hidden="true"
      style={AMBIENT_VIDEO_STYLE}
    />
  );
}

export default function SplashMedia({
  runtime,
  className = 'h-24 w-24 sm:h-28 sm:w-28',
  mode = 'inline',
  onBackgroundColor,
  onEnded,
}) {
  const sampledRef = useRef(false);

  const handleVideoFrame = useCallback((event) => {
    if (sampledRef.current) return;

    const sampled = sampleVideoBackgroundColor(event.currentTarget);
    const resolved = sampled || SPLASH_VIDEO_BACKDROP_FALLBACK;
    sampledRef.current = true;
    applySplashBackdropColor(resolved);
    onBackgroundColor?.(resolved);
  }, [onBackgroundColor]);

  const handleVideoEnded = useCallback(() => {
    onEnded?.();
  }, [onEnded]);

  const fullscreenStyle = useMemo(
    () => (runtime ? buildFullscreenVideoStyle(runtime) : undefined),
    [runtime],
  );

  if (!runtime.media.show) {
    return null;
  }

  const isFullscreen = mode === 'fullscreen' || runtime.media.fullscreen;
  const src = toAbsoluteUrl(runtime.media.customUrl || DEFAULT_LOGO_SRC);
  const useAmbientBackdrop = isFullscreen && runtime.media.fit === 'contain';

  if (runtime.media.type === 'video' && runtime.media.customUrl) {
    if (isFullscreen) {
      return (
        <div
          className="absolute inset-0 z-0 overflow-hidden"
          style={{ backgroundColor: SPLASH_VIDEO_BACKDROP_FALLBACK }}
          aria-hidden="true"
        >
          {useAmbientBackdrop ? (
            <AmbientVideoLayer src={src} muted={runtime.media.muted} loop={runtime.media.loop} />
          ) : null}
          <video
            src={src}
            autoPlay
            muted={runtime.media.muted}
            loop={runtime.media.loop}
            playsInline
            onLoadedData={handleVideoFrame}
            onCanPlay={handleVideoFrame}
            onEnded={handleVideoEnded}
            style={{
              ...fullscreenStyle,
              zIndex: 1,
            }}
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
        onEnded={handleVideoEnded}
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
