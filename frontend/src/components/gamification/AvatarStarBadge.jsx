import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Fan prestige stars along a gentle arc on the avatar rim.
 * @returns {Array<{ x: number, y: number, rotate: number, scale: number }>}
 */
function arcLayout(count, size) {
  if (count <= 0) return [];

  const spacing = size === 'sm' ? (count >= 4 ? 8 : 9) : size === 'lg' ? 19 : 14;
  const lift = size === 'sm' ? 2.5 : size === 'lg' ? 7.5 : 5;
  const maxTilt = size === 'sm' ? 12 : 20;
  const halfWidth = spacing * (count - 1) / 2;

  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : (index / (count - 1)) * 2 - 1;
    return {
      x: t * halfWidth,
      y: -Math.abs(t) * lift,
      rotate: t * maxTilt,
      scale: count === 1 ? 1 : 1 - Math.abs(t) * 0.06,
    };
  });
}

function starPixelSize(size, count) {
  if (size === 'sm') return count >= 4 ? 10 : 11;
  if (size === 'lg') {
    if (count >= 5) return 16;
    if (count === 4) return 18;
    if (count === 3) return 21;
    return 26;
  }
  if (count >= 4) return 14;
  return 17;
}

/**
 * Prestige star badge seated on the bottom edge of an avatar ring.
 * Stars fan along the rim — no circular wrap, no count badge.
 */
export default function AvatarStarBadge({ stars = 0, className, size = 'md' }) {
  const count = Math.max(0, Math.min(12, Number(stars) || 0));
  const layout = useMemo(() => arcLayout(count, size), [count, size]);
  const px = starPixelSize(size, count);

  if (count <= 0) return null;

  const stageWidth = Math.max(
    size === 'sm' ? 24 : size === 'lg' ? 52 : 36,
    (count - 1) * (size === 'sm' ? (count >= 4 ? 8 : 9) : size === 'lg' ? 19 : 14) + px + 6
  );
  const stageHeight = size === 'sm' ? 16 : size === 'lg' ? 34 : 26;

  return (
    <span
      className={cn(
        'avatar-star-badge pointer-events-none absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-[38%]',
        className
      )}
      style={{ width: stageWidth, height: stageHeight }}
      title={`${count} star${count === 1 ? '' : 's'}`}
      aria-label={`${count} star${count === 1 ? '' : 's'}`}
    >
      <span className="avatar-star-badge__glow" aria-hidden />
      <span className="relative mx-auto block h-full w-full">
        {layout.map((pos, index) => (
          <span
            key={index}
            className="avatar-star-badge__slot absolute left-1/2 top-[58%]"
            style={{
              width: px,
              height: px,
              marginLeft: -px / 2,
              marginTop: -px / 2,
              transform: `translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotate}deg) scale(${pos.scale})`,
            }}
          >
            <Star
              className="avatar-star-badge__icon !h-full !w-full"
              style={{ animationDelay: `${index * 0.2}s` }}
              aria-hidden
            />
          </span>
        ))}
      </span>
    </span>
  );
}
