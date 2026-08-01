import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
import db from '@/api/apiClient';
import { GAMIFICATION_MISSIONS_QUERY_KEY } from '@/lib/gamification';
import { cn } from '@/lib/utils';

/**
 * Soft “+N EXP” cue for a mission action when still available today.
 */
export default function ExpActionHint({
  actionKey,
  className,
  compact = false,
  showWhenUnavailable = false,
}) {
  const { data } = useQuery({
    queryKey: GAMIFICATION_MISSIONS_QUERY_KEY,
    queryFn: () => db.gamification.missions(),
    staleTime: 30_000,
  });

  const mission = Array.isArray(data?.missions)
    ? data.missions.find((item) => item.action_key === actionKey)
    : null;

  if (!mission) return null;

  const remaining = mission.remaining_today;
  const available = remaining == null || remaining > 0;
  if (!available && !showWhenUnavailable) return null;

  const amount = Number(mission.base) || 0;
  if (amount <= 0) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold tabular-nums',
        available
          ? 'text-amber-600 dark:text-amber-300'
          : 'text-muted-foreground/70 line-through',
        compact ? 'text-[10px]' : 'text-[11px]',
        className
      )}
    >
      <Zap className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      +{amount} EXP
      {!compact && remaining != null && remaining > 0 && remaining < (mission.daily_cap || Infinity) ? (
        <span className="font-normal text-muted-foreground">· {remaining} left</span>
      ) : null}
    </span>
  );
}
