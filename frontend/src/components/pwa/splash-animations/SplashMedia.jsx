import React from 'react';

import { DEFAULT_LOGO_SRC } from '@/lib/splashConfig';
import { toAbsoluteUrl } from '@/lib/media';

export default function SplashMedia({ runtime, className = 'h-24 w-24 sm:h-28 sm:w-28' }) {
  if (!runtime.media.show) {
    return null;
  }

  const style = {
    transform: `scale(${runtime.timing.logoScale})`,
    objectFit: runtime.media.fit,
  };

  const src = toAbsoluteUrl(runtime.media.customUrl || DEFAULT_LOGO_SRC);

  if (runtime.media.type === 'video' && runtime.media.customUrl) {
    return (
      <video
        src={src}
        autoPlay
        muted={runtime.media.muted}
        loop={runtime.media.loop}
        playsInline
        aria-hidden="true"
        style={style}
        className={`relative z-10 drop-shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${className}`}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={style}
      className={`relative z-10 object-contain drop-shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${className}`}
    />
  );
}
