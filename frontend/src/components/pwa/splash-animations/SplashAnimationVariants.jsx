import React, { createContext, useContext, useMemo } from 'react';
import { motion } from 'framer-motion';

import { buildSplashRuntime, isSplashAnimationInteractive } from '@/lib/splashConfig';
import SplashExperienceFrame from '@/components/pwa/splash-animations/SplashExperienceFrame';
import SplashMedia from '@/components/pwa/splash-animations/SplashMedia';
import { InteractiveSplashShell, useSplashInteraction } from '@/components/pwa/splash-animations/SplashInteractionContext';

const SplashRuntimeContext = createContext(buildSplashRuntime());

function useSplashRuntime() {
  return useContext(SplashRuntimeContext);
}

function SplashLogo({ className = 'h-24 w-24 sm:h-28 sm:w-28' }) {
  const runtime = useSplashRuntime();
  return <SplashMedia runtime={runtime} className={className} />;
}

function PulseRingAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const rings = [
    { delay: 0, color: runtime.withAlpha('#FFFFFF', 0.4) },
    { delay: 0.28, color: runtime.withAlpha(runtime.theme.secondary, 0.5) },
    { delay: 0.56, color: runtime.withAlpha(runtime.theme.accent, 0.45) },
  ];

  return (
    <div className="relative flex items-center justify-center">
      {rings.map((ring, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full border"
          style={{ borderColor: ring.color }}
          initial={{ width: 64, height: 64, opacity: 0.85 }}
          animate={{ width: 230, height: 230, opacity: 0 }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.5) : runtime.scaleDuration(1.85),
            repeat: preview ? Infinity : 0,
            delay: runtime.scaleDuration(ring.delay),
            ease: [0.22, 1, 0.36, 1],
          }}
          onAnimationComplete={!preview && index === rings.length - 1 ? onComplete : undefined}
        />
      ))}
      <motion.div
        initial={{ scale: 0.82, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: runtime.scaleDuration(0.65), ease: [0.22, 1, 0.36, 1] }}
      >
        <SplashLogo />
      </motion.div>
    </div>
  );
}

function OrbitAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const dots = Array.from({ length: 6 }, (_, index) => index);

  return (
    <div className="relative flex h-48 w-48 items-center justify-center">
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: preview ? 360 : 180 }}
        transition={{
          duration: preview ? runtime.scaleDuration(3) : runtime.scaleDuration(2.2),
          repeat: preview ? Infinity : 0,
          ease: 'linear',
        }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        {dots.map((index) => {
          const angle = (index / dots.length) * Math.PI * 2;
          const radius = 78;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <motion.span
              key={index}
              className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                backgroundColor: runtime.theme.accent,
                boxShadow: `0 0 14px ${runtime.withAlpha(runtime.theme.accent, 0.85)}`,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              }}
              animate={{ opacity: [0.35, 1, 0.35], scale: [0.8, 1.15, 0.8] }}
              transition={{
                duration: runtime.scaleDuration(1.2),
                repeat: preview ? Infinity : 0,
                delay: runtime.scaleDuration(index * 0.08),
              }}
            />
          );
        })}
      </motion.div>
      <SplashLogo />
    </div>
  );
}

function NeuralAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const nodes = [
    { x: -92, y: -28 },
    { x: 96, y: -36 },
    { x: -78, y: 72 },
    { x: 88, y: 64 },
    { x: 0, y: -96 },
    { x: 0, y: 96 },
  ];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <svg className="absolute inset-0 h-full w-full" viewBox="-120 -120 240 240" aria-hidden="true">
        {nodes.map((node, index) => (
          <motion.line
            key={`line-${index}`}
            x1="0"
            y1="0"
            x2={node.x}
            y2={node.y}
            stroke={runtime.withAlpha(runtime.theme.secondary, 0.45)}
            strokeWidth="1.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.75 }}
            transition={{ duration: runtime.scaleDuration(0.8), delay: runtime.scaleDuration(index * 0.08) }}
          />
        ))}
      </svg>
      {nodes.map((node, index) => (
        <motion.span
          key={`node-${index}`}
          className="absolute h-2.5 w-2.5 rounded-full bg-white/90"
          style={{ left: `calc(50% + ${node.x}px)`, top: `calc(50% + ${node.y}px)` }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0.85] }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.4) : runtime.scaleDuration(1.8),
            repeat: preview ? Infinity : 0,
            delay: runtime.scaleDuration(0.2 + index * 0.1),
          }}
          onAnimationComplete={!preview && index === nodes.length - 1 ? onComplete : undefined}
        />
      ))}
      <SplashLogo className="h-20 w-20 sm:h-24 sm:w-24" />
    </div>
  );
}

function ShimmerAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative overflow-hidden rounded-3xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.7), ease: 'easeOut' }}
      >
        <SplashLogo className="h-28 w-28 sm:h-32 sm:w-32" />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent to-transparent"
        style={{ backgroundImage: `linear-gradient(90deg, transparent, ${runtime.withAlpha(runtime.theme.accent, 0.25)}, transparent)` }}
        initial={{ x: '-120%' }}
        animate={{ x: preview ? ['-120%', '120%'] : '120%' }}
        transition={{
          duration: preview ? runtime.scaleDuration(1.8) : runtime.scaleDuration(1.4),
          repeat: preview ? Infinity : 0,
          ease: 'easeInOut',
          delay: runtime.scaleDuration(0.35),
        }}
        onAnimationComplete={!preview ? onComplete : undefined}
      />
    </div>
  );
}

function ConstellationAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const stars = [
    { x: -70, y: -58, delay: 0 },
    { x: 82, y: -44, delay: 0.08 },
    { x: -58, y: 66, delay: 0.16 },
    { x: 64, y: 72, delay: 0.24 },
    { x: 0, y: -88, delay: 0.32 },
    { x: -92, y: 8, delay: 0.4 },
    { x: 92, y: 10, delay: 0.48 },
  ];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <svg className="absolute inset-0 h-full w-full" viewBox="-100 -100 200 200" aria-hidden="true">
        {stars.slice(0, 4).map((star, index) => (
          <motion.line
            key={`link-${index}`}
            x1={stars[0].x * 0.55}
            y1={stars[0].y * 0.55}
            x2={star.x * 0.55}
            y2={star.y * 0.55}
            stroke={runtime.withAlpha('#FFFFFF', 0.18)}
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.5 }}
            transition={{ duration: runtime.scaleDuration(0.9), delay: runtime.scaleDuration(0.15 + index * 0.08) }}
          />
        ))}
      </svg>
      {stars.map((star, index) => (
        <motion.span
          key={index}
          className="absolute h-1.5 w-1.5 rounded-full bg-white/80"
          style={{ left: `calc(50% + ${star.x}px)`, top: `calc(50% + ${star.y}px)` }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0.7], scale: [0, 1.3, 1] }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.5) : runtime.scaleDuration(1.2),
            repeat: preview ? Infinity : 0,
            delay: runtime.scaleDuration(star.delay),
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.8), delay: runtime.scaleDuration(0.55), ease: 'easeOut' }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-20 w-20 sm:h-24 sm:w-24" />
      </motion.div>
    </div>
  );
}

function SpinGlowAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute h-40 w-40 rounded-full"
        style={{
          background: `radial-gradient(circle, ${runtime.withAlpha(runtime.theme.accent, 0.4)} 0%, ${runtime.withAlpha(runtime.theme.secondary, 0.15)} 45%, transparent 72%)`,
        }}
        animate={{ scale: [0.9, 1.08, 0.95], opacity: [0.45, 0.85, 0.5] }}
        transition={{
          duration: preview ? runtime.scaleDuration(2) : runtime.scaleDuration(1.8),
          repeat: preview ? Infinity : 0,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute h-44 w-44 rounded-full border border-dashed border-white/25"
        animate={{ rotate: preview ? 360 : 180 }}
        transition={{
          duration: preview ? runtime.scaleDuration(4) : runtime.scaleDuration(2.2),
          repeat: preview ? Infinity : 0,
          ease: 'linear',
        }}
        onAnimationComplete={!preview ? onComplete : undefined}
      />
      <SplashLogo />
    </div>
  );
}

function FadeRiseAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: preview ? runtime.scaleDuration(1.4) : runtime.scaleDuration(1.1),
        repeat: preview ? Infinity : 0,
        repeatType: preview ? 'reverse' : undefined,
        ease: [0.22, 1, 0.36, 1],
      }}
      onAnimationComplete={!preview ? onComplete : undefined}
    >
      <SplashLogo className="h-28 w-28 sm:h-32 sm:w-32" />
    </motion.div>
  );
}

function ParticleBurstAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const particles = useMemo(
    () => Array.from({ length: 14 }, (_, index) => {
      const angle = (index / 14) * Math.PI * 2 + 0.2;
      const distance = 72 + (index % 3) * 28;
      const color = index % 3 === 0
        ? runtime.theme.accent
        : index % 3 === 1
          ? runtime.theme.secondary
          : 'rgba(255,255,255,0.9)';

      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        color,
        size: index % 2 === 0 ? 6 : 4,
        delay: (index % 5) * 0.03,
      };
    }),
    [runtime.theme.accent, runtime.theme.secondary],
  );

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {particles.map((particle, index) => (
        <motion.span
          key={index}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            boxShadow: `0 0 10px ${particle.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.2 }}
          animate={{
            x: particle.x,
            y: particle.y,
            opacity: preview ? [0, 1, 0.35, 1] : [0, 1, 0],
            scale: preview ? [0.2, 1.1, 0.7, 1] : [0.2, 1.15, 0.4],
          }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.6) : runtime.scaleDuration(1.05),
            repeat: preview ? Infinity : 0,
            delay: runtime.scaleDuration(particle.delay),
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.55, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{
          duration: preview ? runtime.scaleDuration(1.2) : runtime.scaleDuration(0.85),
          delay: preview ? runtime.scaleDuration(0.45) : runtime.scaleDuration(0.65),
          ease: [0.22, 1, 0.36, 1],
        }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function LogoMorphAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute h-36 w-36 rounded-full"
        style={{
          background: `radial-gradient(circle, ${runtime.withAlpha(runtime.theme.secondary, 0.35)} 0%, transparent 72%)`,
        }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: preview ? [0.4, 1.15, 0.95, 1.05] : [0.4, 1.12, 1], opacity: [0, 0.75, 0.45] }}
        transition={{
          duration: preview ? runtime.scaleDuration(2) : runtime.scaleDuration(1.4),
          repeat: preview ? Infinity : 0,
          ease: 'easeOut',
        }}
      />
      <motion.div
        initial={{
          opacity: 0,
          scale: 0.35,
          rotate: -8,
          filter: 'blur(16px) brightness(1.35)',
        }}
        animate={{
          opacity: 1,
          scale: preview ? [0.35, 1.08, 0.98, 1] : [0.35, 1.06, 1],
          rotate: 0,
          filter: 'blur(0px) brightness(1)',
        }}
        transition={{
          duration: preview ? runtime.scaleDuration(1.8) : runtime.scaleDuration(1.35),
          repeat: preview ? Infinity : 0,
          repeatDelay: preview ? runtime.scaleDuration(0.35) : 0,
          ease: [0.22, 1, 0.36, 1],
        }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-28 w-28 sm:h-32 sm:w-32" />
      </motion.div>
    </div>
  );
}

function AuroraWaveAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const blobs = [
    { x: -40, y: -20, color: runtime.theme.secondary, delay: 0 },
    { x: 36, y: 24, color: runtime.theme.accent, delay: 0.2 },
    { x: 0, y: -48, color: '#FFFFFF', delay: 0.35 },
  ];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      {blobs.map((blob, index) => (
        <motion.div
          key={index}
          className="absolute h-32 w-32 rounded-full blur-2xl"
          style={{ backgroundColor: runtime.withAlpha(blob.color, 0.45) }}
          initial={{ x: blob.x, y: blob.y, scale: 0.6, opacity: 0 }}
          animate={{
            x: preview ? [blob.x, blob.x + 12, blob.x - 8, blob.x] : [blob.x, blob.x + 8, blob.x],
            y: preview ? [blob.y, blob.y - 10, blob.y + 6, blob.y] : [blob.y, blob.y - 6, blob.y],
            scale: preview ? [0.6, 1.1, 0.95, 1] : [0.6, 1.05, 1],
            opacity: preview ? [0, 0.8, 0.5, 0.8] : [0, 0.75, 0.55],
          }}
          transition={{
            duration: preview ? runtime.scaleDuration(2.4) : runtime.scaleDuration(2),
            repeat: preview ? Infinity : 0,
            delay: runtime.scaleDuration(blob.delay),
            ease: 'easeInOut',
          }}
          onAnimationComplete={!preview && index === blobs.length - 1 ? onComplete : undefined}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.7), delay: runtime.scaleDuration(0.35) }}
      >
        <SplashLogo />
      </motion.div>
    </div>
  );
}

function RadarSweepAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <div
        className="absolute h-44 w-44 rounded-full border"
        style={{ borderColor: runtime.withAlpha(runtime.theme.secondary, 0.25) }}
      />
      <div
        className="absolute h-32 w-32 rounded-full border"
        style={{ borderColor: runtime.withAlpha(runtime.theme.secondary, 0.18) }}
      />
      <motion.div
        className="absolute h-44 w-44 origin-center"
        animate={{ rotate: preview ? 360 : 360 }}
        transition={{
          duration: preview ? runtime.scaleDuration(2.5) : runtime.scaleDuration(2),
          repeat: preview ? Infinity : 0,
          ease: 'linear',
        }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <div
          className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-bottom-left -translate-x-full rounded-tl-full"
          style={{
            background: `conic-gradient(from 0deg, ${runtime.withAlpha(runtime.theme.accent, 0.55)} 0deg, transparent 70deg, transparent 360deg)`,
          }}
        />
        <span
          className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ backgroundColor: runtime.theme.accent, boxShadow: `0 0 12px ${runtime.withAlpha(runtime.theme.accent, 0.9)}` }}
        />
      </motion.div>
      <SplashLogo className="h-20 w-20 sm:h-24 sm:w-24" />
    </div>
  );
}

function BounceInAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <motion.div
      initial={{ opacity: 0, y: -80, scale: 0.5 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: preview ? [0.5, 1.12, 0.94, 1.04, 1] : [0.5, 1.15, 0.92, 1.02, 1],
      }}
      transition={{
        duration: preview ? runtime.scaleDuration(1.6) : runtime.scaleDuration(1.2),
        repeat: preview ? Infinity : 0,
        repeatDelay: preview ? runtime.scaleDuration(0.5) : 0,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      onAnimationComplete={!preview ? onComplete : undefined}
    >
      <SplashLogo className="h-28 w-28 sm:h-32 sm:w-32" />
    </motion.div>
  );
}

function FlipRevealAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex items-center justify-center" style={{ perspective: 800 }}>
      <motion.div
        initial={{ rotateY: -90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{
          duration: preview ? runtime.scaleDuration(1.4) : runtime.scaleDuration(1.05),
          repeat: preview ? Infinity : 0,
          repeatType: preview ? 'reverse' : undefined,
          repeatDelay: preview ? runtime.scaleDuration(0.4) : 0,
          ease: [0.22, 1, 0.36, 1],
        }}
        onAnimationComplete={!preview ? onComplete : undefined}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <SplashLogo className="h-28 w-28 sm:h-32 sm:w-32" />
      </motion.div>
    </div>
  );
}

function RipplePondAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const ripples = [0, 1, 2, 3];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {ripples.map((index) => (
        <motion.span
          key={index}
          className="absolute rounded-full border-2"
          style={{ borderColor: runtime.withAlpha(runtime.theme.secondary, 0.5) }}
          initial={{ width: 48, height: 48, opacity: 0.7 }}
          animate={{ width: 240, height: 240, opacity: 0 }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.8) : runtime.scaleDuration(1.6),
            repeat: preview ? Infinity : 0,
            delay: runtime.scaleDuration(index * 0.28),
            ease: 'easeOut',
          }}
          onAnimationComplete={!preview && index === ripples.length - 1 ? onComplete : undefined}
        />
      ))}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: runtime.scaleDuration(0.5), delay: runtime.scaleDuration(0.2) }}
      >
        <SplashLogo />
      </motion.div>
    </div>
  );
}

function PortalGateAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {[-1, 1].map((side) => (
        <motion.div
          key={side}
          className="absolute h-40 w-20 origin-center rounded-full border-4"
          style={{
            borderColor: runtime.withAlpha(runtime.theme.accent, 0.85),
            boxShadow: `0 0 20px ${runtime.withAlpha(runtime.theme.accent, 0.45)}`,
            left: side < 0 ? 'calc(50% - 52px)' : 'calc(50% + 12px)',
            clipPath: side < 0 ? 'inset(0 50% 0 0)' : 'inset(0 0 0 50%)',
          }}
          initial={{ scaleX: 0.2, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{
            duration: runtime.scaleDuration(0.9),
            delay: runtime.scaleDuration(side < 0 ? 0 : 0.08),
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: runtime.scaleDuration(0.75),
          delay: runtime.scaleDuration(0.55),
          ease: [0.22, 1, 0.36, 1],
        }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function LightningStrikeAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const bolts = [
    { x: -58, y: -40, rotate: 18, delay: 0.1 },
    { x: 62, y: -28, rotate: -24, delay: 0.25 },
    { x: -42, y: 52, rotate: 12, delay: 0.4 },
  ];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {bolts.map((bolt, index) => (
        <motion.svg
          key={index}
          viewBox="0 0 24 48"
          className="absolute h-12 w-6"
          style={{ left: `calc(50% + ${bolt.x}px)`, top: `calc(50% + ${bolt.y}px)`, rotate: `${bolt.rotate}deg` }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: preview ? [0, 1, 0.2, 1] : [0, 1, 0, 0.6], scale: [0.6, 1.1, 0.8] }}
          transition={{
            duration: runtime.scaleDuration(0.45),
            delay: runtime.scaleDuration(bolt.delay),
            repeat: preview ? Infinity : 0,
            repeatDelay: preview ? runtime.scaleDuration(0.8) : 0,
          }}
        >
          <path
            d="M14 0 L6 22 H12 L8 48 L20 18 H14 Z"
            fill={runtime.theme.accent}
            style={{ filter: `drop-shadow(0 0 6px ${runtime.withAlpha(runtime.theme.accent, 0.9)})` }}
          />
        </motion.svg>
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, filter: 'brightness(2)' }}
        animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
        transition={{
          duration: runtime.scaleDuration(0.55),
          delay: runtime.scaleDuration(0.5),
          ease: 'easeOut',
        }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function DnaHelixAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const dots = Array.from({ length: 12 }, (_, index) => index);

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {dots.map((index) => {
        const phase = (index / dots.length) * Math.PI * 2;
        return (
          <motion.span
            key={index}
            className="absolute h-2 w-2 rounded-full"
            style={{
              backgroundColor: index % 2 === 0 ? runtime.theme.secondary : runtime.theme.accent,
              boxShadow: `0 0 8px ${runtime.withAlpha(index % 2 === 0 ? runtime.theme.secondary : runtime.theme.accent, 0.8)}`,
            }}
            animate={{
              x: preview
                ? [Math.cos(phase) * 56, Math.cos(phase + Math.PI) * 56, Math.cos(phase) * 56]
                : [Math.cos(phase) * 56, Math.cos(phase + Math.PI) * 56],
              y: preview
                ? [Math.sin(phase) * 36 - 40 + index * 7, Math.sin(phase) * 36 - 40 + index * 7]
                : [Math.sin(phase) * 36 - 40 + index * 7, Math.sin(phase + Math.PI) * 36 - 40 + index * 7],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: preview ? runtime.scaleDuration(2) : runtime.scaleDuration(1.6),
              repeat: preview ? Infinity : 0,
              delay: runtime.scaleDuration(index * 0.05),
              ease: 'easeInOut',
            }}
            onAnimationComplete={!preview && index === dots.length - 1 ? onComplete : undefined}
          />
        );
      })}
      <SplashLogo className="h-20 w-20 sm:h-24 sm:w-24" />
    </div>
  );
}

function HexBuildAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const hexes = [
    { x: -64, y: -20, delay: 0 },
    { x: 64, y: -20, delay: 0.08 },
    { x: -32, y: 48, delay: 0.16 },
    { x: 32, y: 48, delay: 0.24 },
    { x: 0, y: -58, delay: 0.32 },
    { x: 0, y: 58, delay: 0.4 },
  ];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {hexes.map((hex, index) => (
        <motion.svg
          key={index}
          viewBox="0 0 40 46"
          className="absolute h-10 w-9"
          style={{ left: `calc(50% + ${hex.x}px - 18px)`, top: `calc(50% + ${hex.y}px - 23px)` }}
          initial={{ opacity: 0, scale: 0.3, rotate: -20 }}
          animate={{ opacity: 0.85, scale: 1, rotate: 0 }}
          transition={{
            duration: runtime.scaleDuration(0.65),
            delay: runtime.scaleDuration(hex.delay),
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <polygon
            points="20,2 38,12 38,34 20,44 2,34 2,12"
            fill="none"
            stroke={runtime.withAlpha(runtime.theme.secondary, 0.75)}
            strokeWidth="2"
          />
        </motion.svg>
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.6), delay: runtime.scaleDuration(0.55) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-20 w-20 sm:h-24 sm:w-24" />
      </motion.div>
    </div>
  );
}

function ZoomPunchAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute h-48 w-48 rounded-full"
        style={{ background: `radial-gradient(circle, ${runtime.withAlpha(runtime.theme.accent, 0.35)} 0%, transparent 70%)` }}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: preview ? [0.2, 1.4, 1] : [0.2, 1.35, 1], opacity: [0, 0.8, 0] }}
        transition={{ duration: runtime.scaleDuration(0.8), ease: 'easeOut' }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.08 }}
        animate={{ opacity: 1, scale: preview ? [0.08, 1.18, 0.96, 1] : [0.08, 1.2, 1] }}
        transition={{
          duration: preview ? runtime.scaleDuration(1.2) : runtime.scaleDuration(0.85),
          repeat: preview ? Infinity : 0,
          repeatDelay: preview ? runtime.scaleDuration(0.6) : 0,
          ease: [0.22, 1, 0.36, 1],
        }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-28 w-28 sm:h-32 sm:w-32" />
      </motion.div>
    </div>
  );
}

function GlitchScanAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const slices = [0, 1, 2, 3];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      {slices.map((index) => (
        <motion.div
          key={index}
          className="absolute inset-x-8 h-5 rounded-sm"
          style={{
            top: `${28 + index * 18}%`,
            background: runtime.withAlpha(runtime.theme.secondary, 0.35),
          }}
          initial={{ opacity: 0, x: index % 2 === 0 ? -40 : 40 }}
          animate={{
            opacity: preview ? [0, 1, 0.3, 0] : [0, 1, 0.2, 0],
            x: preview ? [index % 2 === 0 ? -40 : 40, 0, index % 2 === 0 ? 20 : -20, 0] : [index % 2 === 0 ? -40 : 40, 0],
          }}
          transition={{
            duration: runtime.scaleDuration(0.35),
            delay: runtime.scaleDuration(0.08 * index),
            repeat: preview ? Infinity : 0,
            repeatDelay: preview ? runtime.scaleDuration(0.5) : 0,
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, filter: 'blur(8px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)', x: preview ? [0, -3, 2, 0] : 0 }}
        transition={{
          duration: runtime.scaleDuration(0.7),
          delay: runtime.scaleDuration(0.35),
          ease: 'easeOut',
        }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function SunburstAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const rays = Array.from({ length: 12 }, (_, index) => index);

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {rays.map((index) => {
        const angle = (index / rays.length) * 360;
        return (
          <motion.span
            key={index}
            className="absolute left-1/2 top-1/2 h-1 w-20 origin-left -translate-y-1/2 rounded-full"
            style={{
              rotate: `${angle}deg`,
              background: `linear-gradient(90deg, ${runtime.withAlpha(runtime.theme.accent, 0.7)} 0%, transparent 100%)`,
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: preview ? [0, 1, 0.6, 1] : [0, 1, 0.85], opacity: [0, 0.9, 0.5] }}
            transition={{
              duration: runtime.scaleDuration(0.55),
              delay: runtime.scaleDuration(index * 0.03),
              repeat: preview ? Infinity : 0,
              repeatDelay: preview ? runtime.scaleDuration(0.7) : 0,
              ease: 'easeOut',
            }}
          />
        );
      })}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.5), delay: runtime.scaleDuration(0.4) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function MatrixFallAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <motion.div
      className="relative z-10"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: runtime.scaleDuration(0.55), delay: runtime.scaleDuration(0.45) }}
      onAnimationComplete={!preview ? onComplete : undefined}
    >
      <SplashLogo className="h-20 w-20 sm:h-24 sm:w-24" />
    </motion.div>
  );
}

function MatrixRainAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <motion.div
      className="relative z-10"
      initial={{ opacity: 0, scale: 0.88, filter: 'brightness(1.6)' }}
      animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
      transition={{ duration: runtime.scaleDuration(0.65), delay: runtime.scaleDuration(0.35) }}
      onAnimationComplete={!preview ? onComplete : undefined}
    >
      <SplashLogo className="h-24 w-24 sm:h-32 sm:w-32" />
    </motion.div>
  );
}

function LaserGridAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const lines = Array.from({ length: 7 }, (_, index) => index);

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      <div
        className="absolute inset-6 rounded-xl border"
        style={{ borderColor: runtime.withAlpha(runtime.theme.secondary, 0.25) }}
      />
      {lines.map((index) => (
        <motion.span
          key={`h-${index}`}
          className="absolute left-6 right-6 h-px"
          style={{
            top: `${12 + index * 12}%`,
            background: runtime.withAlpha(runtime.theme.accent, 0.55),
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: preview ? [0, 1, 0.35, 1] : [0, 1, 0.4] }}
          transition={{
            duration: runtime.scaleDuration(0.45),
            delay: runtime.scaleDuration(index * 0.05),
            repeat: preview ? Infinity : 0,
            repeatDelay: preview ? runtime.scaleDuration(0.5) : 0,
          }}
        />
      ))}
      <motion.div
        className="absolute inset-x-8 h-16 rounded-full"
        style={{ background: runtime.withAlpha(runtime.theme.accent, 0.18) }}
        initial={{ top: '8%', opacity: 0 }}
        animate={{ top: preview ? ['8%', '72%', '8%'] : ['8%', '72%'], opacity: [0, 0.85, 0] }}
        transition={{
          duration: preview ? runtime.scaleDuration(1.6) : runtime.scaleDuration(1.1),
          repeat: preview ? Infinity : 0,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.55), delay: runtime.scaleDuration(0.55) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function WaveformAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const bars = Array.from({ length: 9 }, (_, index) => index);

  return (
    <div className="relative flex h-52 w-52 flex-col items-center justify-center gap-4">
      <div className="flex h-16 items-end justify-center gap-1.5">
        {bars.map((index) => (
          <motion.span
            key={index}
            className="w-2 rounded-full"
            style={{ background: runtime.withAlpha(index % 2 === 0 ? runtime.theme.accent : runtime.theme.secondary, 0.85) }}
            initial={{ height: 8, opacity: 0.4 }}
            animate={{
              height: preview ? [8, 48, 16, 40, 8] : [8, 42, 18, 36, 12],
              opacity: [0.4, 1, 0.7, 1, 0.5],
            }}
            transition={{
              duration: preview ? runtime.scaleDuration(1.1) : runtime.scaleDuration(0.85),
              delay: runtime.scaleDuration(index * 0.04),
              repeat: preview ? Infinity : 0,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: runtime.scaleDuration(0.55), delay: runtime.scaleDuration(0.45) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-20 w-20 sm:h-24 sm:w-24" />
      </motion.div>
    </div>
  );
}

function CometTrailAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <motion.div
        className="absolute h-52 w-52"
        animate={{ rotate: preview ? 360 : 300 }}
        transition={{
          duration: preview ? runtime.scaleDuration(2.8) : runtime.scaleDuration(2),
          repeat: preview ? Infinity : 0,
          ease: 'linear',
        }}
      >
        <motion.span
          className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full"
          style={{
            boxShadow: `0 0 18px ${runtime.withAlpha(runtime.theme.accent, 0.9)}, -28px 8px 16px ${runtime.withAlpha(runtime.theme.accent, 0.35)}`,
            background: runtime.theme.accent,
          }}
          animate={{ opacity: preview ? [0.6, 1, 0.6] : [0.5, 1, 0.7] }}
          transition={{ duration: runtime.scaleDuration(0.8), repeat: preview ? Infinity : 0 }}
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.5), delay: runtime.scaleDuration(0.35) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function PrismSplitAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const channels = [
    { color: '#FF4D4D', x: preview ? [-18, 0, -6, 0] : [-18, 0], delay: 0 },
    { color: '#4DFF88', x: preview ? [18, 0, 4, 0] : [18, 0], delay: 0.05 },
    { color: '#4DA6FF', x: preview ? [0, 0, 2, 0] : [0, 0], delay: 0.1 },
  ];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      {channels.map((channel, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{ filter: `drop-shadow(0 0 8px ${runtime.withAlpha(channel.color, 0.45)})` }}
          initial={{ opacity: 0, x: channel.x[0] }}
          animate={{ opacity: preview ? [0, 0.75, 0.35, 1] : [0, 0.7, 1], x: channel.x }}
          transition={{
            duration: runtime.scaleDuration(0.75),
            delay: runtime.scaleDuration(channel.delay),
            repeat: preview ? Infinity : 0,
            repeatDelay: preview ? runtime.scaleDuration(0.45) : 0,
            ease: 'easeOut',
          }}
        >
          <div style={{ mixBlendMode: 'screen', color: channel.color }}>
            <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
          </div>
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: runtime.scaleDuration(0.35), delay: runtime.scaleDuration(0.65) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function RingOfFireAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {[0, 1].map((index) => (
        <motion.span
          key={index}
          className="absolute rounded-full border-2"
          style={{
            borderColor: runtime.withAlpha(index === 0 ? runtime.theme.accent : runtime.theme.secondary, 0.75),
            boxShadow: `0 0 ${index === 0 ? 24 : 12}px ${runtime.withAlpha(runtime.theme.accent, 0.35)}`,
          }}
          initial={{ width: 72, height: 72, opacity: 0.9, rotate: 0 }}
          animate={{
            width: preview ? [72, 190, 72] : [72, 190],
            height: preview ? [72, 190, 72] : [72, 190],
            opacity: preview ? [0.9, 0.15, 0.9] : [0.9, 0.1],
            rotate: preview ? [0, 180, 360] : [0, 120],
          }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.8) : runtime.scaleDuration(1.35),
            delay: runtime.scaleDuration(index * 0.12),
            repeat: preview ? Infinity : 0,
            ease: 'easeOut',
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.55), delay: runtime.scaleDuration(0.45) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function MosaicTileAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const tiles = Array.from({ length: 9 }, (_, index) => ({
    row: Math.floor(index / 3),
    col: index % 3,
  }));

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <div className="absolute grid grid-cols-3 gap-1.5">
        {tiles.map((tile, index) => (
          <motion.span
            key={index}
            className="h-7 w-7 rounded-md"
            style={{ background: runtime.withAlpha(index % 2 === 0 ? runtime.theme.secondary : runtime.theme.accent, 0.55) }}
            initial={{ opacity: 0, scale: 0.3, rotate: -20 }}
            animate={{
              opacity: preview ? [0, 1, 0.35, 1] : [0, 1, 0.2],
              scale: preview ? [0.3, 1, 0.5, 1] : [0.3, 1, 0.15],
              rotate: preview ? [-20, 0, 8, 0] : [-20, 0],
            }}
            transition={{
              duration: runtime.scaleDuration(0.55),
              delay: runtime.scaleDuration((tile.row + tile.col) * 0.07),
              repeat: preview ? Infinity : 0,
              repeatDelay: preview ? runtime.scaleDuration(0.35) : 0,
              ease: 'backOut',
            }}
          />
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.5), delay: runtime.scaleDuration(0.55) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function InkDropAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const ripples = [0, 1, 2, 3];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {ripples.map((index) => (
        <motion.span
          key={index}
          className="absolute rounded-full border-2"
          style={{ borderColor: runtime.withAlpha(runtime.theme.secondary, 0.55) }}
          initial={{ width: 24, height: 24, opacity: 0.8 }}
          animate={{
            width: preview ? [24, 200, 24] : [24, 210],
            height: preview ? [24, 200, 24] : [24, 210],
            opacity: preview ? [0.8, 0.1, 0.8] : [0.8, 0],
          }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.6) : runtime.scaleDuration(1.2),
            delay: runtime.scaleDuration(index * 0.18),
            repeat: preview ? Infinity : 0,
            ease: 'easeOut',
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.55), delay: runtime.scaleDuration(0.45) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function HologramFlickerAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const scanLines = Array.from({ length: 8 }, (_, index) => index);

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      {scanLines.map((index) => (
        <motion.span
          key={index}
          className="absolute left-4 right-4 h-px"
          style={{
            top: `${14 + index * 10}%`,
            background: runtime.withAlpha(runtime.theme.accent, 0.45),
          }}
          animate={{ opacity: preview ? [0.2, 0.9, 0.2, 0.7] : [0.2, 0.85, 0.15] }}
          transition={{
            duration: runtime.scaleDuration(0.35),
            delay: runtime.scaleDuration(index * 0.05),
            repeat: preview ? Infinity : 0,
            repeatDelay: preview ? runtime.scaleDuration(0.2) : 0,
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, filter: 'brightness(1.8) blur(6px)' }}
        animate={{
          opacity: preview ? [0, 0.85, 0.5, 1] : [0, 0.75, 1],
          filter: preview ? ['brightness(1.8) blur(6px)', 'brightness(1.2) blur(2px)', 'brightness(1) blur(0px)', 'brightness(1) blur(0px)'] : ['brightness(1.8) blur(6px)', 'brightness(1) blur(0px)'],
        }}
        transition={{ duration: runtime.scaleDuration(0.85), delay: runtime.scaleDuration(0.25) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function GearSpinAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const gears = [
    { size: 56, x: -58, y: -20, rotate: preview ? 360 : 180, delay: 0 },
    { size: 40, x: 52, y: -28, rotate: preview ? -360 : -180, delay: 0.08 },
    { size: 36, x: -18, y: 52, rotate: preview ? 360 : 160, delay: 0.14 },
  ];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {gears.map((gear, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full border-4 border-dashed"
          style={{
            width: gear.size,
            height: gear.size,
            left: `calc(50% + ${gear.x}px)`,
            top: `calc(50% + ${gear.y}px)`,
            marginLeft: -gear.size / 2,
            marginTop: -gear.size / 2,
            borderColor: runtime.withAlpha(index % 2 === 0 ? runtime.theme.accent : runtime.theme.secondary, 0.7),
          }}
          initial={{ opacity: 0, rotate: 0, scale: 0.6 }}
          animate={{
            opacity: preview ? [0, 1, 0.6, 1] : [0, 1, 0.4],
            rotate: gear.rotate,
            scale: preview ? [0.6, 1, 0.85, 1] : [0.6, 1, 0.9],
          }}
          transition={{
            duration: preview ? runtime.scaleDuration(2) : runtime.scaleDuration(1.4),
            delay: runtime.scaleDuration(gear.delay),
            repeat: preview ? Infinity : 0,
            ease: 'easeInOut',
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.5), delay: runtime.scaleDuration(0.5) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function StarWarpAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const stars = Array.from({ length: 14 }, (_, index) => ({
    angle: (index / 14) * Math.PI * 2,
    length: 28 + (index % 4) * 10,
    delay: index * 0.03,
  }));

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      {stars.map((star, index) => {
        const x = Math.cos(star.angle) * 90;
        const y = Math.sin(star.angle) * 90;
        return (
          <motion.span
            key={index}
            className="absolute h-0.5 rounded-full"
            style={{
              width: star.length,
              left: '50%',
              top: '50%',
              transformOrigin: 'left center',
              rotate: `${(star.angle * 180) / Math.PI}deg`,
              background: runtime.withAlpha('#FFFFFF', 0.85),
            }}
            initial={{ x: x * 0.2, y: y * 0.2, opacity: 0, scaleX: 0.2 }}
            animate={{
              x: preview ? [x * 0.2, x * 1.4, x * 0.2] : [x * 0.2, x * 1.5],
              y: preview ? [y * 0.2, y * 1.4, y * 0.2] : [y * 0.2, y * 1.5],
              opacity: preview ? [0, 1, 0] : [0, 1, 0],
              scaleX: preview ? [0.2, 1.4, 0.2] : [0.2, 1.5, 0.3],
            }}
            transition={{
              duration: preview ? runtime.scaleDuration(1.2) : runtime.scaleDuration(0.9),
              delay: runtime.scaleDuration(star.delay),
              repeat: preview ? Infinity : 0,
              ease: 'easeIn',
            }}
          />
        );
      })}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.55), delay: runtime.scaleDuration(0.5) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function BubblePopAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const bubbles = Array.from({ length: 7 }, (_, index) => ({
    x: -70 + index * 22,
    size: 14 + (index % 3) * 6,
    delay: index * 0.08,
  }));

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      {bubbles.map((bubble, index) => (
        <motion.span
          key={index}
          className="absolute bottom-8 rounded-full border"
          style={{
            width: bubble.size,
            height: bubble.size,
            left: `calc(50% + ${bubble.x}px)`,
            borderColor: runtime.withAlpha(runtime.theme.secondary, 0.65),
            background: runtime.withAlpha(runtime.theme.secondary, 0.15),
          }}
          initial={{ y: 0, opacity: 0, scale: 0.4 }}
          animate={{
            y: preview ? [0, -90, -20, -100] : [0, -95, -30],
            opacity: preview ? [0, 0.9, 0.2, 0] : [0, 0.85, 0],
            scale: preview ? [0.4, 1, 1.3, 0.2] : [0.4, 1, 1.4],
          }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.4) : runtime.scaleDuration(1),
            delay: runtime.scaleDuration(bubble.delay),
            repeat: preview ? Infinity : 0,
            ease: 'easeOut',
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.5), delay: runtime.scaleDuration(0.55) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function MagneticPullAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const particles = Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2;
    const radius = 88;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      delay: index * 0.04,
    };
  });

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {particles.map((particle, index) => (
        <motion.span
          key={index}
          className="absolute h-2 w-2 rounded-full"
          style={{
            left: '50%',
            top: '50%',
            marginLeft: -4,
            marginTop: -4,
            background: runtime.withAlpha(index % 2 === 0 ? runtime.theme.accent : runtime.theme.secondary, 0.9),
          }}
          initial={{ x: particle.x, y: particle.y, opacity: 0, scale: 0.5 }}
          animate={{
            x: preview ? [particle.x, 0, particle.x * 0.4, 0] : [particle.x, 0],
            y: preview ? [particle.y, 0, particle.y * 0.4, 0] : [particle.y, 0],
            opacity: preview ? [0, 1, 0.4, 1] : [0, 1, 0.3],
            scale: preview ? [0.5, 1.2, 0.7, 1] : [0.5, 1.1, 0.8],
          }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.1) : runtime.scaleDuration(0.85),
            delay: runtime.scaleDuration(particle.delay),
            repeat: preview ? Infinity : 0,
            repeatDelay: preview ? runtime.scaleDuration(0.25) : 0,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.5), delay: runtime.scaleDuration(0.45) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function TapRippleAnimation({ preview = false }) {
  const runtime = useSplashRuntime();
  const { taps, charge } = useSplashInteraction();
  const logoScale = 0.72 + (charge / 100) * 0.28;

  return (
    <div className="relative flex h-56 w-56 items-center justify-center overflow-hidden rounded-3xl">
      {taps.map((tap) => (
        <motion.span
          key={tap.id}
          className="pointer-events-none absolute rounded-full border-2"
          style={{
            left: tap.x,
            top: tap.y,
            marginLeft: -8,
            marginTop: -8,
            borderColor: runtime.withAlpha(runtime.theme.accent, 0.7),
          }}
          initial={{ width: 16, height: 16, opacity: 0.85 }}
          animate={{ width: 180, height: 180, marginLeft: -90, marginTop: -90, opacity: 0 }}
          transition={{ duration: runtime.scaleDuration(0.9), ease: 'easeOut' }}
        />
      ))}
      <motion.div animate={{ scale: logoScale }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
      {!preview ? (
        <p className="pointer-events-none absolute bottom-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
          Tap to ripple
        </p>
      ) : null}
    </div>
  );
}

function PointerGlowAnimation({ preview = false }) {
  const runtime = useSplashRuntime();
  const { pointer, charge } = useSplashInteraction();

  return (
    <div className="relative flex h-56 w-56 items-center justify-center overflow-hidden rounded-3xl">
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          background: `radial-gradient(circle at ${50 + pointer.nx * 22}% ${46 + pointer.ny * 18}%, ${runtime.withAlpha(runtime.theme.accent, 0.45)} 0%, transparent 58%)`,
        }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
      <motion.div
        className="pointer-events-none absolute h-24 w-24 rounded-full"
        animate={{
          x: pointer.nx * 28,
          y: pointer.ny * 22,
          boxShadow: `0 0 36px ${runtime.withAlpha(runtime.theme.secondary, 0.55)}`,
          opacity: 0.35 + charge / 220,
        }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
      />
      <motion.div
        animate={{ scale: 0.82 + charge / 220 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function TiltParallaxAnimation({ preview = false }) {
  const runtime = useSplashRuntime();
  const { pointer, charge, isPressed } = useSplashInteraction();

  return (
    <div className="relative flex h-56 w-56 items-center justify-center" style={{ perspective: 900 }}>
      <motion.div
        animate={{
          rotateX: -pointer.ny * 16,
          rotateY: pointer.nx * 16,
          scale: 0.86 + charge / 250,
        }}
        transition={{ type: 'spring', stiffness: isPressed ? 260 : 140, damping: isPressed ? 16 : 22 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
      {!preview ? (
        <p className="pointer-events-none absolute bottom-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
          Drag to tilt
        </p>
      ) : null}
    </div>
  );
}

function TapChargeAnimation({ preview = false }) {
  const runtime = useSplashRuntime();
  const { charge, tapCount, isPressed } = useSplashInteraction();

  return (
    <div className="relative flex h-56 w-56 items-center justify-center">
      <svg className="absolute h-40 w-40 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke={runtime.withAlpha('#FFFFFF', 0.12)} strokeWidth="6" />
        <motion.circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke={runtime.theme.accent}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={326.7}
          animate={{ strokeDashoffset: 326.7 - (326.7 * charge) / 100 }}
          transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        />
      </svg>
      <motion.div
        animate={{
          scale: 0.78 + charge / 220,
          filter: charge >= 88 ? 'drop-shadow(0 0 18px rgba(255,255,255,0.45))' : 'none',
        }}
        transition={{ type: 'spring', stiffness: isPressed ? 320 : 180, damping: 18 }}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
      {!preview ? (
        <p className="pointer-events-none absolute bottom-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
          {tapCount >= 3 ? 'Charged' : `Charge ${Math.round(charge)}%`}
        </p>
      ) : null}
    </div>
  );
}

function DrawTrailAnimation({ preview = false }) {
  const runtime = useSplashRuntime();
  const { pointer, taps, charge } = useSplashInteraction();
  const trail = taps.slice(-6);

  return (
    <div className="relative flex h-56 w-56 items-center justify-center overflow-hidden rounded-3xl">
      <motion.span
        className="pointer-events-none absolute h-8 w-8 rounded-full"
        style={{ background: runtime.withAlpha(runtime.theme.accent, 0.55) }}
        animate={{
          x: pointer.x,
          y: pointer.y,
          opacity: 0.25 + charge / 180,
          scale: 0.8 + charge / 180,
        }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      />
      {trail.map((tap, index) => (
        <motion.span
          key={tap.id}
          className="pointer-events-none absolute h-3 w-3 rounded-full"
          style={{
            left: tap.x,
            top: tap.y,
            background: runtime.withAlpha(index % 2 === 0 ? runtime.theme.secondary : runtime.theme.accent, 0.75),
          }}
          initial={{ opacity: 0.9, scale: 1.2 }}
          animate={{ opacity: 0, scale: 0.2 }}
          transition={{ duration: runtime.scaleDuration(0.75), ease: 'easeOut' }}
        />
      ))}
      <motion.div animate={{ scale: 0.84 + charge / 260 }} transition={{ type: 'spring', stiffness: 180, damping: 20 }}>
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function SparkBurstAnimation({ preview = false }) {
  const runtime = useSplashRuntime();
  const { taps, charge } = useSplashInteraction();

  return (
    <div className="relative flex h-56 w-56 items-center justify-center overflow-hidden">
      {taps.flatMap((tap) => (
        Array.from({ length: 5 }, (_, index) => {
          const angle = (index / 5) * Math.PI * 2;
          return (
            <motion.span
              key={`${tap.id}-${index}`}
              className="pointer-events-none absolute h-1.5 w-1.5 rounded-full"
              style={{
                left: tap.x,
                top: tap.y,
                background: runtime.withAlpha(runtime.theme.accent, 0.95),
              }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{
                opacity: 0,
                x: Math.cos(angle) * 42,
                y: Math.sin(angle) * 42,
                scale: 0.2,
              }}
              transition={{ duration: runtime.scaleDuration(0.55), ease: 'easeOut' }}
            />
          );
        })
      ))}
      <motion.div
        animate={{
          scale: 0.8 + charge / 210,
          rotate: charge >= 88 ? 0 : charge * 0.4,
        }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function CrystalShatterAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const shards = Array.from({ length: 10 }, (_, index) => {
    const angle = (index / 10) * Math.PI * 2;
    return {
      x: Math.cos(angle) * 52,
      y: Math.sin(angle) * 52,
      rotate: (angle * 180) / Math.PI + 20,
      delay: index * 0.04,
    };
  });

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      {shards.map((shard, index) => (
        <motion.span
          key={index}
          className="absolute h-8 w-3 rounded-sm"
          style={{
            background: runtime.withAlpha(index % 2 === 0 ? '#FFFFFF' : runtime.theme.secondary, 0.55),
            clipPath: 'polygon(0 0, 100% 20%, 80% 100%, 10% 80%)',
          }}
          initial={{ opacity: 0.85, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{
            opacity: preview ? [0.85, 0.2, 0.85] : [0.85, 0],
            x: preview ? [0, shard.x, 0] : [0, shard.x * 1.4],
            y: preview ? [0, shard.y, 0] : [0, shard.y * 1.4],
            rotate: preview ? [0, shard.rotate, 0] : [0, shard.rotate],
            scale: preview ? [1, 0.5, 1] : [1, 0.35],
          }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.4) : runtime.scaleDuration(0.75),
            delay: runtime.scaleDuration(shard.delay),
            repeat: preview ? Infinity : 0,
            repeatDelay: preview ? runtime.scaleDuration(0.35) : 0,
            ease: 'easeOut',
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.78, filter: 'blur(8px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: runtime.scaleDuration(0.55), delay: runtime.scaleDuration(0.42) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function ClockworkAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <motion.div
        className="absolute h-40 w-40 rounded-full border-2"
        style={{ borderColor: runtime.withAlpha(runtime.theme.secondary, 0.45) }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.35) }}
      />
      {[0, 1].map((index) => (
        <motion.span
          key={index}
          className="absolute left-1/2 top-1/2 origin-bottom rounded-full"
          style={{
            width: index === 0 ? 4 : 3,
            height: index === 0 ? 46 : 32,
            marginLeft: index === 0 ? -2 : -1.5,
            marginTop: index === 0 ? -46 : -32,
            background: runtime.withAlpha(index === 0 ? runtime.theme.accent : '#FFFFFF', 0.9),
          }}
          initial={{ rotate: 0 }}
          animate={{ rotate: preview ? [0, 360, 720] : [0, 240 + index * 90] }}
          transition={{
            duration: preview ? runtime.scaleDuration(2.2) : runtime.scaleDuration(1.1),
            repeat: preview ? Infinity : 0,
            ease: 'easeInOut',
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.5), delay: runtime.scaleDuration(0.55) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-20 w-20 sm:h-24 sm:w-24" />
      </motion.div>
    </div>
  );
}

function NeonFlickerAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <motion.div
        className="absolute inset-8 rounded-2xl border-2"
        style={{
          borderColor: runtime.theme.accent,
          boxShadow: `0 0 24px ${runtime.withAlpha(runtime.theme.accent, 0.45)}`,
        }}
        animate={{
          opacity: preview ? [0.1, 1, 0.2, 0.95, 0.35, 1] : [0.1, 0.4, 0.15, 0.85, 0.3, 1],
        }}
        transition={{
          duration: preview ? runtime.scaleDuration(1.4) : runtime.scaleDuration(1),
          repeat: preview ? Infinity : 0,
          repeatDelay: preview ? runtime.scaleDuration(0.25) : 0,
        }}
      />
      <motion.div
        animate={{
          opacity: preview ? [0.2, 0.9, 0.35, 1, 0.5, 1] : [0.2, 0.75, 0.3, 1],
          filter: preview
            ? ['brightness(1.4) blur(2px)', 'brightness(1) blur(0px)', 'brightness(1.3) blur(1px)', 'brightness(1) blur(0px)']
            : ['brightness(1.5) blur(2px)', 'brightness(1) blur(0px)', 'brightness(1) blur(0px)'],
        }}
        transition={{ duration: runtime.scaleDuration(0.9), delay: runtime.scaleDuration(0.2) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function SandstormAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const grains = Array.from({ length: 24 }, (_, index) => ({
    x: -90 + (index % 6) * 32,
    y: -70 + Math.floor(index / 6) * 36,
    delay: index * 0.025,
  }));

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      {grains.map((grain, index) => (
        <motion.span
          key={index}
          className="absolute h-1.5 w-1.5 rounded-full"
          style={{ background: runtime.withAlpha(runtime.theme.accent, 0.65) }}
          initial={{ x: grain.x, y: grain.y, opacity: 0.9 }}
          animate={{
            x: preview ? [grain.x, grain.x + 40, grain.x] : [grain.x, grain.x + 55],
            y: preview ? [grain.y, grain.y - 20, grain.y] : [grain.y, grain.y - 28],
            opacity: preview ? [0.9, 0.2, 0.9] : [0.9, 0],
          }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.3) : runtime.scaleDuration(0.95),
            delay: runtime.scaleDuration(grain.delay),
            repeat: preview ? Infinity : 0,
            ease: 'easeOut',
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.55), delay: runtime.scaleDuration(0.5) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function FoldUnfoldAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const panels = [
    { rotateY: -88, x: -28, delay: 0 },
    { rotateY: 88, x: 28, delay: 0.08 },
    { rotateY: -88, y: -24, delay: 0.14 },
    { rotateY: 88, y: 24, delay: 0.2 },
  ];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center" style={{ perspective: 900 }}>
      {panels.map((panel, index) => (
        <motion.span
          key={index}
          className="absolute h-16 w-16 rounded-lg border"
          style={{
            borderColor: runtime.withAlpha(runtime.theme.secondary, 0.45),
            background: runtime.withAlpha(runtime.theme.background, 0.35),
            transformStyle: 'preserve-3d',
          }}
          initial={{ rotateY: panel.rotateY, x: panel.x || 0, y: panel.y || 0, opacity: 0.9 }}
          animate={{
            rotateY: preview ? [panel.rotateY, 0, panel.rotateY] : [panel.rotateY, 0],
            x: preview ? [panel.x || 0, 0, panel.x || 0] : [panel.x || 0, 0],
            y: preview ? [panel.y || 0, 0, panel.y || 0] : [panel.y || 0, 0],
            opacity: preview ? [0.9, 0.15, 0.9] : [0.9, 0],
          }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.3) : runtime.scaleDuration(0.75),
            delay: runtime.scaleDuration(panel.delay),
            repeat: preview ? Infinity : 0,
            repeatDelay: preview ? runtime.scaleDuration(0.3) : 0,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.84 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.5), delay: runtime.scaleDuration(0.48) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function OrbitPulseAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const rings = [0, 1, 2, 3];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {rings.map((index) => (
        <motion.span
          key={index}
          className="absolute rounded-full border"
          style={{ borderColor: runtime.withAlpha(index % 2 === 0 ? runtime.theme.accent : runtime.theme.secondary, 0.65) }}
          initial={{ width: 200, height: 200, opacity: 0.55 }}
          animate={{
            width: preview ? [200, 72, 200] : [200, 68],
            height: preview ? [200, 72, 200] : [200, 68],
            opacity: preview ? [0.55, 0.15, 0.55] : [0.55, 0.08],
          }}
          transition={{
            duration: preview ? runtime.scaleDuration(1.5) : runtime.scaleDuration(1.05),
            delay: runtime.scaleDuration(index * 0.12),
            repeat: preview ? Infinity : 0,
            ease: 'easeInOut',
          }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.5), delay: runtime.scaleDuration(0.45) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function LogoLayerStack({ layers, className = 'h-24 w-24 sm:h-28 sm:w-28' }) {
  return layers.map((layer, index) => (
    <motion.div
      key={index}
      className="absolute"
      style={layer.style}
      initial={layer.initial}
      animate={layer.animate}
      transition={layer.transition}
    >
      {layer.tint ? (
        <div style={{ mixBlendMode: layer.blendMode || 'screen', color: layer.tint }}>
          <SplashLogo className={className} />
        </div>
      ) : (
        <SplashLogo className={className} />
      )}
    </motion.div>
  ));
}

function ChromaticMergeAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const channels = [
    { tint: '#FF4D4D', initial: { x: -22, y: -8, opacity: 0 }, animate: { x: preview ? [-22, 0, -4, 0] : [-22, 0], y: preview ? [-8, 0, 2, 0] : [-8, 0], opacity: preview ? [0, 0.8, 0.35, 0] : [0, 0.75, 0] }, delay: 0 },
    { tint: '#4DFF88', initial: { x: 22, y: 6, opacity: 0 }, animate: { x: preview ? [22, 0, 3, 0] : [22, 0], y: preview ? [6, 0, -2, 0] : [6, 0], opacity: preview ? [0, 0.8, 0.35, 0] : [0, 0.75, 0] }, delay: 0.06 },
    { tint: '#4DA6FF', initial: { x: 0, y: 18, opacity: 0 }, animate: { x: preview ? [0, 0, 0, 0] : [0, 0], y: preview ? [18, 0, 0, 0] : [18, 0], opacity: preview ? [0, 0.8, 0.35, 0] : [0, 0.75, 0] }, delay: 0.12 },
  ];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      <LogoLayerStack
        layers={channels.map((channel) => ({
          tint: channel.tint,
          style: { filter: `drop-shadow(0 0 10px ${runtime.withAlpha(channel.tint, 0.35)})` },
          initial: channel.initial,
          animate: channel.animate,
          transition: {
            duration: runtime.scaleDuration(0.8),
            delay: runtime.scaleDuration(channel.delay),
            repeat: preview ? Infinity : 0,
            repeatDelay: preview ? runtime.scaleDuration(0.4) : 0,
            ease: 'easeOut',
          },
        }))}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.35), delay: runtime.scaleDuration(0.62) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function GhostConvergeAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const ghosts = [
    { x: -48, y: -36, scale: 0.72, delay: 0 },
    { x: 48, y: -32, scale: 0.74, delay: 0.06 },
    { x: -42, y: 38, scale: 0.7, delay: 0.1 },
    { x: 44, y: 40, scale: 0.76, delay: 0.14 },
  ];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      {ghosts.map((ghost, index) => (
        <motion.div
          key={index}
          className="absolute opacity-60"
          initial={{ x: ghost.x, y: ghost.y, scale: ghost.scale, opacity: 0 }}
          animate={{
            x: preview ? [ghost.x, 0, ghost.x * 0.35, 0] : [ghost.x, 0],
            y: preview ? [ghost.y, 0, ghost.y * 0.35, 0] : [ghost.y, 0],
            scale: preview ? [ghost.scale, 1, 0.88, 1] : [ghost.scale, 1],
            opacity: preview ? [0, 0.55, 0.15, 0] : [0, 0.5, 0],
          }}
          transition={{
            duration: runtime.scaleDuration(0.85),
            delay: runtime.scaleDuration(ghost.delay),
            repeat: preview ? Infinity : 0,
            repeatDelay: preview ? runtime.scaleDuration(0.35) : 0,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: runtime.scaleDuration(0.45), delay: runtime.scaleDuration(0.55) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function LogoShatterInAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();
  const grid = 3;
  const pieceSize = 32;
  const logoSize = pieceSize * grid;
  const offsets = [
    [-38, -42], [0, -48], [36, -40],
    [-44, 0], [0, 0], [42, 4],
    [-34, 38], [6, 44], [40, 36],
  ];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <div className="relative" style={{ width: logoSize, height: logoSize }}>
        {offsets.map(([offsetX, offsetY], index) => {
          const row = Math.floor(index / grid);
          const col = index % grid;

          return (
            <motion.div
              key={index}
              className="absolute overflow-hidden"
              style={{
                width: pieceSize,
                height: pieceSize,
                left: col * pieceSize,
                top: row * pieceSize,
              }}
              initial={{ x: offsetX, y: offsetY, opacity: 0, rotate: -8 }}
              animate={{
                x: preview ? [offsetX, 0, offsetX * 0.25, 0] : [offsetX, 0],
                y: preview ? [offsetY, 0, offsetY * 0.25, 0] : [offsetY, 0],
                opacity: preview ? [0, 1, 0.35, 1] : [0, 1],
                rotate: preview ? [-8, 0, -2, 0] : [-8, 0],
              }}
              transition={{
                duration: runtime.scaleDuration(0.75),
                delay: runtime.scaleDuration(index * 0.05),
                repeat: preview ? Infinity : 0,
                repeatDelay: preview ? runtime.scaleDuration(0.35) : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
              onAnimationComplete={!preview && index === offsets.length - 1 ? onComplete : undefined}
            >
              <div style={{ marginLeft: -col * pieceSize, marginTop: -row * pieceSize }}>
                <SplashLogo className="h-24 w-24" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ExposureBlendAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      <motion.div
        className="absolute"
        initial={{ opacity: 0, scale: 1.18, rotate: -6 }}
        animate={{
          opacity: preview ? [0, 0.75, 0.25, 0] : [0, 0.7, 0],
          scale: preview ? [1.18, 1, 1.06, 1] : [1.18, 1],
          rotate: preview ? [-6, 0, -2, 0] : [-6, 0],
        }}
        transition={{
          duration: runtime.scaleDuration(0.85),
          repeat: preview ? Infinity : 0,
          repeatDelay: preview ? runtime.scaleDuration(0.35) : 0,
          ease: 'easeOut',
        }}
        style={{ mixBlendMode: 'screen' }}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
      <motion.div
        className="absolute"
        initial={{ opacity: 0, scale: 0.82, rotate: 8 }}
        animate={{
          opacity: preview ? [0, 0.65, 0.2, 0] : [0, 0.6, 0],
          scale: preview ? [0.82, 1, 0.94, 1] : [0.82, 1],
          rotate: preview ? [8, 0, 3, 0] : [8, 0],
        }}
        transition={{
          duration: runtime.scaleDuration(0.85),
          delay: runtime.scaleDuration(0.08),
          repeat: preview ? Infinity : 0,
          repeatDelay: preview ? runtime.scaleDuration(0.35) : 0,
          ease: 'easeOut',
        }}
        style={{ mixBlendMode: 'lighten' }}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: runtime.scaleDuration(0.35), delay: runtime.scaleDuration(0.58) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function MirrorLockAnimation({ preview = false, onComplete }) {
  const runtime = useSplashRuntime();

  return (
    <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden">
      <motion.div
        className="absolute flex flex-col items-center"
        initial={{ y: 36, opacity: 0.45 }}
        animate={{
          y: preview ? [36, 0, 8, 0] : [36, 0],
          opacity: preview ? [0.45, 0.15, 0.35, 0] : [0.45, 0.12, 0],
        }}
        transition={{
          duration: runtime.scaleDuration(0.85),
          repeat: preview ? Infinity : 0,
          repeatDelay: preview ? runtime.scaleDuration(0.35) : 0,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <SplashLogo className="h-20 w-20 sm:h-24 sm:w-24" />
        <div className="scale-y-[-1] opacity-50" style={{ maskImage: 'linear-gradient(to bottom, black, transparent)' }}>
          <SplashLogo className="h-20 w-20 sm:h-24 sm:w-24" />
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: runtime.scaleDuration(0.5), delay: runtime.scaleDuration(0.45) }}
        onAnimationComplete={!preview ? onComplete : undefined}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
    </div>
  );
}

function PrismDriftAnimation({ preview = false }) {
  const runtime = useSplashRuntime();
  const { pointer, charge } = useSplashInteraction();
  const spread = 8 + Math.abs(pointer.nx) * 28 + Math.abs(pointer.ny) * 12 + (100 - charge) * 0.06;
  const channels = [
    { tint: '#FF4D4D', x: -spread, y: -spread * 0.35 },
    { tint: '#4DFF88', x: spread, y: spread * 0.2 },
    { tint: '#4DA6FF', x: 0, y: spread * 0.55 },
  ];

  return (
    <div className="relative flex h-56 w-56 items-center justify-center overflow-hidden rounded-3xl">
      {channels.map((channel, index) => (
        <motion.div
          key={index}
          className="absolute"
          animate={{ x: channel.x, y: channel.y, opacity: charge >= 88 ? 0 : 0.72 }}
          transition={{ type: 'spring', stiffness: 180, damping: 20 }}
          style={{ filter: `drop-shadow(0 0 10px ${runtime.withAlpha(channel.tint, 0.35)})` }}
        >
          <div style={{ mixBlendMode: 'screen', color: channel.tint }}>
            <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
          </div>
        </motion.div>
      ))}
      <motion.div
        animate={{
          opacity: charge >= 70 ? 1 : 0.25 + charge / 140,
          scale: 0.82 + charge / 220,
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <SplashLogo className="h-24 w-24 sm:h-28 sm:w-28" />
      </motion.div>
      {!preview ? (
        <p className="pointer-events-none absolute bottom-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
          {charge >= 88 ? 'Aligned' : 'Drag to align channels'}
        </p>
      ) : null}
    </div>
  );
}

const VARIANTS = {
  'pulse-ring': PulseRingAnimation,
  orbit: OrbitAnimation,
  neural: NeuralAnimation,
  constellation: ConstellationAnimation,
  'spin-glow': SpinGlowAnimation,
  'fade-rise': FadeRiseAnimation,
  'particle-burst': ParticleBurstAnimation,
  'logo-morph': LogoMorphAnimation,
  'radar-sweep': RadarSweepAnimation,
  'bounce-in': BounceInAnimation,
  'flip-reveal': FlipRevealAnimation,
  'ripple-pond': RipplePondAnimation,
  'dna-helix': DnaHelixAnimation,
  'hex-build': HexBuildAnimation,
  'zoom-punch': ZoomPunchAnimation,
  sunburst: SunburstAnimation,
  'matrix-fall': MatrixFallAnimation,
  'matrix-rain': MatrixRainAnimation,
  'laser-grid': LaserGridAnimation,
  'comet-trail': CometTrailAnimation,
  'prism-split': PrismSplitAnimation,
  'ring-of-fire': RingOfFireAnimation,
  'mosaic-tile': MosaicTileAnimation,
  'ink-drop': InkDropAnimation,
  'hologram-flicker': HologramFlickerAnimation,
  'gear-spin': GearSpinAnimation,
  'star-warp': StarWarpAnimation,
  'bubble-pop': BubblePopAnimation,
  'magnetic-pull': MagneticPullAnimation,
  'tap-ripple': TapRippleAnimation,
  'pointer-glow': PointerGlowAnimation,
  'tilt-parallax': TiltParallaxAnimation,
  'crystal-shatter': CrystalShatterAnimation,
  clockwork: ClockworkAnimation,
  'neon-flicker': NeonFlickerAnimation,
  'fold-unfold': FoldUnfoldAnimation,
  'orbit-pulse': OrbitPulseAnimation,
};

export default function SplashAnimationVariants({
  variant,
  preview = false,
  onComplete,
  config,
  systemName = '',
}) {
  const runtime = useMemo(() => buildSplashRuntime(config, variant, systemName), [config, variant, systemName]);
  const Component = VARIANTS[variant];
  const interactive = isSplashAnimationInteractive(variant);

  if (!Component) {
    return null;
  }

  const frame = (
    <SplashExperienceFrame runtime={runtime} preview={preview}>
      <Component preview={preview} onComplete={onComplete} />
    </SplashExperienceFrame>
  );

  return (
    <SplashRuntimeContext.Provider value={runtime}>
      {interactive ? (
        <InteractiveSplashShell preview={preview} onComplete={onComplete}>
          {frame}
        </InteractiveSplashShell>
      ) : (
        frame
      )}
    </SplashRuntimeContext.Provider>
  );
}
