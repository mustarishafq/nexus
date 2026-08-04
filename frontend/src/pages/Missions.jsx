import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion';
import {
  ArrowRight,
  Cake,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Newspaper,
  QrCode,
  SmilePlus,
  Target,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import db from '@/api/apiClient';
import UserAvatar from '@/components/users/UserAvatar';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import BadgesStrip from '@/components/gamification/BadgesStrip';
import ExpLevelBar from '@/components/gamification/ExpLevelBar';
import {
  GAMIFICATION_MISSIONS_QUERY_KEY,
  STREAK_LABELS,
  claimAllGamificationRewards,
  claimGamificationReward,
  formatStreakCounts,
  isStreakAtRisk,
  levelProgress,
  starsFromLevel,
} from '@/lib/gamification';
import { useMetaTags } from '@/hooks/useMetaTags';
import { cn } from '@/lib/utils';

const PERIODS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All time' },
];

const MISSION_ICONS = {
  clock_in: Clock,
  clock_in_early: Zap,
  clock_out: Clock,
  feed_post: Newspaper,
  feed_react: SmilePlus,
  feed_comment: MessageCircle,
  feed_comment_react: SmilePlus,
  feed_poll_vote: Vote,
  event_check_in: QrCode,
  celebration_wish: Cake,
  profile_media_react: ImageIcon,
  profile_media_comment: ImageIcon,
};

const RANK_STYLES = {
  1: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  2: 'bg-slate-400/15 text-slate-600 dark:text-slate-300 border-slate-400/30',
  3: 'bg-orange-700/15 text-orange-700 dark:text-orange-300 border-orange-700/30',
};

function AnimatedNumber({ value }) {
  const spring = useSpring(0, { stiffness: 90, damping: 20 });
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString());
  const [text, setText] = useState('0');

  useEffect(() => {
    spring.set(Number(value) || 0);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = display.on('change', (latest) => setText(latest));
    return unsubscribe;
  }, [display]);

  return <span className="tabular-nums">{text}</span>;
}

