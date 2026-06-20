import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const SplashInteractionContext = createContext(null);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function SplashInteractionProvider({ children, preview = false }) {
  const containerRef = useRef(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0, nx: 0, ny: 0 });
  const [taps, setTaps] = useState([]);
  const [tapCount, setTapCount] = useState(0);
  const [charge, setCharge] = useState(0);
  const [isPressed, setIsPressed] = useState(false);

  const updatePointer = useCallback((clientX, clientY) => {
    const element = containerRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const x = clientX - rect.left - rect.width / 2;
    const y = clientY - rect.top - rect.height / 2;

    setPointer({
      x,
      y,
      nx: clamp(x / (rect.width / 2), -1, 1),
      ny: clamp(y / (rect.height / 2), -1, 1),
    });
  }, []);

  const registerTap = useCallback((clientX, clientY) => {
    const element = containerRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();

    setTaps((current) => [
      ...current.slice(-10),
      {
        id: `${Date.now()}-${Math.random()}`,
        x: clientX - rect.left,
        y: clientY - rect.top,
        time: Date.now(),
      },
    ]);
    setTapCount((count) => count + 1);
    setCharge((value) => Math.min(100, value + 20));
  }, []);

  const handlers = useMemo(() => ({
    onPointerMove: (event) => {
      updatePointer(event.clientX, event.clientY);
      setCharge((value) => Math.min(100, value + 0.35));
    },
    onPointerDown: (event) => {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      updatePointer(event.clientX, event.clientY);
      registerTap(event.clientX, event.clientY);
      setIsPressed(true);
    },
    onPointerUp: () => setIsPressed(false),
    onPointerCancel: () => setIsPressed(false),
  }), [registerTap, updatePointer]);

  useEffect(() => {
    if (!preview) return undefined;

    let frame = 0;
    let tick = 0;

    const animate = () => {
      tick += 0.028;
      const nx = Math.sin(tick) * 0.7;
      const ny = Math.cos(tick * 0.85) * 0.5;

      setPointer({
        x: nx * 70,
        y: ny * 50,
        nx,
        ny,
      });
      setCharge((value) => (value >= 100 ? 24 : Math.min(100, value + 0.8)));

      if (Math.floor(tick * 12) % 18 === 0) {
        setTaps((current) => [
          ...current.slice(-10),
          {
            id: `preview-${tick}`,
            x: 110 + nx * 36,
            y: 118 + ny * 28,
            time: Date.now(),
          },
        ]);
        setTapCount((count) => count + 1);
      }

      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(frame);
  }, [preview]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setTaps((current) => current.filter((tap) => now - tap.time < 1400));
    }, 180);

    return () => window.clearInterval(interval);
  }, []);

  const value = useMemo(
    () => ({
      containerRef,
      pointer,
      taps,
      tapCount,
      charge,
      isPressed,
      preview,
      handlers,
    }),
    [charge, handlers, isPressed, pointer, preview, tapCount, taps],
  );

  return (
    <SplashInteractionContext.Provider value={value}>
      <div
        ref={containerRef}
        className="relative touch-manipulation select-none"
        {...(!preview ? handlers : {})}
      >
        {children}
      </div>
    </SplashInteractionContext.Provider>
  );
}

export function useSplashInteraction() {
  const context = useContext(SplashInteractionContext);
  if (!context) {
    throw new Error('useSplashInteraction must be used within SplashInteractionProvider');
  }
  return context;
}

export function useInteractiveComplete({
  preview = false,
  onComplete,
  charge = 0,
  tapCount = 0,
  minCharge = 88,
  minTaps = 3,
}) {
  const completedRef = useRef(false);

  useEffect(() => {
    if (preview || completedRef.current || !onComplete) return undefined;

    if (charge >= minCharge || tapCount >= minTaps) {
      completedRef.current = true;
      onComplete();
    }

    return undefined;
  }, [charge, minCharge, minTaps, onComplete, preview, tapCount]);
}

function InteractiveCompleteTrigger({ preview, onComplete }) {
  const { charge, tapCount } = useSplashInteraction();
  useInteractiveComplete({ preview, onComplete, charge, tapCount });
  return null;
}

export function InteractiveSplashShell({ preview = false, onComplete, children }) {
  return (
    <SplashInteractionProvider preview={preview}>
      <InteractiveCompleteTrigger preview={preview} onComplete={onComplete} />
      {children}
    </SplashInteractionProvider>
  );
}
