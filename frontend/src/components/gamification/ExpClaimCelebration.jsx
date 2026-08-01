import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';

const HOST_ID = 'nexus-exp-claim-host';
export const EXP_SINK_PULSE_EVENT = 'nexus:exp-sink-pulse';

const SINK_PREFERENCE = ['widget', 'missions', 'nav'];

let hostRoot = null;
let syncShows = null;
/** @type {Array<Record<string, any>>} */
let shows = [];

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
  hostRoot.render(<ExpClaimLayer />);
}

function removeShow(id) {
  shows = shows.filter((item) => item.id !== id);
  syncShows?.(shows);
}

function isElementVisible(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) {
    return false;
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return rect.bottom > 0 && rect.right > 0 && rect.top < vh && rect.left < vw;
}

function resolveExpSink() {
  if (typeof document === 'undefined') return null;
  const nodes = Array.from(document.querySelectorAll('[data-exp-sink]'));
  if (nodes.length === 0) return null;

  const scored = nodes
    .filter(isElementVisible)
    .map((el) => {
      const key = el.getAttribute('data-exp-sink') || '';
      const pref = SINK_PREFERENCE.indexOf(key);
      return { el, score: pref === -1 ? 99 : pref };
    })
    .sort((a, b) => a.score - b.score);

  const chosen = scored[0]?.el || nodes.find(isElementVisible) || null;
  if (!chosen) return null;

  const rect = chosen.getBoundingClientRect();
  return {
    el: chosen,
    key: chosen.getAttribute('data-exp-sink') || 'default',
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function pulseSink(sink) {
  if (!sink?.el) return;
  sink.el.classList.add('exp-sink-pulse');
  window.setTimeout(() => sink.el.classList.remove('exp-sink-pulse'), 700);
  window.dispatchEvent(
    new CustomEvent(EXP_SINK_PULSE_EVENT, {
      detail: { key: sink.key },
    })
  );
}

function Spark({ spark }) {
  return (
    <motion.span
      className="absolute rounded-full"
      style={{
        left: spark.x,
        top: spark.y,
        width: spark.size,
        height: spark.size,
        marginLeft: -spark.size / 2,
        marginTop: -spark.size / 2,
        background: spark.color,
        boxShadow: `0 0 ${spark.size * 1.6}px ${spark.color}`,
      }}
      initial={{ opacity: 1, scale: 0.4, x: 0, y: 0 }}
      animate={{
        opacity: 0,
        scale: [0.4, 1.15, 0.7],
        x: spark.driftX,
        y: spark.driftY,
      }}
      transition={{
        duration: spark.duration,
        delay: spark.delay,
        ease: 'easeOut',
      }}
    />
  );
}

function FlyChip({ chip, originX, originY, onArrive }) {
  useEffect(() => {
    if (!onArrive) return undefined;
    const timer = window.setTimeout(onArrive, (chip.delay + chip.duration) * 1000);
    return () => window.clearTimeout(timer);
  }, [chip.delay, chip.duration, onArrive]);

  return (
    <motion.span
      className="absolute select-none text-xs font-bold tabular-nums text-amber-500 dark:text-amber-300"
      style={{
        left: originX,
        top: originY,
        marginLeft: '-0.5em',
        marginTop: '-0.5em',
      }}
      initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0.6, 1, 0.85, 0.4],
        x: chip.targetX,
        y: chip.targetY,
      }}
      transition={{
        duration: chip.duration,
        delay: chip.delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {chip.label}
    </motion.span>
  );
}

function ExpClaimShow({ show, onDone }) {
  const [pulsed, setPulsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(onDone, show.lifetimeMs);
    return () => window.clearTimeout(timer);
  }, [onDone, show.lifetimeMs]);

  const handleFlyArrive = () => {
    if (pulsed || !show.sink) return;
    setPulsed(true);
    pulseSink(show.sink);
  };

  const isAll = show.mode === 'all';
  const isMoment = show.mode === 'moment';

  if (isMoment) {
    return (
      <motion.div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{ zIndex: 2147483646 }}
        aria-hidden
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              show.kind === 'rank'
                ? 'radial-gradient(circle at center, rgba(148,163,184,0.18), transparent 55%)'
                : 'radial-gradient(circle at center, rgba(245,158,11,0.22), transparent 55%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, times: [0, 0.25, 1] }}
        />
        <div
          className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2"
        >
          <motion.div
            className="rounded-2xl border border-amber-400/40 bg-background/90 px-6 py-4 text-center shadow-lg backdrop-blur-sm"
            initial={{ opacity: 0, scale: 0.7, y: 16 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1.08, 1, 0.96], y: [16, 0, -8, -20] }}
            transition={{ duration: 1.35, times: [0, 0.2, 0.7, 1], ease: 'easeOut' }}
          >
            <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-300 sm:text-3xl">
              {show.title}
            </p>
            {show.subtitle ? (
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {show.subtitle}
              </p>
            ) : null}
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 2147483646 }}
      aria-hidden
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: isAll
            ? 'radial-gradient(circle at center, rgba(245,158,11,0.22), transparent 55%)'
            : 'radial-gradient(circle at center, rgba(245,158,11,0.14), transparent 50%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.7, times: [0, 0.2, 1], ease: 'easeOut' }}
      />

      <motion.div
        className="absolute rounded-full border-2 border-amber-400/70"
        style={{
          left: show.originX,
          top: show.originY,
          width: 24,
          height: 24,
          marginLeft: -12,
          marginTop: -12,
        }}
        initial={{ opacity: 0.9, scale: 0.4 }}
        animate={{ opacity: 0, scale: isAll ? 18 : 12 }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
      />

      {show.sparks.map((spark) => (
        <Spark key={spark.id} spark={spark} />
      ))}

      <div
        className="absolute"
        style={{
          left: show.originX,
          top: show.originY,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.45, y: 18 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.45, 1.18, 1, 0.92], y: [18, -8, -36, -70] }}
          transition={{ duration: show.duration, times: [0, 0.18, 0.7, 1], ease: 'easeOut' }}
        >
          <div
            className={
              isAll
                ? 'rounded-2xl border border-amber-400/40 bg-background/90 px-5 py-3 shadow-lg backdrop-blur-sm'
                : 'rounded-xl border border-amber-400/35 bg-background/90 px-4 py-2 shadow-md backdrop-blur-sm'
            }
          >
            <p
              className={
                isAll
                  ? 'text-3xl font-bold tabular-nums tracking-tight text-amber-600 dark:text-amber-300'
                  : 'text-2xl font-bold tabular-nums tracking-tight text-amber-600 dark:text-amber-300'
              }
            >
              +{show.amount.toLocaleString()}
              <span className="ml-1.5 text-sm font-semibold text-muted-foreground">EXP</span>
            </p>
            {isAll && show.count > 1 ? (
              <p className="mt-0.5 text-center text-xs text-muted-foreground">
                {show.count} rewards claimed
              </p>
            ) : (
              <p className="mt-0.5 text-center text-[11px] font-medium uppercase tracking-wide text-amber-700/80 dark:text-amber-200/70">
                Claimed
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {show.chips.map((chip) => (
        <motion.span
          key={chip.id}
          className="absolute select-none text-sm font-semibold tabular-nums text-amber-500 dark:text-amber-300"
          style={{
            left: show.originX,
            top: show.originY,
            marginLeft: '-0.5em',
            marginTop: '-0.5em',
          }}
          initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.85],
            x: chip.driftX,
            y: chip.driftY,
            rotate: chip.rotate,
          }}
          transition={{
            duration: chip.duration,
            delay: chip.delay,
            ease: 'easeOut',
          }}
        >
          {chip.label}
        </motion.span>
      ))}

      {show.flyChips.map((chip, index) => (
        <FlyChip
          key={chip.id}
          chip={chip}
          originX={show.originX}
          originY={show.originY}
          onArrive={index === 0 ? handleFlyArrive : undefined}
        />
      ))}
    </motion.div>
  );
}