function MissionIcon({ actionKey, muted = false }) {
  const Icon = MISSION_ICONS[actionKey] || Target;
  return (
    <div
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
        muted
          ? 'border-border bg-muted/40 text-muted-foreground'
          : 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300'
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

function CapProgress({ mission }) {
  if (mission.daily_cap == null) {
    return (
      <div className="mt-2">
        <p className="text-[11px] text-muted-foreground">Unlimited today</p>
      </div>
    );
  }

  const ratio = Math.min(1, (Number(mission.offered_today) || 0) / Math.max(1, mission.daily_cap));
  const done = mission.completed_today;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className={cn('tabular-nums', done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
          {done ? (
            <span className="inline-flex items-center gap-1">
              <Check className="h-3 w-3" /> Done today
            </span>
          ) : (
            `${mission.offered_today}/${mission.daily_cap} today · ${mission.remaining_today} left`
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn('h-full rounded-full', done ? 'bg-emerald-500' : 'bg-amber-500')}
          initial={{ width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

function MissionGroup({ title, items, empty, muted = false }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {empty || 'Nothing here.'}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      <ul className="space-y-2">
        {items.map((mission, index) => (
          <motion.li
            key={mission.action_key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.04, 0.28), duration: 0.3 }}
          >
            {mission.href ? (
              <Link
                to={mission.href}
                className={cn(
                  'group flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 transition-all',
                  'hover:-translate-y-0.5 hover:border-amber-500/35 hover:shadow-md',
                  muted && 'opacity-65 hover:opacity-90'
                )}
              >
                <MissionIcon actionKey={mission.action_key} muted={muted} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm font-semibold truncate', muted && 'text-muted-foreground')}>
                      {mission.title}
                    </p>
                    {mission.streak_key && mission.streak_count > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-300">
                        <Flame className="h-3 w-3" />
                        {mission.streak_count}d
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{mission.description}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300">
                      +{mission.base} EXP
                    </span>
                  </div>
                  <CapProgress mission={mission} />
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors group-hover:border-amber-500/40 group-hover:text-foreground">
                  Go
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ) : (
              <div className={cn('flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3', muted && 'opacity-65')}>
                <MissionIcon actionKey={mission.action_key} muted={muted} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{mission.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{mission.description}</p>
                  <CapProgress mission={mission} />
                </div>
              </div>
            )}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function PendingList({ pending, isLoading, claim, claimPending }) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Nothing to claim yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">Complete a mission to earn EXP.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {pending.map((reward, index) => (
          <motion.li
            key={reward.id}
            layout
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 24 }}
            transition={{ delay: Math.min(index * 0.03, 0.2) }}
            className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-card to-card px-3.5 py-3"
          >
            <MissionIcon actionKey={reward.action_key} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{reward.title}</p>
              <p className="text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300">
                +{reward.amount} EXP ready
              </p>
            </div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Button
                size="sm"
                className="bg-amber-500 text-amber-950 hover:bg-amber-400"
                disabled={claimPending}
                onClick={(event) => claim(reward.id, event)}
              >
                Claim
              </Button>
            </motion.div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function CompetitionCards({ rival, weekSpotlight, viewerRank, expTotal }) {
  const podium = Array.isArray(weekSpotlight?.podium) ? weekSpotlight.podium : [];
  const weekRank = weekSpotlight?.viewer_week_rank;
  const weekExp = Number(weekSpotlight?.viewer_week_exp) || 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-3.5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rival</p>
        {rival ? (
          <Link
            to={`/people/${rival.user_id}`}
            className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-2.5 py-2 transition-colors hover:border-amber-500/35 hover:bg-amber-500/5"
          >
            <UserAvatar
              user={{
                id: rival.user_id,
                name: rival.name,
                profile_picture: rival.profile_picture,
                exp_total: rival.exp_total,
                level: rival.level,
                stars: rival.stars,
              }}
              className="h-9 w-9"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{rival.name}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                #{rival.rank} · {Number(rival.exp_total).toLocaleString()} EXP
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300">
                {Number(rival.exp_ahead).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">EXP ahead</p>
            </div>
          </Link>
        ) : viewerRank === 1 ? (
          <p className="text-sm text-muted-foreground">You’re on top of the board.</p>
        ) : (Number(expTotal) || 0) <= 0 ? (
          <p className="text-sm text-muted-foreground">Claim EXP to enter the board.</p>
        ) : (
          <p className="text-sm text-muted-foreground">No rival above you right now.</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">This week</p>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {weekRank != null ? `#${weekRank}` : 'Unranked'}
            {' · '}
            {weekExp.toLocaleString()} EXP
          </p>
        </div>
        {podium.length === 0 ? (
          <p className="text-sm text-muted-foreground">No weekly climbers yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {podium.map((entry) => (
              <li key={entry.user_id}>
                <Link
                  to={`/people/${entry.user_id}`}
                  className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                      entry.rank === 1 && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                      entry.rank === 2 && 'bg-slate-400/15 text-slate-600 dark:text-slate-300',
                      entry.rank === 3 && 'bg-orange-700/15 text-orange-700 dark:text-orange-300'
                    )}
                  >
                    {entry.rank}
                  </span>
                  <UserAvatar
                    user={{
                      id: entry.user_id,
                      name: entry.name,
                      profile_picture: entry.profile_picture,
                      exp_total: entry.exp_total,
                      level: entry.level,
                      stars: entry.stars,
                    }}
                    className="h-7 w-7"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{entry.name}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {Number(entry.exp).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LeaderboardPanel({ period, onPeriodChange, className, viewerRank }) {
  const { user } = useAuth();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['gamification-leaderboard', period],
    queryFn: () => db.gamification.leaderboard({ period, limit: 50 }),
  });

  const entries = Array.isArray(data?.entries) ? data.entries : [];

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
          <h2 className="text-sm font-semibold truncate">Leaderboard</h2>
        </div>
        {viewerRank ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            You #{viewerRank}
          </span>
        ) : null}
      </div>

      <Tabs value={period} onValueChange={onPeriodChange}>
        <TabsList className="w-full grid grid-cols-3">
          {PERIODS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="text-xs sm:text-sm">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No EXP claimed yet for this period.
          </div>
        ) : (
          <ul className={cn('max-h-[70vh] divide-y divide-border overflow-y-auto', isFetching && 'opacity-70')}>
            {entries.map((entry, index) => {
              const isViewer = Number(entry.user_id) === Number(user?.id);
              const rankStyle = RANK_STYLES[entry.rank];
              return (
                <motion.li
                  key={entry.user_id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.25) }}
                >
                  <Link
                    to={`/people/${entry.user_id}`}
                    className={cn(
                      'flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/40',
                      isViewer && 'bg-amber-500/5 ring-1 ring-inset ring-amber-500/20'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold tabular-nums',
                        rankStyle || 'border-transparent text-muted-foreground'
                      )}
                    >
                      {entry.rank}
                    </span>
                    <UserAvatar
                      user={{
                        id: entry.user_id,
                        name: entry.name,
                        full_name: entry.full_name,
                        profile_picture: entry.profile_picture,
                        exp_total: entry.exp_total,
                        level: entry.level,
                        stars: entry.stars,
                      }}
                      className="h-9 w-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {entry.name}
                        {isViewer ? (
                          <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-300">(you)</span>
                        ) : null}
                      </p>
                      {entry.job_title ? (
                        <p className="truncate text-xs text-muted-foreground">{entry.job_title}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {Number(entry.exp || 0).toLocaleString()}
                      <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        EXP
                      </span>
                    </span>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ExpHero({
  expTotal,
  level,
  stars,
  expIntoLevel,
  expForLevel,
  progress,
  pendingCount,
  pendingAmount,
  availableCount,
  completedCount,
  streaks,
  viewerRank,
  onClaimAll,
  claimAllPending,
  onOpenPending,
}) {
  const activeStreaks = streaks.filter((s) => (s.current_count || 0) > 0);
  const dayProgress = availableCount + completedCount > 0
    ? completedCount / (availableCount + completedCount)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-card"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.16),transparent_55%)]" />
      <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl" />

      <div className="relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              <Zap className="h-3.5 w-3.5" />
              Experience
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-semibold tabular-nums">
              Lv {level}
            </span>
            {viewerRank ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium tabular-nums">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                Rank #{viewerRank}
              </span>
            ) : null}
          </div>

          <div>
            <p data-exp-sink="missions" className="text-4xl font-bold tracking-tight sm:text-5xl">
              <AnimatedNumber value={expTotal} />
              <span className="ml-2 text-base font-semibold text-muted-foreground sm:text-lg">EXP</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {pendingCount > 0
                ? `${pendingCount} reward${pendingCount === 1 ? '' : 's'} waiting · +${pendingAmount} unclaimed`
                : availableCount > 0
                  ? `${availableCount} mission${availableCount === 1 ? '' : 's'} ready to earn more EXP`
                  : 'All capped missions done for today — come back tomorrow'}
            </p>
            <ExpLevelBar
              className="mt-3 max-w-xs"
              level={level}
              stars={stars}
              expIntoLevel={expIntoLevel}
              expForLevel={expForLevel}
              progress={progress}
            />
          </div>

          {activeStreaks.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeStreaks.map((streak) => {
                const atRisk = isStreakAtRisk(streak);
                return (
                  <motion.span
                    key={streak.streak_key}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                      'inline-flex flex-col gap-0.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                      atRisk
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'bg-orange-500/10 text-orange-600 dark:text-orange-300'
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5" />
                      {STREAK_LABELS[streak.streak_key] || streak.streak_key}
                      {' '}
                      {formatStreakCounts(streak)}
                    </span>
                    {atRisk ? (
                      <span className="pl-5 text-[10px] font-medium opacity-80">
                        Don’t break your streak
                      </span>
                    ) : null}
                  </motion.span>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border border-border/80 bg-background/50 p-3 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Today’s mission progress</span>
            <span className="font-semibold tabular-nums">
              {completedCount}/{availableCount + completedCount || 0}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
              initial={{ width: 0 }}
              animate={{ width: `${dayProgress * 100}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {pendingCount > 0 ? (
              <>
                <motion.div className="flex-1 min-w-[8rem]" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400"
                    onClick={(event) => onClaimAll(event)}
                    disabled={claimAllPending}
                  >
                    {claimAllPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Claim +{pendingAmount}
                      </>
                    )}
                  </Button>
                </motion.div>
                <Button variant="outline" onClick={onOpenPending}>
                  View pending
                </Button>
              </>
            ) : (
              <Button variant="outline" className="w-full" asChild>
                <a href="#mission-list">
                  Browse missions
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Missions() {
  const [period, setPeriod] = useState('all');
  const [mobileTab, setMobileTab] = useState('missions');
  const [missionTab, setMissionTab] = useState('list');
  const { user } = useAuth();

  useMetaTags({
    title: 'Missions - EMZI Nexus Brain',
    description: 'Earn EXP from missions and climb the leaderboard',
  });

  const { data, isLoading } = useQuery({
    queryKey: GAMIFICATION_MISSIONS_QUERY_KEY,
    queryFn: () => db.gamification.missions(),
  });

  const { data: boardData } = useQuery({
    queryKey: ['gamification-leaderboard', period],
    queryFn: () => db.gamification.leaderboard({ period, limit: 50 }),
  });

  const claim = useMutation({
    mutationFn: ({ rewardId, clientX, clientY }) =>
      claimGamificationReward(rewardId, { clientX, clientY }),
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to claim EXP');
    },
  });

  const claimAll = useMutation({
    mutationFn: ({ clientX, clientY } = {}) =>
      claimAllGamificationRewards({ clientX, clientY }),
    onError: (error) => {
      toast.error(error?.data?.message || error.message || 'Failed to claim rewards');
    },
  });

  const missions = Array.isArray(data?.missions) ? data.missions : [];
  const pending = Array.isArray(data?.pending_rewards) ? data.pending_rewards : [];
  const pendingCount = Number(data?.pending_count) || 0;
  const pendingAmount = Number(data?.pending_amount) || 0;
  const expTotal = Number(data?.exp_total) || 0;
  const progress = data?.level != null
    ? {
        level: Number(data.level),
        exp_into_level: Number(data.exp_into_level) || 0,
        exp_for_level: Number(data.exp_for_level) || 100,
        progress: Number(data.progress) || 0,
        stars: data.stars != null ? Number(data.stars) : starsFromLevel(Number(data.level)),
      }
    : levelProgress(expTotal);
  const streaks = Array.isArray(data?.streaks) ? data.streaks : [];
  const availableMissions = missions.filter((m) => !m.completed_today);
  const completedMissions = missions.filter((m) => m.completed_today);

  const viewerRank = useMemo(() => {
    if (data?.rank != null) return Number(data.rank);
    const entries = Array.isArray(boardData?.entries) ? boardData.entries : [];
    const mine = entries.find((entry) => Number(entry.user_id) === Number(user?.id));
    return mine?.rank || null;
  }, [boardData, data?.rank, user?.id]);

  const missionsColumn = (
    <div id="mission-list" className="space-y-4 min-w-0">
      <Tabs value={missionTab} onValueChange={setMissionTab}>
        <TabsList className="grid h-11 w-full grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1">
          <TabsTrigger
            value="list"
            className={cn(
              'h-9 gap-1.5 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
              'data-[state=inactive]:text-muted-foreground'
            )}
          >
            <Target className="h-3.5 w-3.5 shrink-0 opacity-80" />
            Missions
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                missionTab === 'list'
                  ? 'bg-muted text-foreground'
                  : 'bg-background/50 text-muted-foreground'
              )}
            >
              {availableMissions.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className={cn(
              'h-9 gap-1.5 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
              'data-[state=inactive]:text-muted-foreground',
              pendingCount > 0 && missionTab !== 'pending' && 'text-amber-700 dark:text-amber-300'
            )}
          >
            <Zap className="h-3.5 w-3.5 shrink-0 opacity-80" />
            Pending
            {pendingCount > 0 ? (
              <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-950"
              >
                {pendingCount}
              </motion.span>
            ) : (
              <span className="rounded-full bg-background/50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                0
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4 space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <MissionGroup
                title="Available today"
                items={availableMissions}
                empty="All capped missions are done for today. Nice work."
              />
              {completedMissions.length > 0 ? (
                <MissionGroup title="Completed today" items={completedMissions} muted />
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <PendingList
            pending={pending}
            isLoading={isLoading}
            claim={(id, event) => claim.mutate({
              rewardId: id,
              clientX: event?.clientX,
              clientY: event?.clientY,
            })}
            claimPending={claim.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Missions"
        description="Complete actions to earn EXP and climb the company leaderboard"
        icon={Target}
      />

      <ExpHero
        expTotal={expTotal}
        level={progress.level}
        stars={progress.stars}
        expIntoLevel={progress.exp_into_level}
        expForLevel={progress.exp_for_level}
        progress={progress.progress}
        pendingCount={pendingCount}
        pendingAmount={pendingAmount}
        availableCount={availableMissions.length}
        completedCount={completedMissions.length}
        streaks={streaks}
        viewerRank={viewerRank}
        claimAllPending={claimAll.isPending}
        onClaimAll={(event) => claimAll.mutate({
          clientX: event.clientX,
          clientY: event.clientY,
        })}
        onOpenPending={() => {
          setMissionTab('pending');
          setMobileTab('missions');
        }}
      />

      <CompetitionCards
        rival={data?.rival}
        weekSpotlight={data?.week_spotlight}
        viewerRank={viewerRank}
        expTotal={expTotal}
      />

      {data?.achievements ? (
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <BadgesStrip achievements={data.achievements} />
        </div>
      ) : null}

      <div className="lg:hidden">
        <Tabs value={mobileTab} onValueChange={setMobileTab}>
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="missions" className="gap-1.5">
              <Target className="h-3.5 w-3.5" />
              Missions
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Leaderboard
            </TabsTrigger>
          </TabsList>
          <TabsContent value="missions">{missionsColumn}</TabsContent>
          <TabsContent value="leaderboard">
            <LeaderboardPanel period={period} onPeriodChange={setPeriod} viewerRank={viewerRank} />
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="lg:col-span-7 xl:col-span-8">
          {missionsColumn}
        </div>
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20">
          <LeaderboardPanel period={period} onPeriodChange={setPeriod} viewerRank={viewerRank} />
        </div>
      </div>
    </div>
  );
}
