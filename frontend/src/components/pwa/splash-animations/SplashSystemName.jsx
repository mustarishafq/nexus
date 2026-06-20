import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export default function SplashSystemName({ runtime, preview = false }) {
  const text = runtime.title.text?.trim();

  if (!runtime.title.show || !text) {
    return null;
  }

  const fontSize = `${1.125 * runtime.title.sizeScale}rem`;
  const style = {
    color: runtime.title.color,
    fontSize,
    textShadow: `0 8px 24px ${runtime.withAlpha('#000000', 0.35)}`,
  };

  if (runtime.title.animation === 'typewriter') {
    return (
      <TypewriterTitle
        text={text}
        style={style}
        preview={preview}
        runtime={runtime}
      />
    );
  }

  if (runtime.title.animation === 'shimmer') {
    return (
      <motion.p
        className="relative overflow-hidden px-4 text-center font-semibold tracking-tight"
        style={style}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: runtime.scaleDuration(0.4) }}
      >
        <span className="relative z-10">{text}</span>
        <motion.span
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          initial={{ x: '-120%' }}
          animate={{ x: preview ? ['-120%', '120%'] : '120%' }}
          transition={{
            duration: runtime.scaleDuration(1.2),
            repeat: preview ? Infinity : 0,
            ease: 'easeInOut',
            delay: runtime.scaleDuration(0.25),
          }}
        />
      </motion.p>
    );
  }

  if (runtime.title.animation === 'glow-pulse') {
    return (
      <motion.p
        className="px-4 text-center font-semibold tracking-tight"
        style={{
          ...style,
          textShadow: `0 0 18px ${runtime.withAlpha(runtime.title.color, 0.65)}, 0 8px 24px ${runtime.withAlpha('#000000', 0.35)}`,
        }}
        animate={{ opacity: preview ? [0.65, 1, 0.65] : [0.7, 1, 0.85] }}
        transition={{
          duration: runtime.scaleDuration(1.4),
          repeat: preview ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        {text}
      </motion.p>
    );
  }

  if (runtime.title.animation === 'slide-up') {
    return (
      <motion.p
        className="px-4 text-center font-semibold tracking-tight"
        style={style}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: runtime.scaleDuration(0.85), ease: [0.22, 1, 0.36, 1] }}
      >
        {text}
      </motion.p>
    );
  }

  if (runtime.title.animation === 'none') {
    return (
      <p className="px-4 text-center font-semibold tracking-tight" style={style}>
        {text}
      </p>
    );
  }

  return (
    <motion.p
      className="px-4 text-center font-semibold tracking-tight"
      style={style}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: runtime.scaleDuration(0.9), ease: [0.22, 1, 0.36, 1], delay: runtime.scaleDuration(0.2) }}
    >
      {text}
    </motion.p>
  );
}

function TypewriterTitle({ text, style, preview, runtime }) {
  const [visibleCount, setVisibleCount] = useState(preview ? text.length : 0);
  const delayMs = useMemo(() => Math.max(30, Math.round(650 / Math.max(text.length, 1))), [text.length]);

  useEffect(() => {
    if (preview) {
      setVisibleCount(text.length);
      return undefined;
    }

    setVisibleCount(0);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleCount(index);
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, delayMs / runtime.timing.speedMultiplier);

    return () => window.clearInterval(timer);
  }, [delayMs, preview, runtime.timing.speedMultiplier, text]);

  return (
    <p className="px-4 text-center font-semibold tracking-tight" style={style} aria-hidden="true">
      {text.slice(0, visibleCount)}
      {!preview && visibleCount < text.length ? (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          |
        </motion.span>
      ) : null}
    </p>
  );
}
