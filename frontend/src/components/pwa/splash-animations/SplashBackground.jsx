import React from 'react';
import { motion } from 'framer-motion';

import { buildSplashBackgroundLayers, normalizeSplashConfig } from '@/lib/splashConfig';

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function withAlpha(color, alpha) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function SplashBackground({ config, className = '' }) {
  const normalized = normalizeSplashConfig(config);
  const layers = buildSplashBackgroundLayers(normalized);
  const overlayOpacity = normalized.background_overlay_opacity / 100;
  const backdropBlur = normalized.backdrop_blur;

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          ...layers.base,
          backdropFilter: backdropBlur ? `blur(${backdropBlur}px)` : undefined,
          WebkitBackdropFilter: backdropBlur ? `blur(${backdropBlur}px)` : undefined,
        }}
      />

      {layers.blobs.map((blob, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full"
          style={{
            ...blob.style,
            filter: blob.blur ? `blur(${blob.blur}px)` : undefined,
          }}
          animate={blob.animate}
          transition={blob.transition}
        />
      ))}

      {layers.vignette ? (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at center, transparent 35%, ${withAlpha(normalized.background_color, 0.15)} 60%, ${withAlpha('#000000', 0.72)} 100%)`,
          }}
        />
      ) : null}

      {layers.noise ? (
        <div
          className="absolute inset-0 opacity-[0.07] mix-blend-soft-light"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 0.5px, transparent 0.6px)',
            backgroundSize: '3px 3px',
          }}
        />
      ) : null}

      {overlayOpacity > 0 ? (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
        />
      ) : null}
    </div>
  );
}
