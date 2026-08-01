import React from 'react';
import { cn } from '@/lib/utils';

export default function ExpLevelBar({
  level,
  expIntoLevel,
  expForLevel = 100,
  progress,
  className,
  showLabel = true,
  size = 'md',
}) {
  const pct = Math.min(
    100,
    Math.max(0, (typeof progress === 'number' ? progress : (expIntoLevel || 0) / Math.max(1, expForLevel)) * 100)
  );
  const into = Number(expIntoLevel) || 0;
  const need = Number(expForLevel) || 100;

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel ? (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold tabular-nums text-foreground">Lv {level}</span>
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