function ExpClaimLayer() {
  const [items, setItems] = useState(shows);

  useEffect(() => {
    syncShows = setItems;
    setItems(shows);
    return () => {
      if (syncShows === setItems) {
        syncShows = null;
      }
    };
  }, []);

  return (
    <AnimatePresence>
      {items.map((show) => (
        <ExpClaimShow
          key={show.id}
          show={show}
          onDone={() => removeShow(show.id)}
        />
      ))}
    </AnimatePresence>
  );
}

const SPARK_COLORS = [
  '#f59e0b',
  '#fbbf24',
  '#f97316',
  '#eab308',
  '#fdba74',
  '#fde68a',
];

function pushShow(show) {
  shows = [...shows, show];
  if (syncShows) {
    syncShows(shows);
  } else {
    requestAnimationFrame(() => syncShows?.(shows));
  }
}

/**
 * Play an interactive EXP claim celebration.
 * @param {{ amount: number, count?: number, clientX?: number, clientY?: number, mode?: 'single'|'all' }} options
 */
export function spawnExpClaimCelebration({
  amount,
  count = 1,
  clientX,
  clientY,
  mode = 'single',
} = {}) {
  const value = Math.max(0, Number(amount) || 0);
  if (value <= 0) return;

  ensureHost();

  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 700;
  const originX = typeof clientX === 'number' ? clientX : vw / 2;
  const originY = typeof clientY === 'number' ? clientY : vh * 0.42;

  const isAll = mode === 'all' || count > 1;
  const sparkCount = isAll ? 28 : 16;
  const chipCount = isAll ? 8 : 5;
  const duration = isAll ? 1.35 : 1.05;
  const burstId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sink = resolveExpSink();

  const sparks = Array.from({ length: sparkCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / sparkCount + randomBetween(-0.2, 0.2);
    const distance = randomBetween(isAll ? 70 : 40, isAll ? 180 : 120);
    return {
      id: `${burstId}-s-${index}`,
      x: originX,
      y: originY,
      size: randomBetween(3, isAll ? 8 : 6),
      color: SPARK_COLORS[index % SPARK_COLORS.length],
      driftX: Math.cos(angle) * distance,
      driftY: Math.sin(angle) * distance - randomBetween(10, 40),
      duration: randomBetween(0.55, 0.95),
      delay: index * 0.012,
    };
  });

  const chips = Array.from({ length: chipCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / chipCount + randomBetween(-0.15, 0.15);
    const distance = randomBetween(50, isAll ? 140 : 100);
    return {
      id: `${burstId}-c-${index}`,
      label: `+${Math.max(1, Math.round(value / chipCount + randomBetween(-2, 4)))}`,
      driftX: Math.cos(angle) * distance,
      driftY: Math.sin(angle) * distance - 20,
      rotate: randomBetween(-25, 25),
      duration: randomBetween(0.7, 1),
      delay: 0.05 + index * 0.04,
    };
  });

  const flyCount = sink ? (isAll ? 5 : 3) : 0;
  const flyChips = Array.from({ length: flyCount }, (_, index) => {
    const jitterX = randomBetween(-18, 18);
    const jitterY = randomBetween(-12, 12);
    return {
      id: `${burstId}-f-${index}`,
      label: `+${Math.max(1, Math.round(value / Math.max(flyCount, 1)))}`,
      targetX: sink.x - originX + jitterX,
      targetY: sink.y - originY + jitterY,
      duration: randomBetween(0.75, 0.95),
      delay: 0.35 + index * 0.06,
    };
  });

  const lifetimeMs = Math.max(
    duration * 1000 + 120,
    flyChips.length
      ? Math.max(...flyChips.map((c) => (c.delay + c.duration) * 1000)) + 200
      : 0
  );

  pushShow({
    id: burstId,
    amount: value,
    count,
    mode: isAll ? 'all' : 'single',
    originX,
    originY,
    sparks,
    chips,
    flyChips,
    sink,
    duration,
    lifetimeMs,
  });
}

/**
 * Compact level / rank moment overlay.
 * @param {{ kind?: 'level'|'rank', title: string, subtitle?: string }} options
 */
export function spawnExpMoment({ kind = 'level', title, subtitle } = {}) {
  if (!title) return;
  ensureHost();

  const burstId = `moment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pushShow({
    id: burstId,
    mode: 'moment',
    kind,
    title,
    subtitle,
    sparks: [],
    chips: [],
    flyChips: [],
    lifetimeMs: 1600,
  });
}
