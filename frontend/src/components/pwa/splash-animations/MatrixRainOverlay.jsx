import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

import { buildSplashRuntime } from '@/lib/splashConfig';

const MATRIX_GLYPHS = 'アイウエオカキクケ0123456789ABCDEF';

export function MatrixRainColumns({ runtime, columnCount = 32 }) {
  const columns = useMemo(
    () => Array.from({ length: columnCount }, (_, index) => ({
      left: `${(index / columnCount) * 100}%`,
      delay: (index % 14) * 0.11,
      duration: 1.35 + (index % 7) * 0.18,
      length: 11 + (index % 10),
      seed: index,
    })),
    [columnCount],
  );

  return (
    <>
      {columns.map((column) => {
        const chars = Array.from(
          { length: column.length },
          (_, row) => MATRIX_GLYPHS[(column.seed + row) % MATRIX_GLYPHS.length],
        );

        return (
          <motion.div
            key={column.seed}
            className="absolute font-mono text-[11px] leading-[18px] sm:text-xs sm:leading-5"
            style={{
              left: column.left,
              color: runtime.withAlpha(runtime.theme.secondary, 0.55),
            }}
            initial={{ top: '-100%' }}
            animate={{ top: '100%' }}
            transition={{
              duration: runtime.scaleDuration(column.duration),
              delay: runtime.scaleDuration(column.delay),
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            {chars.map((char, row) => {
              const isHead = row === chars.length - 1;

              return (
                <div
                  key={row}
                  style={{
                    opacity: isHead ? 1 : 0.15 + (row / chars.length) * 0.45,
                    color: isHead ? runtime.withAlpha('#FFFFFF', 0.95) : undefined,
                    textShadow: isHead ? `0 0 10px ${runtime.withAlpha(runtime.theme.secondary, 0.85)}` : undefined,
                  }}
                >
                  {char}
                </div>
              );
            })}
          </motion.div>
        );
      })}
    </>
  );
}

export default function MatrixRainOverlay({
  config,
  variant,
  systemName = '',
  columnCount = 36,
  className = 'pointer-events-none absolute inset-0 z-[1] overflow-hidden',
}) {
  const runtime = useMemo(
    () => buildSplashRuntime(config, variant, systemName),
    [config, variant, systemName],
  );

  return (
    <div className={className} aria-hidden="true">
      <MatrixRainColumns runtime={runtime} columnCount={columnCount} />
    </div>
  );
}

export function usesFullScreenMatrixRain(style) {
  return style === 'matrix-rain' || style === 'matrix-fall';
}
