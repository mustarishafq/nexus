import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';

const HOST_ID = 'nexus-reaction-burst-host';
const SPRING = { type: 'spring', stiffness: 400, damping: 20 };

let hostRoot = null;
let syncParticles = null;
let particles = [];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function ensureHost() {
  if (typeof document === 'undefined') return;
  if (hostRoot) return;

  let el = document.getElementById(HOST_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = HOST_ID;
    document.body.appendChild(el);
  }

  hostRoot = createRoot(el);
  hostRoot.render(<ReactionBurstLayer />);
}

function removeParticle(id) {
  particles = particles.filter((p) => p.id !== id);
  syncParticles?.(particles);
}

function ReactionBurstLayer() {
  const [items, setItems] = useState(particles);

  useEffect(() => {
    syncParticles = setItems;
    setItems(particles);
    return () => {
      if (syncParticles === setItems) {
        syncParticles = null;
      }
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden" aria-hidden>
      <AnimatePresence>
        {items.map((particle) => (
          <motion.span
            key={particle.id}
            className="absolute select-none"
            style={{
              left: particle.x,
              top: particle.y,
              fontSize: particle.size,
              lineHeight: 1,
              marginLeft: '-0.5em',
              marginTop: '-0.5em',
            }}
            initial={{
              opacity: 1,
              scale: 0.6,
              x: 0,
              y: 0,
              rotate: particle.rotateStart,
            }}
            animate={{
              opacity: 0,
              scale: [0.6, 1.2, 0.8],
              x: particle.driftX,
              y: particle.driftY,
              rotate: particle.rotateEnd,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              ease: 'easeOut',
              scale: {
                duration: particle.duration,
                delay: particle.delay,
                times: [0, 0.35, 1],
              },
            }}
          >
            {particle.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Spawn a floating emoji burst at viewport coordinates.
 * Does not block interaction; particles self-clear after animating.
 */
export function spawnReactionBurst(emoji, clientX, clientY, { compact = false } = {}) {
  if (!emoji || typeof clientX !== 'number' || typeof clientY !== 'number') return;

  ensureHost();

  const count = compact ? 5 : 7;
  const baseSize = compact ? 14 : 18;
  const burstId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const next = Array.from({ length: count }, (_, index) => ({
    id: `${burstId}-${index}`,
    emoji,
    x: clientX,
    y: clientY,
    size: baseSize + randomBetween(-2, 4),
    driftX: randomBetween(-36, 36),
    driftY: randomBetween(-80, -40),
    rotateStart: randomBetween(-18, 18),
    rotateEnd: randomBetween(-40, 40),
    duration: randomBetween(0.55, 0.75),
    delay: index * 0.03,
  }));

  particles = [...particles, ...next];
  if (syncParticles) {
    syncParticles(particles);
  } else {
    // Host just mounted; flush after React commits ReactionBurstLayer.
    requestAnimationFrame(() => syncParticles?.(particles));
  }

  next.forEach((particle) => {
    const lifetimeMs = (particle.duration + particle.delay) * 1000 + 80;
    window.setTimeout(() => removeParticle(particle.id), lifetimeMs);
  });
}

export const reactionMotion = {
  spring: SPRING,
  whileHover: { scale: 1.12 },
  whileTap: { scale: 0.92 },
  chipEnter: {
    initial: { opacity: 0, scale: 0.75 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.75 },
    transition: SPRING,
  },
  activePopScale: [1, 1.2, 1],
  activePopTransition: { duration: 0.28, ease: 'easeOut' },
};
