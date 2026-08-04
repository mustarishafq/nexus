import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ExpLevelBar({
  level,
  stars = 0,
  expIntoLevel,
  expForLevel,
  progress,
  className,
  showLabel = true,
  size = 'md',
}) {
  const need = Math.max(1, Number(expForLevel) || 100);
  const into = Number(expIntoLevel) || 0;
  const starCount = Math.max(0, Number(stars) || 0);
  const pct = Math.min(
    100,
    Math.max(0, (typeof progress === 'number' ? progress : into / need) * 100)
  );

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel ? (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-foreground">
            Lv {level}
            {starCount > 0 ? (
              <span
                className="inline-flex items-center -space-x-0.5 text-amber-500"
                title={`${starCount} star${starCount === 1 ? '' : 's'}`}
              >
                {Array.from({ length: starCount }, (_, index) => (
                  <Star
                    key={index}
                    className="h-3 w-3 fill-amber-400 text-amber-500"
                    aria-hidden
                  />
                ))}
              </span>
            ) : null}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {into}/{need}
          </span>
        </div>
      ) : null}
      <div
        className={cn(
          'overflow-hidden rounded-full bg-muted',
          size === 'sm' ? 'h-1' : 'h-1.5'
        )}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
