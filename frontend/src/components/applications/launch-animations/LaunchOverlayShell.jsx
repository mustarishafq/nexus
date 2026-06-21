import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { isCompactLaunchOverlayMode, normalizeLaunchOverlayMode } from '@/lib/launchConfig';
import { glassPanelStyles } from '@/components/layout/glassStyles';

const COMPACT_CENTER_OUTER = 'absolute inset-0 flex items-center justify-center p-4';
const COMPACT_CENTER_PANEL = 'relative z-10 w-full max-w-[17.5rem]';
const COMPACT_CENTER_PADDING = 'px-4 py-3.5';
const COMPACT_CENTER_RADIUS = 'rounded-2xl';

function compactCenterPanelClassName(...extra) {
  return cn(
    COMPACT_CENTER_PANEL,
    COMPACT_CENTER_RADIUS,
    COMPACT_CENTER_PADDING,
    'overflow-hidden',
    ...extra,
  );
}

function CenteredPanel({ children, className, panelClassName, style, compact = false }) {
  return (
    <div className={cn(compact ? COMPACT_CENTER_OUTER : 'absolute inset-0 flex items-center justify-center p-6', className)}>
      <div
        className={cn(compact ? COMPACT_CENTER_PANEL : 'relative z-10 w-full max-w-md', panelClassName)}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}

function MeshBackdrop({ brandColor }) {
  const blobs = [
    `color-mix(in srgb, ${brandColor} 55%, #38bdf8)`,
    `color-mix(in srgb, ${brandColor} 40%, #a78bfa)`,
    `color-mix(in srgb, ${brandColor} 35%, #34d399)`,
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {blobs.map((color, index) => (
        <motion.div
          key={color}
          className="absolute rounded-full blur-3xl"
          style={{
            width: 220 + index * 60,
            height: 220 + index * 60,
            background: color,
            left: `${20 + index * 22}%`,
            top: `${12 + index * 18}%`,
          }}
          animate={{
            x: [0, 30 - index * 10, -20, 0],
            y: [0, -18, 12, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: 5 + index, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

export default function LaunchOverlayShell({
  mode,
  brandColor,
  children,
  compact = false,
  className,
}) {
  const resolvedMode = normalizeLaunchOverlayMode(mode);
  const isCompactShell = isCompactLaunchOverlayMode(resolvedMode);
  const [pointer, setPointer] = useState({ x: 50, y: 42 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const backdrop = (
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${brandColor} 35%, #0f172a) 0%, #020617 68%)`,
      }}
    />
  );

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPointer({ x, y });
    setTilt({
      x: ((event.clientY - rect.top) / rect.height - 0.5) * -12,
      y: ((event.clientX - rect.left) / rect.width - 0.5) * 12,
    });
  };

  const panelMotionProps = resolvedMode === 'tilt'
    ? {
        style: { transformStyle: 'preserve-3d', perspective: 900 },
        animate: { rotateX: tilt.x, rotateY: tilt.y },
        transition: { type: 'spring', stiffness: 140, damping: 18 },
      }
    : {};

  const wrapPanel = (panel, extraClassName = 'p-6', { compact = false } = {}) => (
    <motion.div
      className={cn(
        'overflow-hidden border shadow-2xl',
        compact ? cn(COMPACT_CENTER_RADIUS, 'p-0') : cn('rounded-3xl', extraClassName),
      )}
      {...panelMotionProps}
    >
      {panel}
    </motion.div>
  );

  if (resolvedMode === 'corner') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
        <div className="absolute bottom-6 right-6 w-[min(100%,320px)] overflow-hidden rounded-2xl border border-white/15 bg-black/70 p-4 shadow-2xl backdrop-blur-xl">
          {children}
        </div>
      </div>
    );
  }

  if (resolvedMode === 'minimal' || resolvedMode === 'dock') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/75 backdrop-blur-xl',
            resolvedMode === 'dock' ? 'rounded-t-3xl px-6 py-6' : 'px-6 py-4',
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  if (resolvedMode === 'blur') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        {backdrop}
        <div className="absolute inset-0 backdrop-blur-3xl" />
        <div className="absolute inset-0 bg-black/35" />
        <CenteredPanel panelClassName="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          {children}
        </CenteredPanel>
      </div>
    );
  }

  if (resolvedMode === 'frosted') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        {backdrop}
        <div className="absolute inset-0 bg-white/8 backdrop-blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_40%)]" />
        <CenteredPanel panelClassName="rounded-[2rem] border border-white/25 bg-white/12 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-3xl">
          {children}
        </CenteredPanel>
      </div>
    );
  }

  if (resolvedMode === 'glass_deep') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        {backdrop}
        <div className="absolute inset-0 bg-white/5 backdrop-blur-3xl" />
        <CenteredPanel compact>
          {wrapPanel(
            <div className={cn('border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-2xl', COMPACT_CENTER_PADDING)}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_55%)]" />
              <div className="relative">{children}</div>
            </div>,
            'p-0',
            { compact: true },
          )}
        </CenteredPanel>
      </div>
    );
  }

  if (resolvedMode === 'bubble') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
        <CenteredPanel compact>
          <motion.div
            className={cn(
              COMPACT_CENTER_RADIUS,
              'border border-white/25 shadow-[0_0_60px_color-mix(in_srgb,var(--launch-brand)_45%,transparent)] backdrop-blur-xl',
              COMPACT_CENTER_PADDING,
            )}
            style={{ '--launch-brand': brandColor }}
            animate={{ scale: [1, 1.02, 1], boxShadow: ['0 0 40px rgba(255,255,255,0.08)', `0 0 70px color-mix(in srgb, ${brandColor} 40%, transparent)`, '0 0 40px rgba(255,255,255,0.08)'] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {children}
          </motion.div>
        </CenteredPanel>
      </div>
    );
  }

  if (resolvedMode === 'gradient' || resolvedMode === 'mesh') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#020617]" />
        <MeshBackdrop brandColor={brandColor} />
        {resolvedMode === 'gradient' ? (
          <motion.div
            className="absolute inset-0 opacity-60"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${brandColor} 50%, #0ea5e9), color-mix(in srgb, ${brandColor} 35%, #8b5cf6), #020617)`,
            }}
            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : null}
        <div className="relative flex h-full flex-col items-center justify-center px-6 py-10">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'neon_frame') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/80" />
        <CenteredPanel>
          <motion.div
            className="rounded-3xl border-2 border-cyan-300/70 p-6 shadow-[0_0_30px_rgba(34,211,238,0.35),inset_0_0_24px_rgba(167,139,250,0.18)]"
            animate={{ boxShadow: ['0 0 24px rgba(34,211,238,0.25)', '0 0 42px rgba(167,139,250,0.45)', '0 0 24px rgba(34,211,238,0.25)'] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            {children}
          </motion.div>
        </CenteredPanel>
      </div>
    );
  }

  if (resolvedMode === 'hologram_panel') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#001018]" />
        <CenteredPanel>
          <div className="relative overflow-hidden rounded-3xl border border-cyan-300/30 bg-cyan-400/5 p-6 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(34,211,238,0.08)_0px,rgba(34,211,238,0.08)_1px,transparent_1px,transparent_4px)]" />
            <div className="relative">{children}</div>
          </div>
        </CenteredPanel>
      </div>
    );
  }

  if (resolvedMode === 'prism_edge') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        {backdrop}
        <CenteredPanel>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/50 p-6">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(244,114,182,0.25),transparent_35%,rgba(56,189,248,0.25))]" />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-pink-400 via-sky-300 to-lime-300" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-lime-300 via-violet-300 to-pink-400" />
            <div className="relative">{children}</div>
          </div>
        </CenteredPanel>
      </div>
    );
  }

  if (resolvedMode === 'interactive_glow') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#020617]" />
        <div
          className="pointer-events-none absolute inset-0 transition-[background] duration-150"
          style={{
            background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, color-mix(in srgb, ${brandColor} 42%, transparent) 0%, rgba(2,6,23,0.92) 48%)`,
          }}
        />
        <CenteredPanel panelClassName="rounded-3xl border border-white/10 bg-black/30 p-6 backdrop-blur-sm">
          {children}
        </CenteredPanel>
      </div>
    );
  }

  if (resolvedMode === 'tilt') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <CenteredPanel compact>
          {wrapPanel(
            <div className={cn('border border-white/15 bg-[#0f172a]/90 shadow-2xl backdrop-blur-xl', COMPACT_CENTER_PADDING)}>
              {children}
            </div>,
            'p-0',
            { compact: true },
          )}
        </CenteredPanel>
      </div>
    );
  }

  if (resolvedMode === 'split') {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center overflow-hidden', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black" />
        <motion.div
          className="absolute inset-y-0 left-0 w-1/2 bg-[#0f172a] border-r border-white/10"
          initial={{ x: 0 }}
          animate={{ x: '-8%' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-y-0 right-0 w-1/2 bg-[#0f172a] border-l border-white/10"
          initial={{ x: 0 }}
          animate={{ x: '8%' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <div className="relative z-10 w-full max-w-md px-6">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'card') {
    return (
      <div className={cn(COMPACT_CENTER_OUTER, className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className={compactCenterPanelClassName('border border-white/15 bg-[#020617]/90 shadow-2xl')}>
          {children}
        </div>
      </div>
    );
  }

  if (resolvedMode === 'glass') {
    return (
      <div className={cn(COMPACT_CENTER_OUTER, className)} onPointerMove={handlePointerMove}>
        {backdrop}
        <div className="absolute inset-0 bg-white/5 backdrop-blur-2xl" />
        <div className={compactCenterPanelClassName('border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl')}>
          {children}
        </div>
      </div>
    );
  }

  if (resolvedMode === 'clear_glass') {
    return (
      <div className={cn(COMPACT_CENTER_OUTER, className)} onPointerMove={handlePointerMove}>
        <motion.div
          className={compactCenterPanelClassName('border border-white/20 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.35)]')}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 140, damping: 20 }}
        >
          <div
            className={cn('pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10', COMPACT_CENTER_RADIUS)}
          />
          <div
            className={cn('pointer-events-none absolute inset-0 transition-[background] duration-200', COMPACT_CENTER_RADIUS)}
            style={{
              background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(255,255,255,0.08) 0%, transparent 55%)`,
            }}
          />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="relative">{children}</div>
        </motion.div>
      </div>
    );
  }

  if (resolvedMode === 'shell_glass') {
    return (
      <div className={cn(COMPACT_CENTER_OUTER, className)} onPointerMove={handlePointerMove}>
        <motion.div
          className={compactCenterPanelClassName(glassPanelStyles)}
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 140, damping: 20 }}
        >
          <div
            className={cn('pointer-events-none absolute inset-0 transition-[background] duration-200', COMPACT_CENTER_RADIUS)}
            style={{
              background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(255,255,255,0.06) 0%, transparent 55%)`,
            }}
          />
          <div className="relative">{children}</div>
        </motion.div>
      </div>
    );
  }

  if (resolvedMode === 'spotlight') {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black" />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 42%, color-mix(in srgb, ${brandColor} 28%, transparent) 0%, rgba(0,0,0,0.92) 58%)`,
          }}
        />
        <div className="relative z-10 w-full max-w-md px-6">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'cinema') {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center bg-black', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-x-0 top-0 h-[12%] bg-black" />
        <div className="absolute inset-x-0 bottom-0 h-[12%] bg-black" />
        <div className="relative z-10 w-full max-w-2xl px-8">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'top_banner') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        <div className="absolute inset-x-0 top-0 border-b border-white/15 bg-black/80 px-4 py-3 backdrop-blur-xl">
          {children}
        </div>
      </div>
    );
  }

  if (resolvedMode === 'sidebar') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
        <motion.div
          className="absolute inset-y-0 left-0 flex w-[min(100%,340px)] flex-col border-r border-white/15 bg-[#020617]/92 p-6 shadow-2xl backdrop-blur-xl"
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          {children}
        </motion.div>
      </div>
    );
  }

  if (resolvedMode === 'glitch_frame') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#020617]" />
        <motion.div
          className="absolute inset-3 rounded-2xl border-2 border-white/20"
          animate={{
            boxShadow: [
              '0 0 0 1px rgba(248,113,113,0.5), inset 0 0 24px rgba(56,189,248,0.12)',
              '0 0 0 1px rgba(56,189,248,0.5), inset 0 0 24px rgba(74,222,128,0.12)',
              '0 0 0 1px rgba(248,113,113,0.5), inset 0 0 24px rgba(56,189,248,0.12)',
            ],
            x: [0, 2, -1, 0],
          }}
          transition={{ duration: 0.25, repeat: Infinity }}
        />
        <div className="relative flex h-full flex-col items-center justify-center px-6 py-10">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'crt_monitor') {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center p-6', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#0a0f14]" />
        <div className="relative z-10 w-full max-w-md rounded-[2rem] border-[10px] border-[#1e293b] bg-[#001018] p-2 shadow-[inset_0_0_40px_rgba(0,0,0,0.8),0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="relative overflow-hidden rounded-2xl border border-cyan-300/20 p-5">
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18)_0px,rgba(0,0,0,0.18)_1px,transparent_1px,transparent_3px)]" />
            <div className="relative">{children}</div>
          </div>
        </div>
      </div>
    );
  }

  if (resolvedMode === 'hexagon_panel') {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center p-6', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
        <div
          className="relative z-10 w-full max-w-md border border-cyan-300/30 bg-[#020617]/90 p-8 shadow-[0_0_50px_rgba(34,211,238,0.15)]"
          style={{ clipPath: 'polygon(12% 0%, 88% 0%, 100% 50%, 88% 100%, 12% 100%, 0% 50%)' }}
        >
          {children}
        </div>
      </div>
    );
  }

  if (resolvedMode === 'aurora_full') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#020617]" />
        <motion.div
          className="absolute inset-0 opacity-70"
          style={{
            background: `linear-gradient(125deg, color-mix(in srgb, ${brandColor} 40%, #0ea5e9), color-mix(in srgb, ${brandColor} 30%, #8b5cf6), #020617, color-mix(in srgb, ${brandColor} 35%, #34d399))`,
            backgroundSize: '200% 200%',
          }}
          animate={{ backgroundPosition: ['0% 40%', '100% 60%', '0% 40%'] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative flex h-full flex-col items-center justify-center px-6 py-10">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'scanlines_full') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#001018]" />
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.22)_0px,rgba(0,0,0,0.22)_1px,transparent_1px,transparent_4px)]" />
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-cyan-300/20 via-white/10 to-transparent"
          animate={{ top: ['-15%', '115%'] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
        />
        <div className="relative flex h-full flex-col items-center justify-center px-6 py-10">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'void') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${brandColor} 18%, #0f172a) 0%, #000000 72%)`,
          }}
        />
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5"
          animate={{ scale: [0.85, 1.05, 0.9], opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative flex h-full flex-col items-center justify-center px-6 py-10">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'mirror') {
    return (
      <div className={cn(COMPACT_CENTER_OUTER, className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
        <div className={compactCenterPanelClassName('border border-white/25 bg-gradient-to-br from-white/20 via-white/5 to-white/10 shadow-2xl backdrop-blur-2xl')}>
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rotate-12 rounded-full bg-white/20 blur-2xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_45%)]" />
          <div className="relative">{children}</div>
        </div>
      </div>
    );
  }

  if (resolvedMode === 'glitch_panel') {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center p-6', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <motion.div
          className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-[#020617]/90 p-6 shadow-2xl"
          animate={{ x: [0, 2, -1, 0] }}
          transition={{ duration: 0.2, repeat: Infinity }}
        >
          <motion.div
            className="pointer-events-none absolute inset-0 border-2 border-red-400/30"
            animate={{ x: [0, -3, 2, 0], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 0.22, repeat: Infinity }}
          />
          <motion.div
            className="pointer-events-none absolute inset-0 border-2 border-cyan-400/30"
            animate={{ x: [0, 3, -2, 0], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 0.24, repeat: Infinity }}
          />
          <div className="relative">{children}</div>
        </motion.div>
      </div>
    );
  }

  if (resolvedMode === 'polaroid') {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center p-6', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-sm rotate-[-1deg] rounded-sm bg-white p-3 pb-10 shadow-2xl">
          <div className="overflow-hidden rounded-sm bg-[#020617] p-4">{children}</div>
        </div>
      </div>
    );
  }

  if (resolvedMode === 'bottom_sheet') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
        <motion.div
          className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border-t border-white/15 bg-[#020617]/92 px-6 py-6 shadow-2xl backdrop-blur-xl"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 110, damping: 22 }}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />
          {children}
        </motion.div>
      </div>
    );
  }

  if (resolvedMode === 'full_glass') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <motion.div
          className={cn(
            'absolute inset-0 flex flex-col border border-white/15 bg-[#020617]/92 px-6 py-6 shadow-2xl backdrop-blur-xl',
            compact ? 'py-5' : 'py-8',
          )}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 110, damping: 22 }}
        >
          <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-white/25" />
          <div
            className={cn(
              'flex w-full flex-1 flex-col items-center justify-center',
              compact && 'justify-end pb-2',
            )}
          >
            <div className={cn('w-full', compact ? 'max-w-lg' : 'max-w-md')}>{children}</div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (resolvedMode === 'right_rail') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <motion.div
          className="absolute inset-y-0 right-0 flex w-[min(100%,280px)] flex-col border-l border-white/15 bg-[#020617]/90 p-5 shadow-2xl backdrop-blur-xl"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          {children}
        </motion.div>
      </div>
    );
  }

  if (resolvedMode === 'prism_full') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#020617]" />
        <motion.div
          className="absolute inset-0 opacity-60"
          style={{ background: 'linear-gradient(135deg, rgba(244,114,182,0.35), rgba(56,189,248,0.35), rgba(163,230,53,0.25))', backgroundSize: '200% 200%' }}
          animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative flex h-full flex-col items-center justify-center px-6 py-10">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'circuit_board') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#041018]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'linear-gradient(rgba(34,211,238,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <motion.div
          className="pointer-events-none absolute h-0.5 w-32 rounded-full bg-cyan-300/70 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
          style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <div className="relative flex h-full flex-col items-center justify-center px-6 py-10">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'hologram_full') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#001018]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'linear-gradient(rgba(34,211,238,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.2) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(34,211,238,0.06)_0px,rgba(34,211,238,0.06)_1px,transparent_1px,transparent_4px)]" />
        <div className="relative flex h-full flex-col items-center justify-center px-6 py-10">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'vignette') {
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#020617]" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 50% 42%, transparent 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.95) 100%)' }}
        />
        <div className="relative flex h-full flex-col items-center justify-center px-6 py-10">{children}</div>
      </div>
    );
  }

  if (resolvedMode === 'stained_glass') {
    const panes = ['#f472b6', '#38bdf8', '#a3e635', '#fbbf24', '#a78bfa', '#fb7185'];
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center p-6', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative z-10 grid w-full max-w-md grid-cols-3 gap-1 overflow-hidden rounded-2xl border-4 border-[#334155] bg-[#1e293b] p-1 shadow-2xl">
          {panes.map((color, index) => (
            <div key={color} className="relative min-h-[60px] rounded-sm opacity-80" style={{ background: `${color}55` }}>
              {index === 4 ? <div className="absolute inset-0 flex items-center justify-center p-2">{children}</div> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (resolvedMode === 'pixel_frame') {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center p-6', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#1a1033]" />
        <motion.div
          className="relative z-10 w-full max-w-md border-4 border-[#7c3aed] bg-[#020617] p-6 shadow-[8px_8px_0_#4c1d95]"
          animate={{ x: [0, 2, 0], y: [0, -2, 0] }}
          transition={{ duration: 0.3, repeat: Infinity }}
          style={{ imageRendering: 'pixelated' }}
        >
          <div className="pointer-events-none absolute -inset-1 border-2 border-dashed border-fuchsia-400/40" />
          <div className="relative">{children}</div>
        </motion.div>
      </div>
    );
  }

  if (resolvedMode === 'orbit_frame') {
    const dots = 12;
    return (
      <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
        <div className="absolute inset-0 bg-[#020617]" />
        {Array.from({ length: dots }).map((_, index) => (
          <motion.span
            key={index}
            className="pointer-events-none absolute h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
            style={{ left: '50%', top: '50%', marginLeft: -4, marginTop: -4 }}
            animate={{
              x: Math.cos((index / dots) * Math.PI * 2 + pointer.x * 0.02) * (140 + pointer.y * 0.5),
              y: Math.sin((index / dots) * Math.PI * 2 + pointer.x * 0.02) * (200 + pointer.y * 0.5),
            }}
            transition={{ type: 'spring', stiffness: 80, damping: 15 }}
          />
        ))}
        <div className="relative flex h-full flex-col items-center justify-center px-6 py-10">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('absolute inset-0', className)} onPointerMove={handlePointerMove}>
      {backdrop}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
      <div
        className={cn(
          'relative flex h-full flex-col items-center justify-center px-6 py-10',
          compact && 'py-6',
          isCompactShell && 'justify-end',
        )}
      >
        <div className={cn('w-full', isCompactShell ? 'max-w-lg' : 'max-w-md')}>{children}</div>
      </div>
    </div>
  );
}
