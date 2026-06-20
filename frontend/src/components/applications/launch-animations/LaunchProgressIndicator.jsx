import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { normalizeLaunchProgressStyle } from '@/lib/launchConfig';

export default function LaunchProgressIndicator({ style, progress, className }) {
  const resolvedStyle = normalizeLaunchProgressStyle(style);
  const clamped = Math.min(100, Math.max(0, progress * 100));
  const rounded = Math.round(clamped);

  if (resolvedStyle === 'none') {
    return null;
  }

  if (resolvedStyle === 'spinner') {
    return (
      <div className={cn('relative mx-auto h-12 w-12', className)}>
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-white/15 border-t-white"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white">
          {rounded}%
        </div>
      </div>
    );
  }

  if (resolvedStyle === 'dots') {
    return (
      <div className={cn('flex items-center justify-center gap-2', className)}>
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="h-2.5 w-2.5 rounded-full bg-white"
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.18 }}
          />
        ))}
      </div>
    );
  }

  if (resolvedStyle === 'ring') {
    const circumference = 2 * Math.PI * 22;
    const offset = circumference - (clamped / 100) * circumference;

    return (
      <div className={cn('relative mx-auto h-14 w-14', className)}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
          <motion.circle
            cx="26"
            cy="26"
            r="22"
            fill="none"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white">
          {rounded}%
        </div>
      </div>
    );
  }

  if (resolvedStyle === 'percent') {
    return (
      <div className={cn('text-center', className)}>
        <p className="text-3xl font-bold tabular-nums text-white">{rounded}%</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/50">Loading</p>
      </div>
    );
  }

  if (resolvedStyle === 'pulse') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <motion.span
          className="rounded-full bg-white"
          animate={{ width: 8 + clamped * 0.2, height: 8 + clamped * 0.2, opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    );
  }

  if (resolvedStyle === 'liquid_bar') {
    return (
      <div className={cn('h-3 w-full overflow-hidden rounded-full bg-white/10', className)}>
        <motion.div
          className="relative h-full rounded-full bg-gradient-to-r from-sky-300 via-white to-violet-300"
          initial={{ width: '0%' }}
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          <motion.div
            className="absolute inset-0 opacity-40"
            style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)' }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      </div>
    );
  }

  if (resolvedStyle === 'wave') {
    return (
      <div className={cn('relative h-4 w-full overflow-hidden rounded-full bg-white/10', className)}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-200/90 to-white"
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.45) 8px, rgba(255,255,255,0.45) 12px)',
          }}
          animate={{ x: ['0%', '100%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (resolvedStyle === 'segmented') {
    const segments = 10;
    const active = Math.ceil((clamped / 100) * segments);

    return (
      <div className={cn('grid grid-cols-10 gap-1', className)}>
        {Array.from({ length: segments }).map((_, index) => (
          <motion.div
            key={index}
            className="h-2 rounded-sm"
            animate={{
              backgroundColor: index < active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.12)',
              scaleY: index < active ? [1, 1.2, 1] : 1,
            }}
            transition={{ duration: 0.35, delay: index * 0.03 }}
          />
        ))}
      </div>
    );
  }

  if (resolvedStyle === 'stripe') {
    return (
      <div className={cn('relative h-3 w-full overflow-hidden rounded-full bg-white/10', className)}>
        <motion.div
          className="absolute inset-y-0 left-0 overflow-hidden rounded-full"
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          <div
            className="h-full w-full"
            style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, #fff, #fff 6px, rgba(255,255,255,0.35) 6px, rgba(255,255,255,0.35) 12px)',
            }}
          />
        </motion.div>
      </div>
    );
  }

  if (resolvedStyle === 'ladder') {
    const steps = 6;
    const active = Math.ceil((clamped / 100) * steps);

    return (
      <div className={cn('flex items-end justify-center gap-1.5', className)}>
        {Array.from({ length: steps }).map((_, index) => (
          <motion.div
            key={index}
            className="w-3 rounded-sm bg-white/15"
            animate={{
              height: 8 + index * 5,
              backgroundColor: index < active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
            }}
            transition={{ duration: 0.3, delay: index * 0.04 }}
          />
        ))}
      </div>
    );
  }

  if (resolvedStyle === 'orbit_track') {
    return (
      <div className={cn('relative mx-auto h-12 w-12', className)}>
        <div className="absolute inset-0 rounded-full border border-white/15" />
        <motion.div
          className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
          animate={{ rotate: (clamped / 100) * 360 }}
          style={{ transformOrigin: '50% 24px' }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    );
  }

  if (resolvedStyle === 'gradient_ring') {
    const circumference = 2 * Math.PI * 22;
    const offset = circumference - (clamped / 100) * circumference;

    return (
      <div className={cn('relative mx-auto h-14 w-14', className)}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 52 52">
          <defs>
            <linearGradient id="launch-gradient-ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <motion.circle
            cx="26"
            cy="26"
            r="22"
            fill="none"
            stroke="url(#launch-gradient-ring)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white">
          {rounded}%
        </div>
      </div>
    );
  }

  if (resolvedStyle === 'glitch_bar') {
    return (
      <div className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-white/10', className)}>
        <motion.div
          className="absolute inset-y-0 left-0 bg-white"
          animate={{ width: `${clamped}%`, x: [0, 2, -1, 0] }}
          transition={{ width: { type: 'spring', stiffness: 120, damping: 20 }, x: { duration: 0.2, repeat: Infinity } }}
        />
        <motion.div
          className="absolute inset-y-0 left-0 bg-sky-400/60 mix-blend-screen"
          animate={{ width: `${clamped}%`, x: [0, -2, 1, 0] }}
          transition={{ width: { type: 'spring', stiffness: 120, damping: 20 }, x: { duration: 0.22, repeat: Infinity } }}
        />
      </div>
    );
  }

  if (resolvedStyle === 'neon_bar') {
    return (
      <div className={cn('relative h-3 w-full overflow-hidden rounded-full bg-cyan-950/60', className)}>
        <motion.div
          className="h-full rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.75)]"
          animate={{ width: `${clamped}%`, opacity: [0.85, 1, 0.85] }}
          transition={{
            width: { type: 'spring', stiffness: 120, damping: 20 },
            opacity: { duration: 1, repeat: Infinity },
          }}
        />
      </div>
    );
  }

  if (resolvedStyle === 'hologram_ring') {
    const circumference = 2 * Math.PI * 22;
    const offset = circumference - (clamped / 100) * circumference;

    return (
      <div className={cn('relative mx-auto h-14 w-14', className)}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(34,211,238,0.2)" strokeWidth="4" />
          <motion.circle
            cx="26"
            cy="26"
            r="22"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset, opacity: [0.7, 1, 0.75] }}
            transition={{
              strokeDashoffset: { type: 'spring', stiffness: 120, damping: 20 },
              opacity: { duration: 0.6, repeat: Infinity },
            }}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(34,211,238,0.08)_0px,rgba(34,211,238,0.08)_1px,transparent_1px,transparent_3px)]" />
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-cyan-100">
          {rounded}%
        </div>
      </div>
    );
  }

  if (resolvedStyle === 'glitch_percent') {
    return (
      <div className={cn('relative text-center', className)}>
        {['#f87171', '#60a5fa', '#4ade80'].map((color, index) => (
          <motion.p
            key={color}
            className="absolute inset-x-0 text-3xl font-bold tabular-nums"
            style={{ color, mixBlendMode: 'screen' }}
            animate={{ x: [0, (index - 1) * 3, 0], opacity: [0.25, 0.6, 0.25] }}
            transition={{ duration: 0.2, repeat: Infinity }}
          >
            {rounded}%
          </motion.p>
        ))}
        <p className="relative text-3xl font-bold tabular-nums text-white">{rounded}%</p>
      </div>
    );
  }

  if (resolvedStyle === 'matrix_stream') {
    const chars = '01アイウエオ';
    return (
      <div className={cn('relative h-3 w-full overflow-hidden rounded-full bg-emerald-950/60', className)}>
        <motion.div
          className="absolute inset-y-0 left-0 overflow-hidden rounded-full bg-emerald-500/80"
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          <motion.div
            className="flex h-full items-center whitespace-nowrap px-1 text-[8px] font-mono text-emerald-100/80"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          >
            {Array.from({ length: 40 }).map((_, index) => chars[index % chars.length]).join('')}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (resolvedStyle === 'scanline_bar') {
    return (
      <div className={cn('relative h-3 w-full overflow-hidden rounded-full bg-white/10', className)}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-cyan-300/90"
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/50 to-transparent"
          animate={{ left: ['-10%', `${clamped}%`] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (resolvedStyle === 'hex_segments') {
    const segments = 8;
    const active = Math.ceil((clamped / 100) * segments);

    return (
      <div className={cn('flex items-center justify-center gap-1', className)}>
        {Array.from({ length: segments }).map((_, index) => (
          <motion.div
            key={index}
            className="h-4 w-4 border border-cyan-300/40"
            style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
            animate={{
              backgroundColor: index < active ? 'rgba(34,211,238,0.85)' : 'rgba(255,255,255,0.08)',
              scale: index < active ? [1, 1.15, 1] : 1,
            }}
            transition={{ duration: 0.35, delay: index * 0.04 }}
          />
        ))}
      </div>
    );
  }

  if (resolvedStyle === 'radar_sweep') {
    return (
      <div className={cn('relative mx-auto h-14 w-14', className)}>
        <div className="absolute inset-0 rounded-full border border-emerald-400/25" />
        <motion.div
          className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-bottom-left rounded-tl-full bg-gradient-to-tr from-emerald-400/60 to-transparent"
          style={{ marginLeft: '-50%', marginTop: '-50%' }}
          animate={{ rotate: (clamped / 100) * 360 }}
          transition={{ type: 'spring', stiffness: 100, damping: 18 }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-emerald-100">
          {rounded}%
        </div>
      </div>
    );
  }

  if (resolvedStyle === 'binary') {
    const binary = rounded.toString(2).padStart(8, '0');
    return (
      <div className={cn('text-center font-mono', className)}>
        <p className="text-sm tracking-widest text-cyan-200">{binary}</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/45">{rounded}%</p>
      </div>
    );
  }

  if (resolvedStyle === 'crt_bar') {
    return (
      <div className={cn('relative h-4 w-full overflow-hidden rounded-sm border border-white/15 bg-black/60', className)}>
        <motion.div
          className="h-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.6)]"
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.2)_0px,rgba(0,0,0,0.2)_1px,transparent_1px,transparent_3px)]" />
      </div>
    );
  }

  if (resolvedStyle === 'hologram_bar') {
    return (
      <div className={cn('relative h-3 w-full overflow-hidden rounded-full bg-cyan-950/50', className)}>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300/70 via-white/80 to-cyan-200/70"
          animate={{ width: `${clamped}%`, opacity: [0.75, 1, 0.8] }}
          transition={{
            width: { type: 'spring', stiffness: 120, damping: 20 },
            opacity: { duration: 0.8, repeat: Infinity },
          }}
        />
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 8px)' }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (resolvedStyle === 'glitch_dots') {
    const dots = 12;
    const active = Math.ceil((clamped / 100) * dots);

    return (
      <div className={cn('flex items-center justify-center gap-1.5', className)}>
        {Array.from({ length: dots }).map((_, index) => (
          <motion.span
            key={index}
            className="h-2 w-2 rounded-full"
            animate={{
              backgroundColor: index < active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
              x: index < active ? [0, (index % 2 === 0 ? 2 : -2), 0] : 0,
            }}
            transition={{ duration: 0.18, repeat: Infinity }}
          />
        ))}
      </div>
    );
  }

  if (resolvedStyle === 'plasma_bar') {
    return (
      <div className={cn('relative h-3 w-full overflow-hidden rounded-full bg-violet-950/60', className)}>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300"
          animate={{ width: `${clamped}%`, opacity: [0.8, 1, 0.85] }}
          transition={{
            width: { type: 'spring', stiffness: 120, damping: 20 },
            opacity: { duration: 0.7, repeat: Infinity },
          }}
        />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (resolvedStyle === 'pixel_blocks') {
    const blocks = 10;
    const active = Math.ceil((clamped / 100) * blocks);

    return (
      <div className={cn('flex items-center justify-center gap-0.5', className)}>
        {Array.from({ length: blocks }).map((_, index) => (
          <motion.div
            key={index}
            className="h-4 w-3 border border-white/20"
            style={{ imageRendering: 'pixelated' }}
            animate={{
              backgroundColor: index < active ? 'rgba(167,139,250,0.95)' : 'rgba(255,255,255,0.08)',
              scaleY: index < active ? [1, 1.2, 1] : 1,
            }}
            transition={{ duration: 0.25, delay: index * 0.03 }}
          />
        ))}
      </div>
    );
  }

  if (resolvedStyle === 'orbit_dots') {
    const dotCount = 3;
    return (
      <div className={cn('relative mx-auto h-12 w-12', className)}>
        <div className="absolute inset-0 rounded-full border border-white/15" />
        {Array.from({ length: dotCount }).map((_, index) => (
          <motion.div
            key={index}
            className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
            animate={{ rotate: (clamped / 100) * 360 + index * (360 / dotCount) }}
            style={{ transformOrigin: '50% 24px' }}
            transition={{ type: 'spring', stiffness: 100, damping: 18 }}
          />
        ))}
      </div>
    );
  }

  if (resolvedStyle === 'heartbeat') {
    const points = 'M0,12 L8,12 L12,4 L16,20 L20,8 L28,12 L100,12';
    return (
      <div className={cn('relative h-8 w-full overflow-hidden', className)}>
        <svg className="h-full w-full" viewBox="0 0 100 24" preserveAspectRatio="none">
          <motion.path
            d={points}
            fill="none"
            stroke="rgba(248,113,113,0.9)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: clamped / 100 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </svg>
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-red-400/50"
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    );
  }

  if (resolvedStyle === 'countdown') {
    const remaining = Math.max(0, 100 - rounded);
    return (
      <div className={cn('text-center', className)}>
        <motion.p
          key={remaining}
          className="text-4xl font-bold tabular-nums text-white"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
        >
          {remaining}
        </motion.p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/45">Remaining</p>
      </div>
    );
  }

  if (resolvedStyle === 'fire_trail') {
    return (
      <div className={cn('relative h-3 w-full overflow-hidden rounded-full bg-orange-950/50', className)}>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-red-600 via-orange-400 to-amber-200"
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-6 bg-gradient-to-r from-transparent to-white/50"
          animate={{ left: `${Math.max(0, clamped - 8)}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    );
  }

  if (resolvedStyle === 'circuit_trace') {
    const segments = 8;
    const active = Math.ceil((clamped / 100) * segments);

    return (
      <div className={cn('flex items-center gap-0.5', className)}>
        {Array.from({ length: segments }).map((_, index) => (
          <React.Fragment key={index}>
            <motion.div
              className="h-2 w-2 rounded-full border border-cyan-400/40"
              animate={{
                backgroundColor: index < active ? 'rgba(34,211,238,0.9)' : 'transparent',
                boxShadow: index < active ? '0 0 8px rgba(34,211,238,0.7)' : 'none',
              }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            />
            {index < segments - 1 ? (
              <motion.div
                className="h-0.5 w-4 bg-cyan-400/30"
                animate={{ backgroundColor: index < active - 1 ? 'rgba(34,211,238,0.8)' : 'rgba(34,211,238,0.2)' }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (resolvedStyle === 'holo_segments') {
    const segments = 6;
    const active = Math.ceil((clamped / 100) * segments);

    return (
      <div className={cn('flex items-center justify-center gap-1', className)}>
        {Array.from({ length: segments }).map((_, index) => (
          <motion.div
            key={index}
            className="h-5 w-6 rounded-sm border border-cyan-300/30"
            animate={{
              backgroundColor: index < active ? 'rgba(34,211,238,0.55)' : 'rgba(255,255,255,0.06)',
              opacity: index < active ? [0.7, 1, 0.75] : 0.4,
            }}
            transition={{ duration: 0.35, delay: index * 0.05, opacity: { duration: 0.6, repeat: Infinity } }}
          />
        ))}
      </div>
    );
  }

  if (resolvedStyle === 'prism_bar') {
    return (
      <div className={cn('relative h-3 w-full overflow-hidden rounded-full bg-white/10', className)}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #f472b6, #38bdf8, #a3e635, #fbbf24)' }}
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    );
  }

  if (resolvedStyle === 'morse_dash') {
    const units = 12;
    const active = Math.ceil((clamped / 100) * units);

    return (
      <div className={cn('flex items-center justify-center gap-1', className)}>
        {Array.from({ length: units }).map((_, index) => (
          <motion.span
            key={index}
            className={index % 3 === 0 ? 'h-2 w-5 rounded-sm' : 'h-2 w-2 rounded-full'}
            animate={{
              backgroundColor: index < active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.12)',
              opacity: index < active ? [0.6, 1, 0.7] : 0.3,
            }}
            transition={{ duration: 0.4, delay: index * 0.04, opacity: { duration: 0.8, repeat: Infinity } }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/10', className)}>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-white/70 via-white to-white/70"
        initial={{ width: '0%' }}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  );
}
