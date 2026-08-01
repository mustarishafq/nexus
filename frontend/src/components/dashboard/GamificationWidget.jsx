import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Flame, Loader2, Target, Trophy, Zap } from 'lucide-react';
import { toast } from 'sonner';
import db from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import ExpLevelBar from '@/components/gamification/ExpLevelBar';
import { EXP_SINK_PULSE_EVENT } from '@/components/gamification/ExpClaimCelebration';
import {
  claimAllGamificationRewards,
  GAMIFICATION_ME_QUERY_KEY,
  levelProgress,
  STREAK_LABELS,
} from '@/lib/gamification';
import { cn } from '@/lib/utils';

function rankTone(rank) {
  if (rank === 1) return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  if (rank === 2) return 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300';
  if (rank === 3) return 'border-orange-700/30 bg-orange-700/10 text-orange-700 dark:text-orange-300';
  return 'border-border bg-muted/50 text-foreground';
}

export default function GamificationWidget() {
  const { data, isLoading } = useQuery({
    queryKey: GAMIFICATION_ME_QUERY_KEY,
    queryFn: () => db.gamification.me(),
  });
  const [sinkPulse, setSinkPulse] = useState(false);

  useEffect(() => {
    const onPulse = (event) => {
      if (event.detail?.key && event.detail.key !== 'widget') return;
      setSinkPulse(true);
      window.setTimeout(() => setSinkPulse(false), 650);
    };
    window.addEventListener(EXP_SINK_PULSE_EVENT, onPulse);
    return () => window.removeEventListener(EXP_SINK_PULSE_EVENT, onPulse);
  }, []);

  const claimAll = useMutation({
    mutationFn: ({ clientX, clientY } = {}) =>
      claimAllGamificationRewards({ clientX, clientY }),
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to claim rewards');
    },
  });

  const streaks = Array.isArray(data?.streaks) ? data.streaks.filter((s) => (s.current_count || 0) > 0) : [];
  const pendingCount = Number(data?.pending_count) || 0;
  const pendingAmount = Number(data?.pending_amount) || 0;
  const expTotal = Number(data?.exp_total) || 0;
  const rank = data?.rank != null ? Number(data.rank) : null;
  const progress = data?.level != null
    ? {
        level: Number(data.level),
        exp_into_level: Number(data.exp_into_level) || 0,
        exp_for_level: Number(data.exp_for_level) || 100,
        progress: Number(data.progress) || 0,
      }
    : levelProgress(expTotal);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="h-4 w-4 text-amber-500 shrink-0" />
          <h3 className="text-sm font-semibold truncate">Experience</h3>
        </div>
        <Link
          to="/missions"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
        >
          <Target className="h-3.5 w-3.5" />
          Open
        </Link>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p
                  data-exp-sink="widget"
                  className={cn(
                    'text-2xl font-bold tracking-tight tabular-nums transition-transform duration-300',
                    sinkPulse && 'scale-110 text-amber-600 dark:text-amber-300'
                  )}
                >
                  {expTotal.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total EXP claimed</p>
              </div>
              <div className="text-right space-y-1.5">
                {rank != null ? (
                  <Link
                    to="/missions"
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums transition-colors hover:opacity-90',
                      rankTone(rank)
                    )}
                  >
                    <Trophy className="h-3 w-3" />
                    #{rank}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    <Trophy className="h-3 w-3" />
                    Unranked
                  </span>
                )}
                {pendingCount > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      +{pendingAmount}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {pendingCount} pending
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <ExpLevelBar
              level={progress.level}
              expIntoLevel={progress.exp_into_level}
              expForLevel={progress.exp_for_level}
              progress={progress.progress}
            />

            {streaks.length > 0 ? (
              <ul className="space-y-1.5">
                {streaks.map((streak) => (
                  <li
                    key={streak.streak_key}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                    <span className="truncate">
                      {STREAK_LABELS[streak.streak_key] || streak.streak_key}
                    </span>
                    <span className="ml-auto font-medium text-foreground tabular-nums">
                      {streak.current_count}d
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {pendingCount > 0 ? (
              <Button
                size="sm"
                className="w-full"
                onClick={(event) => claimAll.mutate({
                  clientX: event.clientX,
                  clientY: event.clientY,
                })}
                disabled={claimAll.isPending}
              >
                {claimAll.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Claim all (+${pendingAmount} EXP)`
                )}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
