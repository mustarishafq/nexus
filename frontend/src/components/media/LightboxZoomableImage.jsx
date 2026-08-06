import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_SCALE = 2.5;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function midpoint(a, b) {
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  };
}

/**
 * Pinch / double-tap / wheel zoom for lightbox images.
 * Stage stays fixed to the viewport; only the image transforms.
 *
 * @param {() => void} [onDismiss] - Called on a single tap of empty stage (scale 1).
 */
export default function LightboxZoomableImage({
  src,
  alt = '',
  className,
  imgClassName,
  onLoad,
  onError,
  onDismiss,
  ...imgProps
}) {
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const panRef = useRef(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const movedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const applyTransform = () => {
    const img = imgRef.current;
    if (!img) return;
    const { scale, x, y } = transformRef.current;
    img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    // Soften the resting “card” chrome once zoomed into the full stage.
    img.style.borderRadius = scale > 1.05 ? '0px' : '';
  };

  const resetTransform = () => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    applyTransform();
  };

  const clampPan = () => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img) return;

    const { scale } = transformRef.current;
    if (scale <= 1) {
      transformRef.current.x = 0;
      transformRef.current.y = 0;
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const baseWidth = img.offsetWidth;
    const baseHeight = img.offsetHeight;
    const scaledWidth = baseWidth * scale;
    const scaledHeight = baseHeight * scale;
    const maxX = Math.max(0, (scaledWidth - stageRect.width) / 2);
    const maxY = Math.max(0, (scaledHeight - stageRect.height) / 2);

    transformRef.current.x = clamp(transformRef.current.x, -maxX, maxX);
    transformRef.current.y = clamp(transformRef.current.y, -maxY, maxY);
  };

  const zoomAt = (clientX, clientY, nextScale) => {
    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const { scale, x, y } = transformRef.current;
    const target = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    if (target === scale) return;

    const ox = clientX - rect.left - rect.width / 2;
    const oy = clientY - rect.top - rect.height / 2;
    const ratio = target / scale;

    transformRef.current = {
      scale: target,
      x: target <= 1 ? 0 : ox - (ox - x) * ratio,
      y: target <= 1 ? 0 : oy - (oy - y) * ratio,
    };
    clampPan();
    applyTransform();
  };

  useEffect(() => {
    resetTransform();
  }, [src]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      stage.setPointerCapture?.(event.pointerId);
      pointersRef.current.set(event.pointerId, event);
      movedRef.current = false;

      if (pointersRef.current.size === 2) {
        const [a, b] = [...pointersRef.current.values()];
        pinchRef.current = {
          startDistance: distance(a, b),
          startScale: transformRef.current.scale,
          startMid: midpoint(a, b),
          startX: transformRef.current.x,
          startY: transformRef.current.y,
        };
        panRef.current = null;
      } else if (pointersRef.current.size === 1) {
        pinchRef.current = null;
        panRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          originX: transformRef.current.x,
          originY: transformRef.current.y,
        };
      }
    };

    const onPointerMove = (event) => {
      if (!pointersRef.current.has(event.pointerId)) return;
      pointersRef.current.set(event.pointerId, event);

      if (pointersRef.current.size === 2 && pinchRef.current) {
        event.preventDefault();
        movedRef.current = true;
        const [a, b] = [...pointersRef.current.values()];
        const currentDistance = distance(a, b);
        const mid = midpoint(a, b);
        const { startDistance, startScale, startMid, startX, startY } = pinchRef.current;
        if (startDistance <= 0) return;

        const nextScale = clamp(startScale * (currentDistance / startDistance), MIN_SCALE, MAX_SCALE);
        const dx = mid.x - startMid.x;
        const dy = mid.y - startMid.y;
        const ratio = nextScale / startScale;

        transformRef.current = {
          scale: nextScale,
          x: nextScale <= 1 ? 0 : startX * ratio + dx,
          y: nextScale <= 1 ? 0 : startY * ratio + dy,
        };
        clampPan();
        applyTransform();
        return;
      }

      if (pointersRef.current.size === 1 && panRef.current && transformRef.current.scale > 1) {
        event.preventDefault();
        const dx = event.clientX - panRef.current.startX;
        const dy = event.clientY - panRef.current.startY;
        if (Math.hypot(dx, dy) > 3) movedRef.current = true;
        transformRef.current.x = panRef.current.originX + dx;
        transformRef.current.y = panRef.current.originY + dy;
        clampPan();
        applyTransform();
      }
    };

    const endPointer = (event) => {
      if (!pointersRef.current.has(event.pointerId)) return;
      pointersRef.current.delete(event.pointerId);

      if (pointersRef.current.size < 2) {
        pinchRef.current = null;
      }

      if (pointersRef.current.size === 1) {
        const remaining = [...pointersRef.current.values()][0];
        panRef.current = {
          startX: remaining.clientX,
          startY: remaining.clientY,
          originX: transformRef.current.x,
          originY: transformRef.current.y,
        };
      } else {
        panRef.current = null;
      }

      if (pointersRef.current.size === 0 && transformRef.current.scale <= 1.02) {
        resetTransform();
      }
    };

    const onPointerUp = (event) => {
      const wasTap = !movedRef.current && pointersRef.current.size === 1;
      const tapX = event.clientX;
      const tapY = event.clientY;
      const tappedImage = event.target === imgRef.current;
      endPointer(event);

      if (!wasTap) return;

      // Mouse: single click on empty stage dismisses (image click does not).
      if (event.pointerType === 'mouse') {
        if (!tappedImage && transformRef.current.scale <= 1.05) {
          onDismissRef.current?.();
        }
        return;
      }

      const now = Date.now();
      const last = lastTapRef.current;
      const close =
        now - last.time < DOUBLE_TAP_MS &&
        Math.hypot(tapX - last.x, tapY - last.y) < 36;

      if (close) {
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        if (transformRef.current.scale > 1.05) {
          resetTransform();
        } else {
          zoomAt(tapX, tapY, DOUBLE_TAP_SCALE);
        }
        return;
      }

      // Deferred single-tap: dismiss empty stage, or ignore image taps.
      lastTapRef.current = { time: now, x: tapX, y: tapY };
      window.setTimeout(() => {
        const latest = lastTapRef.current;
        if (latest.time !== now) return;
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        if (transformRef.current.scale > 1.05) return;
        if (!tappedImage) {
          onDismissRef.current?.();
        }
      }, DOUBLE_TAP_MS + 20);
    };

    const onWheel = (event) => {
      event.preventDefault();
      const delta = event.deltaY;
      const factor = delta > 0 ? 0.9 : 1.1;
      zoomAt(event.clientX, event.clientY, transformRef.current.scale * factor);
    };

    const preventGesture = (event) => {
      event.preventDefault();
    };

    const onTouchMove = (event) => {
      if (event.touches.length > 1 || transformRef.current.scale > 1) {
        event.preventDefault();
      }
    };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove, { passive: false });
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', endPointer);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('gesturestart', preventGesture, { passive: false });
    stage.addEventListener('gesturechange', preventGesture, { passive: false });
    stage.addEventListener('gestureend', preventGesture, { passive: false });
    stage.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', endPointer);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('gesturestart', preventGesture);
      stage.removeEventListener('gesturechange', preventGesture);
      stage.removeEventListener('gestureend', preventGesture);
      stage.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className={cn(
        // Full-bleed fixed stage — zoom/pan happens inside this viewport.
        'absolute inset-0 flex touch-none select-none items-center justify-center overflow-hidden',
        className
      )}
      style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
      onClick={(event) => event.stopPropagation()}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        className={cn(
          'max-h-full max-w-full origin-center object-contain will-change-transform',
          imgClassName
        )}
        style={{ transform: 'translate3d(0px, 0px, 0) scale(1)' }}
        onLoad={onLoad}
        onError={onError}
        {...imgProps}
      />
    </div>
  );
}
