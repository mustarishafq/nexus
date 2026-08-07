import React from 'react';
import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BadgesStrip({
  achievements,
  className,
  maxVisible = null,
  compact = false,
}) {
  const catalog = Array.isArray(achievements?.catalog) ? achievements.catalog : [];
  const earned = Array.isArray(achievements?.earned) ? achievements.earned : [];
  const earnedKeys = new Set(earned.map((item) => item.badge_key));

  let items = catalog.map((badge) => ({
    ...badge,
    unlocked: earnedKeys.has(badge.badge_key),
    unlocked_at: earned.find((row) => row.badge_key === badge.badge_key)?.unlocked_at || null,
  }));

  if (maxVisible != null) {
    const unlocked = items.filter((item) => item.unlocked).slice(0, maxVisible);
    items = unlocked.length > 0
      ? unlocked
      : items.slice(0, maxVisible);
  }

  if (items.length === 0) return null;

  return (
    <div className={cn('space-y-1.5', className)}>
      {!compact ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Badges
        </p>
      ) : null}
      <ul className={cn('flex flex-wrap gap-1.5', compact && 'justify-center sm:justify-start')}>
        {items.map((badge) => (
          <li
            key={badge.badge_key}
            title={badge.description}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium backdrop-blur-md',
              badge.unlocked
                ? 'border-amber-500/35 bg-amber-500/15 text-amber-700 shadow-[0_0_0_1px_rgba(245,158,11,0.08)] dark:text-amber-300'
                : 'border-border/60 bg-muted/25 text-muted-foreground/70'
            )}
          >
            <Award className={cn('h-3 w-3', !badge.unlocked && 'opacity-40')} />
            <span className={cn(!badge.unlocked && 'opacity-70')}>{badge.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
