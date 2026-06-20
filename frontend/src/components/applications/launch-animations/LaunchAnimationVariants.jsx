import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LaunchAppBadge } from '@/components/applications/launch-animations/shared';

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function AnimatedBadge({ application, compact, energy, exiting }) {
  return (
    <motion.div
      animate={{
        scale: exiting ? 1.8 : 1 + energy * 0.06,
        opacity: exiting ? 0 : 1,
      }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
    >
      <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
    </motion.div>
  );
}

export function WarpLaunchAnimation({ application, energy, exiting, compact = false }) {
  const stars = useMemo(
    () => Array.from({ length: compact ? 18 : 36 }, (_, index) => ({
      id: index,
      x: randomBetween(-50, 50),
      delay: randomBetween(0, 0.8),
      size: randomBetween(1, compact ? 2.5 : 3.5),
      duration: randomBetween(0.45, 1.1),
    })),
    [compact],
  );

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {stars.map((star) => (
          <motion.span
            key={star.id}
            className="absolute left-1/2 top-1/2 rounded-full bg-white"
            style={{ width: star.size, height: star.size * 8 }}
            initial={{ opacity: 0, x: star.x, y: 120, scaleY: 0.2 }}
            animate={{
              opacity: exiting ? 0 : [0, 1, 0],
              y: exiting ? -420 : [-40, -280 - energy * 120],
              scaleY: exiting ? 2.4 : [0.4, 1.4 + energy * 0.4],
            }}
            transition={{
              duration: star.duration * (1 - energy * 0.25),
              delay: star.delay,
              repeat: exiting ? 0 : Infinity,
              ease: 'easeIn',
            }}
          />
        ))}
      </div>
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function RippleLaunchAnimation({ application, ripples = [], energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center">
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="pointer-events-none absolute rounded-full border border-white/50"
          style={{ left: ripple.x, top: ripple.y }}
          initial={{ width: 0, height: 0, opacity: 0.8, x: '-50%', y: '-50%' }}
          animate={{ width: compact ? 160 : 280, height: compact ? 160 : 280, opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      ))}
      <motion.div
        animate={{
          scale: exiting ? 2.2 : 1 + energy * 0.05,
          boxShadow: `0 0 ${24 + energy * 40}px rgba(255,255,255,${0.15 + energy * 0.2})`,
        }}
      >
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function OrbitLaunchAnimation({ application, energy, orbiters = [], exiting, compact = false }) {
  const radius = compact ? 42 : 72;

  return (
    <div className="relative flex items-center justify-center">
      {orbiters.map((orbiter, index) => (
        <motion.span
          key={orbiter.id}
          className="absolute h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]"
          animate={{ rotate: exiting ? 720 + index * 40 : 360, scale: exiting ? 0 : 1 }}
          transition={{
            duration: Math.max(0.5, 1.8 - energy * 0.35 - index * 0.05),
            repeat: exiting ? 0 : Infinity,
            ease: 'linear',
          }}
          style={{ transformOrigin: `${radius}px 0px` }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function PortalLaunchAnimation({ application, energy, exiting, compact = false }) {
  const rings = compact ? 3 : 4;

  return (
    <div className="relative flex items-center justify-center">
      {Array.from({ length: rings }).map((_, index) => (
        <motion.div
          key={index}
          className="pointer-events-none absolute rounded-full border border-white/25"
          style={{
            width: (compact ? 88 : 140) + index * (compact ? 24 : 34),
            height: (compact ? 88 : 140) + index * (compact ? 24 : 34),
          }}
          animate={{
            rotate: index % 2 === 0 ? 360 : -360,
            scale: exiting ? 2.8 + index * 0.2 : 1 + energy * 0.06,
            opacity: exiting ? 0 : 0.35 + index * 0.12,
          }}
          transition={{
            rotate: { duration: 4 - index * 0.4 - energy * 0.3, repeat: Infinity, ease: 'linear' },
            scale: { type: 'spring', stiffness: 120, damping: 16 },
            opacity: { duration: 0.35 },
          }}
        />
      ))}
      <motion.div
        animate={{
          scale: exiting ? 0.2 : 1,
          rotate: exiting ? 180 : 0,
          filter: exiting ? 'blur(8px)' : 'blur(0px)',
        }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
      >
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function IgniteLaunchAnimation({ application, energy, exiting, compact = false }) {
  const embers = useMemo(
    () => Array.from({ length: compact ? 10 : 18 }, (_, index) => ({
      id: index,
      x: randomBetween(-50, 50),
      delay: randomBetween(0, 1.2),
    })),
    [compact],
  );

  return (
    <div className="relative flex items-center justify-center">
      {embers.map((ember) => (
        <motion.span
          key={ember.id}
          className="pointer-events-none absolute h-2 w-2 rounded-full bg-orange-200 shadow-[0_0_10px_rgba(251,191,36,0.8)]"
          initial={{ opacity: 0, y: 40, x: ember.x, scale: 0.4 }}
          animate={{
            opacity: exiting ? 0 : [0, 1, 0],
            y: exiting ? -120 : [-20, -90 - energy * 30],
            scale: exiting ? 1.8 : [0.5, 1.2, 0.3],
          }}
          transition={{
            duration: 1.1 - energy * 0.15,
            delay: ember.delay,
            repeat: exiting ? 0 : Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
      <motion.div
        animate={{
          y: exiting ? -80 : [0, -4, 0],
          scale: exiting ? 1.35 : 1 + energy * 0.05,
        }}
        transition={{
          y: exiting
            ? { duration: 0.35, ease: 'easeIn' }
            : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
          scale: { type: 'spring', stiffness: 180, damping: 14 },
        }}
      >
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function PulseLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="pointer-events-none absolute rounded-full border border-white/30"
          style={{ width: compact ? 72 : 110, height: compact ? 72 : 110 }}
          animate={{
            scale: exiting ? 2.5 : [1, 1.8 + energy * 0.4, 1],
            opacity: exiting ? 0 : [0.5, 0, 0.5],
          }}
          transition={{
            duration: 1.4 - energy * 0.2,
            delay: index * 0.25,
            repeat: exiting ? 0 : Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function AuroraLaunchAnimation({ application, energy, exiting, compact = false }) {
  const blobs = [
    'rgba(56,189,248,0.35)',
    'rgba(167,139,250,0.35)',
    'rgba(52,211,153,0.3)',
  ];

  return (
    <div className="relative flex items-center justify-center">
      {blobs.map((color, index) => (
        <motion.div
          key={color}
          className="pointer-events-none absolute rounded-full blur-2xl"
          style={{
            width: compact ? 90 : 140,
            height: compact ? 90 : 140,
            background: color,
          }}
          animate={{
            x: exiting ? 0 : [0, 20 - index * 10, -10, 0],
            y: exiting ? 0 : [0, -12, 8, 0],
            scale: exiting ? 2 : [0.9, 1.2 + energy * 0.15, 0.95],
            opacity: exiting ? 0 : [0.35, 0.7, 0.4],
          }}
          transition={{ duration: 2.2 + index * 0.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function GlitchLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center">
      {['#f87171', '#60a5fa', '#4ade80'].map((color, index) => (
        <motion.div
          key={color}
          className="absolute"
          style={{ boxShadow: `0 0 20px ${color}55` }}
          animate={{
            x: exiting ? 0 : [0, (index - 1) * (6 + energy * 8), 0],
            opacity: exiting ? 0 : [0.2, 0.65, 0.2],
          }}
          transition={{ duration: 0.35 + index * 0.05, repeat: Infinity }}
        >
          <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} className="opacity-70" />
        </motion.div>
      ))}
      <motion.div animate={{ opacity: exiting ? 0 : [0.7, 1, 0.85] }} transition={{ duration: 0.25, repeat: Infinity }}>
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function LiquidLaunchAnimation({ application, energy, exiting, compact = false }) {
  const blobs = useMemo(() => ['#38bdf8', '#a78bfa', '#34d399'], []);
  return (
    <div className="relative flex items-center justify-center">
      {blobs.map((color, index) => (
        <motion.div
          key={color}
          className="pointer-events-none absolute rounded-full blur-xl"
          style={{ width: compact ? 70 : 110, height: compact ? 70 : 110, background: color }}
          animate={{
            scale: exiting ? 2.2 : [0.8, 1.3 + energy * 0.2, 0.9],
            x: [0, 18 - index * 12, 0],
            y: [0, -10 + index * 6, 0],
            opacity: exiting ? 0 : [0.35, 0.75, 0.4],
          }}
          transition={{ duration: 1.6, repeat: Infinity, delay: index * 0.15 }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function VortexLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center">
      {Array.from({ length: compact ? 4 : 6 }).map((_, index) => (
        <motion.div
          key={index}
          className="pointer-events-none absolute rounded-full border border-white/20"
          style={{ width: (compact ? 60 : 90) + index * (compact ? 18 : 28), height: (compact ? 60 : 90) + index * (compact ? 18 : 28) }}
          animate={{ rotate: exiting ? 540 : 360, opacity: exiting ? 0 : 0.15 + index * 0.08 }}
          transition={{ duration: 2.4 - energy * 0.5 - index * 0.1, repeat: Infinity, ease: 'linear' }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function MagneticLaunchAnimation({ application, energy, exiting, compact = false }) {
  const particles = useMemo(
    () => Array.from({ length: compact ? 10 : 16 }, (_, index) => ({
      id: index,
      x: randomBetween(-80, 80),
      y: randomBetween(-80, 80),
      delay: randomBetween(0, 0.8),
    })),
    [compact],
  );

  return (
    <div className="relative flex items-center justify-center">
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-white"
          initial={{ x: particle.x, y: particle.y, opacity: 0 }}
          animate={{
            x: exiting ? particle.x * 2 : [particle.x, 0],
            y: exiting ? particle.y * 2 : [particle.y, 0],
            opacity: exiting ? 0 : [0, 1, 0],
            scale: exiting ? 0 : [0.4, 1, 0.2],
          }}
          transition={{ duration: 1.1 - energy * 0.2, delay: particle.delay, repeat: exiting ? 0 : Infinity }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function CometLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center">
      <motion.span
        className="pointer-events-none absolute h-2 w-16 rounded-full bg-gradient-to-r from-transparent via-orange-200 to-white"
        animate={{
          rotate: exiting ? 180 : [0, 360],
          opacity: exiting ? 0 : [0.4, 1, 0.4],
          scale: 1 + energy * 0.3,
        }}
        transition={{ duration: 1.6 - energy * 0.25, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: `${compact ? 50 : 80}px center` }}
      />
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function MatrixLaunchAnimation({ application, energy, exiting, compact = false }) {
  const columns = useMemo(
    () => Array.from({ length: compact ? 8 : 14 }, (_, index) => ({
      id: index,
      x: index * (compact ? 14 : 18) - (compact ? 50 : 90),
      delay: randomBetween(0, 1.2),
    })),
    [compact],
  );

  return (
    <div className="relative flex items-center justify-center overflow-hidden">
      {columns.map((column) => (
        <motion.span
          key={column.id}
          className="pointer-events-none absolute font-mono text-[9px] text-emerald-400/70"
          style={{ left: `calc(50% + ${column.x}px)` }}
          animate={{ y: exiting ? -120 : [40, -120], opacity: exiting ? 0 : [0, 0.9, 0] }}
          transition={{ duration: 1.4 - energy * 0.15, delay: column.delay, repeat: Infinity, ease: 'linear' }}
        >
          01
        </motion.span>
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function NeonLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute rounded-3xl"
        style={{
          width: compact ? 88 : 132,
          height: compact ? 88 : 132,
          boxShadow: '0 0 24px rgba(56,189,248,0.55), inset 0 0 18px rgba(167,139,250,0.35)',
        }}
        animate={{
          opacity: exiting ? 0 : [0.25, 0.95, 0.4, 1, 0.5],
          scale: 1 + energy * 0.05,
        }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function BounceLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <motion.div
      animate={{
        y: exiting ? -80 : [80, -12 - energy * 8, 0, -4, 0],
        scale: exiting ? 1.4 : [0.5, 1.08, 0.98, 1],
        opacity: exiting ? 0 : 1,
      }}
      transition={{ duration: exiting ? 0.35 : 1.1, ease: 'easeOut' }}
    >
      <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
    </motion.div>
  );
}

export function HologramLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        animate={{ opacity: exiting ? 0 : [0.15, 0.45, 0.2] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-2 border-b border-cyan-300/20" />
        ))}
      </motion.div>
      <motion.div
        animate={{ opacity: exiting ? 0 : [0.5, 1, 0.7], filter: exiting ? 'blur(6px)' : ['blur(2px)', 'blur(0px)', 'blur(1px)'] }}
        transition={{ duration: 0.7, repeat: Infinity }}
      >
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function PrismLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center">
      {['#f472b6', '#38bdf8', '#a3e635'].map((color, index) => (
        <motion.div
          key={color}
          className="absolute rounded-2xl opacity-50"
          style={{ width: compact ? 72 : 100, height: compact ? 72 : 100, background: `linear-gradient(135deg, ${color}55, transparent)` }}
          animate={{
            rotate: exiting ? 120 : [0, 10 + index * 5, 0],
            scale: exiting ? 1.8 : [0.9, 1.12 + energy * 0.1, 0.95],
            opacity: [0.2, 0.55, 0.2],
          }}
          transition={{ duration: 1.3 + index * 0.1, repeat: Infinity }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function SmokeLaunchAnimation({ application, energy, exiting, compact = false }) {
  const wisps = useMemo(
    () => Array.from({ length: compact ? 6 : 10 }, (_, index) => ({
      id: index,
      x: randomBetween(-40, 40),
      delay: randomBetween(0, 1),
    })),
    [compact],
  );

  return (
    <div className="relative flex items-center justify-center">
      {wisps.map((wisp) => (
        <motion.span
          key={wisp.id}
          className="pointer-events-none absolute h-8 w-8 rounded-full bg-white/10 blur-md"
          style={{ left: `calc(50% + ${wisp.x}px)` }}
          animate={{
            y: exiting ? -60 : [20, -50 - energy * 20],
            opacity: exiting ? 0 : [0.5, 0, 0.4, 0],
            scale: [0.8, 1.4, 1.8],
          }}
          transition={{ duration: 1.5, delay: wisp.delay, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function GlitchRgbLaunchAnimation({ application, energy, exiting, compact = false }) {
  const offsets = ['#ef4444', '#3b82f6', '#22c55e'];
  return (
    <div className="relative flex items-center justify-center">
      {offsets.map((color, index) => (
        <motion.div
          key={color}
          className="absolute mix-blend-screen"
          animate={{
            x: exiting ? 0 : [(index - 1) * (10 + energy * 14), 0, (index - 1) * -8],
            y: exiting ? 0 : [0, (index - 1) * 4, 0],
            opacity: exiting ? 0 : [0.35, 0.85, 0.4],
          }}
          transition={{ duration: 0.28, repeat: Infinity }}
        >
          <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} className="opacity-80" />
        </motion.div>
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function StaticBurstLaunchAnimation({ application, energy, exiting, compact = false }) {
  const grains = useMemo(
    () => Array.from({ length: compact ? 40 : 80 }, (_, index) => ({
      id: index,
      x: randomBetween(0, 100),
      y: randomBetween(0, 100),
      size: randomBetween(1, 2.5),
    })),
    [compact],
  );

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        animate={{ opacity: exiting ? 0 : [0.9, 0.2, 0.7, 0.15] }}
        transition={{ duration: 0.15, repeat: Infinity }}
      >
        {grains.map((grain) => (
          <span
            key={grain.id}
            className="absolute rounded-sm bg-white"
            style={{ left: `${grain.x}%`, top: `${grain.y}%`, width: grain.size, height: grain.size, opacity: 0.4 + Math.random() * 0.5 }}
          />
        ))}
      </motion.div>
      <motion.div animate={{ opacity: exiting ? 0 : [0.3, 1, 0.85], scale: exiting ? 1.5 : [0.92, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function DatamoshLaunchAnimation({ application, energy, exiting, compact = false }) {
  const slices = compact ? 6 : 10;
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-2xl">
      {Array.from({ length: slices }).map((_, index) => (
        <motion.div
          key={index}
          className="absolute overflow-hidden"
          style={{
            width: compact ? 72 : 100,
            height: (compact ? 72 : 100) / slices,
            top: `calc(50% - ${(compact ? 36 : 50)}px + ${index * ((compact ? 72 : 100) / slices)}px)`,
          }}
          animate={{
            x: exiting ? 0 : [0, (index % 2 === 0 ? 1 : -1) * (12 + energy * 18), 0],
            skewX: exiting ? 0 : [0, (index % 2 === 0 ? 8 : -8), 0],
          }}
          transition={{ duration: 0.4 + index * 0.03, repeat: Infinity }}
        >
          <div style={{ transform: `translateY(-${index * ((compact ? 72 : 100) / slices)}px)` }}>
            <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function HologramGridLaunchAnimation({ application, energy, exiting, compact = false }) {
  const size = compact ? 100 : 140;
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="pointer-events-none absolute rounded-full border border-cyan-300/30"
        style={{ width: size, height: size }}
        animate={{ rotate: exiting ? 180 : 360, scale: [0.9, 1.05 + energy * 0.08, 0.95] }}
        transition={{ rotate: { duration: 6, repeat: Infinity, ease: 'linear' }, scale: { duration: 2, repeat: Infinity } }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="absolute inset-0 border border-cyan-300/20"
            style={{ transform: `rotate(${index * 45}deg)` }}
          />
        ))}
      </motion.div>
      <motion.div animate={{ opacity: exiting ? 0 : [0.5, 1, 0.7], filter: ['hue-rotate(0deg)', 'hue-rotate(20deg)', 'hue-rotate(0deg)'] }} transition={{ duration: 1.2, repeat: Infinity }}>
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function ScanlineLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15)_0px,rgba(0,0,0,0.15)_1px,transparent_1px,transparent_3px)]" />
      <motion.div
        className="pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-cyan-300/40 via-white/25 to-transparent"
        animate={{ top: exiting ? '100%' : ['-10%', '110%'] }}
        transition={{ duration: 1.4 - energy * 0.4, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div animate={{ opacity: exiting ? 0 : [0.4, 1, 0.6] }} transition={{ duration: 0.6, repeat: Infinity }}>
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function CyberHexLaunchAnimation({ application, energy, exiting, compact = false }) {
  const cells = useMemo(
    () => Array.from({ length: compact ? 6 : 8 }, (_, index) => ({
      id: index,
      angle: (index / (compact ? 6 : 8)) * Math.PI * 2,
      radius: compact ? 42 : 58,
    })),
    [compact],
  );

  return (
    <div className="relative flex items-center justify-center">
      {cells.map((cell) => (
        <motion.div
          key={cell.id}
          className="pointer-events-none absolute h-5 w-5 border border-cyan-300/50"
          style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
          animate={{
            x: exiting ? 0 : [Math.cos(cell.angle) * cell.radius, 0],
            y: exiting ? 0 : [Math.sin(cell.angle) * cell.radius, 0],
            opacity: exiting ? 0 : [0.3, 0.9, 0.4],
            rotate: [0, 60, 0],
          }}
          transition={{ duration: 0.9 + cell.id * 0.05, repeat: Infinity }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function LaserGridLaunchAnimation({ application, energy, exiting, compact = false }) {
  const size = compact ? 120 : 180;
  return (
    <div className="relative flex items-center justify-center" style={{ perspective: 600 }}>
      <motion.div
        className="pointer-events-none absolute border border-cyan-400/40"
        style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
        animate={{
          rotateX: exiting ? 70 : [58, 62 + energy * 6, 58],
          rotateZ: exiting ? 0 : [0, 8, 0],
          opacity: exiting ? 0 : [0.35, 0.75, 0.4],
        }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <React.Fragment key={index}>
            <div className="absolute inset-x-0 border-t border-cyan-300/30" style={{ top: `${index * 25}%` }} />
            <div className="absolute inset-y-0 border-l border-cyan-300/30" style={{ left: `${index * 25}%` }} />
          </React.Fragment>
        ))}
      </motion.div>
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function CrystalLaunchAnimation({ application, energy, exiting, compact = false }) {
  const shards = useMemo(
    () => Array.from({ length: compact ? 8 : 12 }, (_, index) => ({
      id: index,
      angle: (index / (compact ? 8 : 12)) * 360,
      distance: randomBetween(compact ? 30 : 45, compact ? 55 : 75),
    })),
    [compact],
  );

  return (
    <div className="relative flex items-center justify-center">
      {shards.map((shard) => (
        <motion.span
          key={shard.id}
          className="pointer-events-none absolute h-3 w-1.5 rounded-sm bg-white/70"
          style={{ transformOrigin: 'center bottom' }}
          animate={{
            x: exiting ? Math.cos((shard.angle * Math.PI) / 180) * shard.distance * 1.5 : [0, Math.cos((shard.angle * Math.PI) / 180) * shard.distance],
            y: exiting ? Math.sin((shard.angle * Math.PI) / 180) * shard.distance * 1.5 : [0, Math.sin((shard.angle * Math.PI) / 180) * shard.distance],
            opacity: exiting ? 0 : [0.9, 0.2],
            rotate: shard.angle,
          }}
          transition={{ duration: 0.7 + energy * 0.3, repeat: exiting ? 0 : Infinity, repeatDelay: 0.4 }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function FlipLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <motion.div
      style={{ perspective: 800, transformStyle: 'preserve-3d' }}
      animate={{
        rotateY: exiting ? 90 : [180, 0, 0],
        opacity: exiting ? 0 : [0.4, 1, 1],
      }}
      transition={{ duration: exiting ? 0.35 : 1.1 - energy * 0.2, ease: 'easeOut' }}
    >
      <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
    </motion.div>
  );
}

export function StarWarpLaunchAnimation({ application, energy, exiting, compact = false }) {
  const stars = useMemo(
    () => Array.from({ length: compact ? 24 : 48 }, (_, index) => ({
      id: index,
      x: randomBetween(-60, 60),
      delay: randomBetween(0, 0.6),
      length: randomBetween(compact ? 12 : 20, compact ? 28 : 40),
    })),
    [compact],
  );

  return (
    <div className="relative flex items-center justify-center">
      {stars.map((star) => (
        <motion.span
          key={star.id}
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full bg-white"
          style={{ width: 2, height: star.length }}
          initial={{ opacity: 0, x: star.x, y: 80 }}
          animate={{
            opacity: exiting ? 0 : [0, 1, 0],
            y: exiting ? -500 : [-20, -320 - energy * 140],
            scaleY: [0.3, 1.8 + energy * 0.5],
          }}
          transition={{ duration: 0.5, delay: star.delay, repeat: Infinity, ease: 'easeIn' }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function InkDropLaunchAnimation({ application, energy, exiting, compact = false }) {
  const rings = useMemo(() => [0, 1, 2], []);
  return (
    <div className="relative flex items-center justify-center">
      {rings.map((ring) => (
        <motion.span
          key={ring}
          className="pointer-events-none absolute rounded-full border border-white/40"
          animate={{
            width: exiting ? compact ? 200 : 300 : [0, compact ? 140 + energy * 40 : 220 + energy * 60],
            height: exiting ? compact ? 200 : 300 : [0, compact ? 140 + energy * 40 : 220 + energy * 60],
            opacity: exiting ? 0 : [0.7, 0],
          }}
          transition={{ duration: 1.4, delay: ring * 0.35, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function FoldLaunchAnimation({ application, energy, exiting, compact = false }) {
  const panels = 3;
  const panelW = compact ? 28 : 38;
  return (
    <div className="relative flex items-center justify-center" style={{ perspective: 700 }}>
      {Array.from({ length: panels }).map((_, index) => (
        <motion.div
          key={index}
          className="absolute overflow-hidden rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm"
          style={{ width: panelW, height: compact ? 72 : 100, transformOrigin: index === 0 ? 'right center' : index === panels - 1 ? 'left center' : 'center center' }}
          animate={{
            rotateY: exiting ? 0 : index === 0 ? [-90, 0] : index === panels - 1 ? [90, 0] : [0, 0],
            x: index === 0 ? -panelW : index === panels - 1 ? panelW : 0,
            opacity: exiting ? 0 : [0.5, 1],
          }}
          transition={{ duration: 0.9 - energy * 0.2, delay: index * 0.08, repeat: Infinity, repeatDelay: 0.8 }}
        />
      ))}
      <motion.div animate={{ opacity: exiting ? 0 : [0, 1], scale: exiting ? 1.3 : [0.8, 1] }} transition={{ duration: 0.8, delay: 0.3, repeat: Infinity, repeatDelay: 0.8 }}>
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function RingFireLaunchAnimation({ application, energy, exiting, compact = false }) {
  const size = compact ? 88 : 120;
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: size,
          height: size,
          background: 'conic-gradient(from 0deg, #f97316, #ef4444, #fbbf24, #f97316)',
          filter: 'blur(6px)',
        }}
        animate={{ rotate: exiting ? 180 : 360, opacity: exiting ? 0 : [0.5, 0.9, 0.55], scale: [0.95, 1.08 + energy * 0.1, 0.98] }}
        transition={{ rotate: { duration: 2, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.8, repeat: Infinity } }}
      />
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function DnaLaunchAnimation({ application, energy, exiting, compact = false }) {
  const dots = compact ? 8 : 12;
  return (
    <div className="relative flex items-center justify-center">
      {Array.from({ length: dots }).map((_, index) => (
        <React.Fragment key={index}>
          <motion.span
            className="pointer-events-none absolute h-2 w-2 rounded-full bg-sky-300"
            animate={{
              x: exiting ? 0 : [Math.sin(index * 0.8) * (20 + energy * 12), Math.sin(index * 0.8 + Math.PI) * (20 + energy * 12)],
              y: exiting ? 0 : [(index - dots / 2) * (compact ? 6 : 8), (index - dots / 2) * (compact ? 6 : 8)],
              opacity: exiting ? 0 : [0.4, 1, 0.4],
            }}
            transition={{ duration: 1.2, delay: index * 0.05, repeat: Infinity }}
          />
          <motion.span
            className="pointer-events-none absolute h-2 w-2 rounded-full bg-violet-300"
            animate={{
              x: exiting ? 0 : [Math.sin(index * 0.8 + Math.PI) * (20 + energy * 12), Math.sin(index * 0.8) * (20 + energy * 12)],
              y: exiting ? 0 : [(index - dots / 2) * (compact ? 6 : 8), (index - dots / 2) * (compact ? 6 : 8)],
              opacity: exiting ? 0 : [0.4, 1, 0.4],
            }}
            transition={{ duration: 1.2, delay: index * 0.05, repeat: Infinity }}
          />
        </React.Fragment>
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function RadarLaunchAnimation({ application, energy, exiting, compact = false }) {
  const size = compact ? 100 : 140;
  return (
    <div className="relative flex items-center justify-center">
      <div className="pointer-events-none absolute rounded-full border border-emerald-400/30" style={{ width: size, height: size }} />
      <motion.div
        className="pointer-events-none absolute origin-bottom rounded-t-full bg-gradient-to-t from-emerald-400/50 to-transparent"
        style={{ width: size / 2, height: size / 2, bottom: '50%', left: '50%', marginLeft: -(size / 4) }}
        animate={{ rotate: exiting ? 0 : [0, 360] }}
        transition={{ duration: 2.2 - energy * 0.6, repeat: Infinity, ease: 'linear' }}
      />
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function ConstellationLaunchAnimation({ application, energy, exiting, compact = false }) {
  const stars = useMemo(
    () => Array.from({ length: compact ? 5 : 7 }, (_, index) => ({
      id: index,
      x: Math.cos((index / (compact ? 5 : 7)) * Math.PI * 2) * (compact ? 38 : 52),
      y: Math.sin((index / (compact ? 5 : 7)) * Math.PI * 2) * (compact ? 38 : 52),
    })),
    [compact],
  );

  return (
    <div className="relative flex items-center justify-center">
      <svg className="pointer-events-none absolute overflow-visible" width={compact ? 100 : 140} height={compact ? 100 : 140}>
        {stars.map((star, index) => (
          index > 0 ? (
            <motion.line
              key={`line-${star.id}`}
              x1={stars[0].x + (compact ? 50 : 70)}
              y1={stars[0].y + (compact ? 50 : 70)}
              x2={star.x + (compact ? 50 : 70)}
              y2={star.y + (compact ? 50 : 70)}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1"
              animate={{ opacity: exiting ? 0 : [0.2, 0.8, 0.3] }}
              transition={{ duration: 1, delay: index * 0.1, repeat: Infinity }}
            />
          ) : null
        ))}
      </svg>
      {stars.map((star) => (
        <motion.span
          key={star.id}
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-white"
          style={{ left: `calc(50% + ${star.x}px)`, top: `calc(50% + ${star.y}px)` }}
          animate={{ opacity: exiting ? 0 : [0.3, 1, 0.5], scale: [0.8, 1.2 + energy * 0.2, 0.9] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function ParticleBurstLaunchAnimation({ application, energy, exiting, compact = false }) {
  const particles = useMemo(
    () => Array.from({ length: compact ? 12 : 20 }, (_, index) => ({
      id: index,
      angle: (index / (compact ? 12 : 20)) * 360,
      distance: randomBetween(compact ? 35 : 50, compact ? 60 : 85),
    })),
    [compact],
  );

  return (
    <div className="relative flex items-center justify-center">
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-amber-200"
          animate={{
            x: exiting ? 0 : [0, Math.cos((particle.angle * Math.PI) / 180) * particle.distance],
            y: exiting ? 0 : [0, Math.sin((particle.angle * Math.PI) / 180) * particle.distance],
            opacity: exiting ? 0 : [1, 0],
            scale: [1, 0.3],
          }}
          transition={{ duration: 0.8 + energy * 0.2, repeat: Infinity, repeatDelay: 0.5 }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function PixelateLaunchAnimation({ application, energy, exiting, compact = false }) {
  const blocks = compact ? 4 : 5;
  const size = compact ? 72 : 100;
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute overflow-hidden rounded-2xl"
        style={{ width: size, height: size, imageRendering: 'pixelated' }}
        animate={{ filter: exiting ? 'blur(4px)' : ['contrast(1.8) saturate(0.4)', 'contrast(1) saturate(1)'] }}
        transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.5 }}
      >
        <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${blocks}, 1fr)` }}>
          {Array.from({ length: blocks * blocks }).map((_, index) => (
            <motion.div
              key={index}
              className="bg-white/10"
              animate={{ opacity: exiting ? 0 : [0.2, 0.9, 0.3], scale: [0.5, 1 + energy * 0.1, 0.8] }}
              transition={{ duration: 0.5, delay: (index % blocks) * 0.04, repeat: Infinity, repeatDelay: 0.6 }}
            />
          ))}
        </div>
      </motion.div>
      <motion.div animate={{ opacity: exiting ? 0 : [0.4, 1], scale: exiting ? 1.3 : [0.85, 1] }} transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 0.6 }}>
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function CorruptLaunchAnimation({ application, energy, exiting, compact = false }) {
  const cols = compact ? 5 : 7;
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-2xl">
      {Array.from({ length: cols }).map((_, index) => (
        <motion.div
          key={index}
          className="absolute top-0 bottom-0 overflow-hidden"
          style={{ left: `${(index / cols) * 100}%`, width: `${100 / cols}%` }}
          animate={{
            y: exiting ? 0 : [0, (index % 2 === 0 ? 1 : -1) * (8 + energy * 12), 0],
            opacity: exiting ? 0 : [0.5, 1, 0.6],
          }}
          transition={{ duration: 0.35, delay: index * 0.04, repeat: Infinity }}
        >
          <div className="flex h-full w-full items-center justify-center" style={{ transform: `translateX(-${index * (100 / cols)}%)` }}>
            <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function HoloFlickerLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="pointer-events-none absolute rounded-2xl border border-cyan-300/40"
        style={{ width: compact ? 88 : 120, height: compact ? 88 : 120 }}
        animate={{ opacity: exiting ? 0 : [0, 1, 0, 1, 0.3, 1], scale: [0.95, 1.02, 0.98] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      />
      <motion.div
        animate={{
          opacity: exiting ? 0 : [0.2, 1, 0.1, 0.9, 0.4, 1],
          filter: exiting ? 'blur(8px)' : ['blur(4px)', 'blur(0px)', 'blur(2px)', 'blur(0px)'],
        }}
        transition={{ duration: 0.45, repeat: Infinity }}
      >
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function WireframeLaunchAnimation({ application, energy, exiting, compact = false }) {
  const size = compact ? 100 : 140;
  return (
    <div className="relative flex items-center justify-center" style={{ perspective: 700 }}>
      <motion.div
        className="pointer-events-none absolute border border-cyan-300/50"
        style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
        animate={{ rotateX: exiting ? 60 : [45, 55 + energy * 10, 45], rotateY: exiting ? 0 : 360 }}
        transition={{ rotateY: { duration: 4, repeat: Infinity, ease: 'linear' }, rotateX: { duration: 2, repeat: Infinity } }}
      >
        <div className="absolute inset-0 border border-cyan-300/30" style={{ transform: 'translateZ(20px)' }} />
        <div className="absolute inset-2 border border-cyan-300/20" style={{ transform: 'translateZ(-15px)' }} />
      </motion.div>
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function TeleportLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-2xl">
      <motion.div
        className="pointer-events-none absolute w-1 rounded-full bg-gradient-to-b from-transparent via-cyan-200 to-white"
        style={{ height: compact ? 120 : 180 }}
        animate={{ opacity: exiting ? 0 : [0.3, 1, 0.4], scaleY: exiting ? 0 : [0.2, 1 + energy * 0.3, 0.8] }}
        transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.3 }}
      />
      <motion.div
        animate={{ opacity: exiting ? 0 : [0, 0.3, 1], y: exiting ? -40 : [30, 0], scale: exiting ? 1.4 : [0.6, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.3 }}
      >
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function ShockwaveLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center">
      {[0, 1, 2].map((ring) => (
        <motion.span
          key={ring}
          className="pointer-events-none absolute rounded-full border-2 border-white/50"
          animate={{
            width: exiting ? compact ? 200 : 280 : [0, compact ? 160 + energy * 40 : 240 + energy * 60],
            height: exiting ? compact ? 200 : 280 : [0, compact ? 160 + energy * 40 : 240 + energy * 60],
            opacity: exiting ? 0 : [0.8, 0],
          }}
          transition={{ duration: 1.1, delay: ring * 0.25, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function TornadoLaunchAnimation({ application, energy, exiting, compact = false }) {
  const grains = compact ? 10 : 16;
  return (
    <div className="relative flex items-center justify-center">
      {Array.from({ length: grains }).map((_, index) => (
        <motion.span
          key={index}
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-amber-200/80"
          animate={{
            x: exiting ? 0 : [Math.cos(index) * 50, 0],
            y: exiting ? 0 : [40, -20 - energy * 15],
            opacity: exiting ? 0 : [0.8, 0],
            rotate: [0, 360],
          }}
          transition={{ duration: 1 + index * 0.04, repeat: Infinity, ease: 'easeIn' }}
        />
      ))}
      <motion.div animate={{ y: exiting ? -30 : [20, 0], opacity: exiting ? 0 : [0.5, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function BloomLaunchAnimation({ application, energy, exiting, compact = false }) {
  const petals = compact ? 6 : 8;
  return (
    <div className="relative flex items-center justify-center">
      {Array.from({ length: petals }).map((_, index) => (
        <motion.div
          key={index}
          className="pointer-events-none absolute rounded-full bg-gradient-to-tr from-pink-300/60 to-violet-300/40"
          style={{ width: compact ? 20 : 28, height: compact ? 36 : 48, transformOrigin: 'center bottom' }}
          animate={{
            rotate: (index / petals) * 360,
            scale: exiting ? 0 : [0.3, 1 + energy * 0.2, 0.9],
            opacity: exiting ? 0 : [0.4, 0.8, 0.5],
          }}
          transition={{ duration: 1.1, delay: index * 0.05, repeat: Infinity, repeatDelay: 0.5 }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function MosaicLaunchAnimation({ application, energy, exiting, compact = false }) {
  const tiles = compact ? 9 : 16;
  const grid = compact ? 3 : 4;
  const colors = ['#38bdf8', '#a78bfa', '#f472b6', '#34d399'];
  return (
    <div className="relative flex items-center justify-center">
      {Array.from({ length: tiles }).map((_, index) => (
        <motion.div
          key={index}
          className="pointer-events-none absolute rounded-sm"
          style={{
            width: compact ? 14 : 18,
            height: compact ? 14 : 18,
            background: colors[index % colors.length],
            left: `calc(50% + ${((index % grid) - grid / 2 + 0.5) * (compact ? 18 : 22)}px)`,
            top: `calc(50% + ${(Math.floor(index / grid) - grid / 2 + 0.5) * (compact ? 18 : 22)}px)`,
          }}
          animate={{
            x: exiting ? 0 : [((index % grid) - 1) * (compact ? 28 : 36), 0],
            y: exiting ? 0 : [(Math.floor(index / grid) - 1) * (compact ? 28 : 36), 0],
            opacity: exiting ? 0 : [0.3, 0.9],
            rotate: [(index % 3 - 1) * 20, 0],
          }}
          transition={{ duration: 0.7 + energy * 0.2, delay: index * 0.03, repeat: Infinity, repeatDelay: 0.7 }}
        />
      ))}
      <motion.div animate={{ opacity: exiting ? 0 : [0, 1], scale: exiting ? 1.3 : [0.8, 1] }} transition={{ duration: 0.6, delay: 0.3, repeat: Infinity, repeatDelay: 0.7 }}>
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export function PlasmaLaunchAnimation({ application, energy, exiting, compact = false }) {
  const size = compact ? 100 : 140;
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="pointer-events-none absolute rounded-full blur-xl"
        style={{
          width: size,
          height: size,
          background: 'radial-gradient(circle, rgba(167,139,250,0.7), rgba(56,189,248,0.4), transparent 70%)',
        }}
        animate={{ scale: exiting ? 2 : [0.8, 1.2 + energy * 0.15, 0.9], rotate: 360, opacity: exiting ? 0 : [0.5, 0.9, 0.55] }}
        transition={{ rotate: { duration: 3, repeat: Infinity, ease: 'linear' }, scale: { duration: 1.2, repeat: Infinity } }}
      />
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function EclipseLaunchAnimation({ application, energy, exiting, compact = false }) {
  const size = compact ? 100 : 140;
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="pointer-events-none absolute rounded-full bg-black"
        style={{ width: size, height: size }}
        animate={{ x: exiting ? 0 : [size * 0.6, -size * 0.1], opacity: exiting ? 0 : [1, 0.2] }}
        transition={{ duration: 1.4 - energy * 0.3, repeat: Infinity, repeatDelay: 0.5 }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full bg-amber-200/30 blur-md"
        style={{ width: size * 0.9, height: size * 0.9 }}
        animate={{ scale: [0.9, 1.05, 0.95], opacity: [0.3, 0.6, 0.35] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function ZoomBlurLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <motion.div
      animate={{
        scale: exiting ? 2.5 : [2.2 - energy * 0.3, 1],
        opacity: exiting ? 0 : [0.3, 1],
        filter: exiting ? 'blur(12px)' : ['blur(10px)', 'blur(0px)'],
      }}
      transition={{ duration: exiting ? 0.35 : 1 - energy * 0.2, repeat: exiting ? 0 : Infinity, repeatDelay: 0.8 }}
    >
      <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
    </motion.div>
  );
}

export function PhoenixLaunchAnimation({ application, energy, exiting, compact = false }) {
  return (
    <div className="relative flex items-center justify-center">
      {[-1, 1].map((side) => (
        <motion.div
          key={side}
          className="pointer-events-none absolute rounded-full bg-gradient-to-t from-orange-500/70 via-amber-300/50 to-transparent"
          style={{
            width: compact ? 50 : 70,
            height: compact ? 70 : 95,
            left: side === -1 ? 'calc(50% - 55px)' : 'calc(50% - 15px)',
            transformOrigin: side === -1 ? 'right bottom' : 'left bottom',
          }}
          animate={{
            rotate: exiting ? 0 : [side * 25, side * (45 + energy * 15), side * 30],
            opacity: exiting ? 0 : [0.3, 0.85, 0.5],
            scale: [0.8, 1.1, 0.95],
          }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function GeometricLaunchAnimation({ application, energy, exiting, compact = false }) {
  const shapes = ['#38bdf8', '#a78bfa', '#f472b6'];
  return (
    <div className="relative flex items-center justify-center">
      {shapes.map((color, index) => (
        <motion.div
          key={color}
          className="pointer-events-none absolute border-2"
          style={{
            width: compact ? 50 + index * 12 : 70 + index * 16,
            height: compact ? 50 + index * 12 : 70 + index * 16,
            borderColor: color,
            clipPath: index === 0 ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' : index === 1 ? 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' : 'polygon(50% 0%, 100% 100%, 0% 100%)',
          }}
          animate={{ rotate: exiting ? 120 : 360, opacity: exiting ? 0 : [0.25, 0.7, 0.35], scale: [0.9, 1.05 + energy * 0.08, 0.95] }}
          transition={{ rotate: { duration: 3 + index, repeat: Infinity, ease: 'linear' }, opacity: { duration: 1.2, repeat: Infinity } }}
        />
      ))}
      <AnimatedBadge application={application} compact={compact} energy={energy} exiting={exiting} />
    </div>
  );
}

export function SandstormLaunchAnimation({ application, energy, exiting, compact = false }) {
  const grains = useMemo(
    () => Array.from({ length: compact ? 20 : 32 }, (_, index) => ({
      id: index,
      x: randomBetween(-60, 60),
      y: randomBetween(-40, 40),
      delay: randomBetween(0, 0.8),
    })),
    [compact],
  );

  return (
    <div className="relative flex items-center justify-center">
      {grains.map((grain) => (
        <motion.span
          key={grain.id}
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-amber-200/70"
          animate={{
            x: exiting ? 0 : [grain.x, grain.x + 30 + energy * 20],
            y: exiting ? 0 : [grain.y, grain.y - 10],
            opacity: exiting ? 0 : [0.7, 0],
          }}
          transition={{ duration: 0.8, delay: grain.delay, repeat: Infinity }}
        />
      ))}
      <motion.div animate={{ opacity: exiting ? 0 : [0.4, 1], scale: exiting ? 1.2 : [0.9, 1] }} transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.4 }}>
        <LaunchAppBadge application={application} size={compact ? 'md' : 'lg'} />
      </motion.div>
    </div>
  );
}

export const LAUNCH_ANIMATION_COMPONENTS = {
  warp: WarpLaunchAnimation,
  ripple: RippleLaunchAnimation,
  orbit: OrbitLaunchAnimation,
  portal: PortalLaunchAnimation,
  ignite: IgniteLaunchAnimation,
  pulse: PulseLaunchAnimation,
  aurora: AuroraLaunchAnimation,
  glitch: GlitchLaunchAnimation,
  liquid: LiquidLaunchAnimation,
  vortex: VortexLaunchAnimation,
  magnetic: MagneticLaunchAnimation,
  comet: CometLaunchAnimation,
  matrix: MatrixLaunchAnimation,
  neon: NeonLaunchAnimation,
  bounce: BounceLaunchAnimation,
  hologram: HologramLaunchAnimation,
  prism: PrismLaunchAnimation,
  smoke: SmokeLaunchAnimation,
  glitch_rgb: GlitchRgbLaunchAnimation,
  static_burst: StaticBurstLaunchAnimation,
  datamosh: DatamoshLaunchAnimation,
  hologram_grid: HologramGridLaunchAnimation,
  scanline: ScanlineLaunchAnimation,
  cyber_hex: CyberHexLaunchAnimation,
  laser_grid: LaserGridLaunchAnimation,
  crystal: CrystalLaunchAnimation,
  flip: FlipLaunchAnimation,
  star_warp: StarWarpLaunchAnimation,
  ink_drop: InkDropLaunchAnimation,
  fold: FoldLaunchAnimation,
  ring_fire: RingFireLaunchAnimation,
  dna: DnaLaunchAnimation,
  radar: RadarLaunchAnimation,
  constellation: ConstellationLaunchAnimation,
  particle_burst: ParticleBurstLaunchAnimation,
  pixelate: PixelateLaunchAnimation,
  corrupt: CorruptLaunchAnimation,
  holo_flicker: HoloFlickerLaunchAnimation,
  wireframe: WireframeLaunchAnimation,
  teleport: TeleportLaunchAnimation,
  shockwave: ShockwaveLaunchAnimation,
  tornado: TornadoLaunchAnimation,
  bloom: BloomLaunchAnimation,
  mosaic: MosaicLaunchAnimation,
  plasma: PlasmaLaunchAnimation,
  eclipse: EclipseLaunchAnimation,
  zoom_blur: ZoomBlurLaunchAnimation,
  phoenix: PhoenixLaunchAnimation,
  geometric: GeometricLaunchAnimation,
  sandstorm: SandstormLaunchAnimation,
};

export function useRipplePoints() {
  const [ripples, setRipples] = useState([]);

  const addRipple = (event, bounds) => {
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const id = `${Date.now()}-${Math.random()}`;

    setRipples((current) => [...current.slice(-8), { id, x, y }]);

    window.setTimeout(() => {
      setRipples((current) => current.filter((item) => item.id !== id));
    }, 950);
  };

  return { ripples, addRipple };
}

export function useOrbiterPoints(initialCount = 3) {
  const [orbiters, setOrbiters] = useState(() =>
    Array.from({ length: initialCount }, (_, index) => ({ id: `base-${index}` })),
  );

  const addOrbiter = () => {
    setOrbiters((current) => {
      if (current.length >= 8) return current;
      return [...current, { id: `${Date.now()}-${Math.random()}` }];
    });
  };

  return { orbiters, addOrbiter };
}

export function useLaunchEnergy(autoBoostMs = 120) {
  const [energy, setEnergy] = useState(0);

  const boost = (amount = 0.12) => {
    setEnergy((current) => Math.min(1, current + amount));
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setEnergy((current) => Math.min(1, current + 0.015));
    }, autoBoostMs);

    return () => window.clearInterval(timer);
  }, [autoBoostMs]);

  return { energy, boost };
}
