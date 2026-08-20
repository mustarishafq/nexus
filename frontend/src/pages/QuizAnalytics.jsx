// @ts-nocheck
import db from '@/api/apiClient';
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart3, CheckCircle2, XCircle, Clock, Flame, Trophy, Zap, Timer, ChevronDown,
} from 'lucide-react';
import PageLoader from '@/components/PageLoader';
import QuizAvatar from '@/components/games/QuizAvatar';
import { GameStage, GameActionButton } from '@/components/games/GameUi';
import { cn } from '@/lib/utils';
import {
  formatAccuracy,
  formatResponseMs,
  formatScore,
  formatPointsDelta,
  formatDifficulty,
  formatExpEarned,
  powerUpLabel,
  questionOutcome,
  questionOutcomeMark,
} from '@/lib/quizAnalyticsFormat';
import {
  analyticsHeadline,
  hostTableCells,
  powerUpStatus,
  rankChangeLabel,
} from '@/lib/quizAnalyticsView';

export default function QuizAnalytics() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ['quiz-session-analytics', id],
    queryFn: () => db.quizSessions.analytics(id),
  });

  if (query.isLoading) return <PageLoader />;

  if (query.isError || !query.data) {
    return (
      <GameStage phase="finished">
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <p className="text-white font-black text-xl">Analytics aren&apos;t available yet.</p>
          <p className="text-white/70 font-semibold">Finish the game first, then try again.</p>
          <Link to="/games"><GameActionButton variant="secondary">Back to Games</GameActionButton></Link>
        </div>
      </GameStage>
    );
  }

  const data = query.data;
  const isHost = !!data.viewer?.is_host;

  return (
    <GameStage phase="finished">
      <div className="max-w-5xl mx-auto space-y-6 pb-8">
        <header className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">{data.session?.title}</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white drop-shadow">
            {analyticsHeadline(isHost)}
          </h1>
        </header>

        {isHost ? <HostAnalytics data={data} /> : <PlayerAnalytics data={data} />}

        <div className="flex justify-center pt-2">
          <Link to="/games">
            <GameActionButton variant="secondary">Back to Games</GameActionButton>
          </Link>
        </div>
      </div>
    </GameStage>
  );
}

function HostAnalytics({ data }) {
  const [openId, setOpenId] = useState(null);
  const summary = data.summary || {};
  const players = data.players || [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Players" value={data.session?.player_count ?? 0} />
        <StatCard label="Questions" value={data.session?.question_count ?? 0} />
        <StatCard label="Avg accuracy" value={formatAccuracy(summary.average_accuracy)} accent="green" />
        <StatCard label="Avg time" value={formatResponseMs(summary.average_response_ms)} accent="blue" />
        <StatCard
          label="Winner"
          value={summary.winner?.display_name || '—'}
          hint={summary.winner ? `${formatScore(summary.winner.score)} pts` : null}
          accent="gold"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <QuestionQuality rows={data.question_quality || []} />

      <div className="rounded-3xl bg-black/25 border border-white/15 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-sm font-black text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Player comparison
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-white/50">
                {['Player', 'Score', 'Accuracy', 'Correct', 'Wrong', 'Missed', 'Avg. time', 'Best streak', 'Power-ups'].map((h) => (
                  <th key={h} className="px-3 py-2 font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const cells = hostTableCells(p);
                const open = openId === p.user_id;
                return (
                  <React.Fragment key={p.user_id}>
                    <tr
                      className="border-t border-white/10 text-white hover:bg-white/5 cursor-pointer"
                      onClick={() => setOpenId(open ? null : p.user_id)}
                    >
                      <td className="px-3 py-3 font-black">
                        <span className="inline-flex items-center gap-2">
                          <QuizAvatar
                            profileImage={p.profile_picture}
                            profileImageCrop={p.profile_picture_crop}
                            accessoryId={p.accessory_id}
                            name={p.display_name}
                            size="sm"
                          />
                          {cells.name}
                          <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')} />
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums font-bold">{formatScore(cells.score)}</td>
                      <td className="px-3 py-3">{formatAccuracy(cells.accuracy)}</td>
                      <td className="px-3 py-3">{cells.correct}</td>
                      <td className="px-3 py-3">{cells.wrong}</td>
                      <td className="px-3 py-3">{cells.missed}</td>
                      <td className="px-3 py-3">{formatResponseMs(cells.average_response_ms)}</td>
                      <td className="px-3 py-3">{cells.best_streak}</td>
                      <td className="px-3 py-3">{cells.powerUps}</td>
                    </tr>
                    {open ? (
                      <tr className="border-t border-white/10 bg-black/20">
                        <td colSpan={9} className="px-3 py-4">
                          <QuestionBreakdown questions={p.questions} />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {players.length === 0 ? (
          <p className="px-4 py-8 text-center text-white/60 font-semibold">No players in this session.</p>
        ) : null}
      </div>
    </div>
  );
}

function PlayerAnalytics({ data }) {
  const me = data.me;
  if (!me) {
    return (
      <div className="rounded-3xl bg-black/25 border border-white/15 p-8 text-center text-white/70 font-semibold">
        No personal results for this session.
      </div>
    );
  }

  const rankChange = Number(me.rank_delta) || 0;

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-[#D89E00] text-amber-950 px-5 py-6 text-center font-black shadow-xl"
      >
        <Trophy className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm uppercase tracking-[0.2em]">Final score</p>
        <p className="text-4xl tabular-nums">{formatScore(me.score)}</p>
        <p className="mt-1 text-sm">Rank #{me.rank}{rankChange !== 0 ? ` · ${rankChangeLabel(rankChange)}` : ''}</p>
        {formatExpEarned(me.exp_earned, me.exp_status) ? (
          <p className="mt-2 text-lg">{formatExpEarned(me.exp_earned, me.exp_status)}</p>
        ) : null}
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Accuracy" value={formatAccuracy(me.accuracy)} accent="green" icon={CheckCircle2} />
        <StatCard label="Avg. time" value={formatResponseMs(me.average_response_ms)} accent="blue" icon={Timer} />
        <StatCard label="Correct" value={me.correct} accent="green" icon={CheckCircle2} />
        <StatCard label="Wrong" value={me.wrong} accent="red" icon={XCircle} />
        <StatCard label="Missed" value={me.missed} accent="slate" icon={Clock} />
        <StatCard label="Best streak" value={me.best_streak || 0} accent="orange" icon={Flame} />
      </div>

      <div className="rounded-3xl bg-black/25 border border-white/15 p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
        <MiniStat label="Final score" value={formatScore(me.score)} />
        <MiniStat label="Final rank" value={`#${me.rank ?? '—'}`} />
        <MiniStat label="EXP earned" value={formatExpEarned(me.exp_earned, me.exp_status) || '—'} />
        <MiniStat label="Rank change" value={rankChangeLabel(rankChange)} />
        <MiniStat label="Fastest" value={formatResponseMs(me.fastest_response_ms)} />
        <MiniStat label="Slowest" value={formatResponseMs(me.slowest_response_ms)} />
      </div>

      {(me.power_ups || []).length > 0 && (
        <div className="rounded-3xl bg-black/25 border border-white/15 p-5 space-y-3">
          <p className="text-sm font-black text-white flex items-center gap-2">
            <Zap className="h-4 w-4" /> Power-ups
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {me.power_ups.map((pu) => {
              const status = powerUpStatus(pu);
              return (
                <div key={pu.type} className="rounded-2xl bg-black/25 border border-white/10 px-3 py-3 text-center">
                  <p className="text-xs font-black text-white">{powerUpLabel(pu.type)}</p>
                  <p className="mt-1 text-sm font-bold text-white/80">{status.usedLabel}</p>
                  {status.effectLabel ? (
                    <p className="text-[11px] font-semibold text-emerald-300 mt-1">{status.effectLabel}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-black/25 border border-white/15 p-5">
        <p className="text-sm font-black text-white mb-3">Question breakdown</p>
        <QuestionBreakdown questions={me.questions} />
      </div>
    </div>
  );
}

function QuestionQuality({ rows = [] }) {
  if (!rows.length) return null;

  return (
    <div className="rounded-3xl bg-black/25 border border-white/15 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-sm font-black text-white">Question Quality</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-white/50">
              {['Q', 'Prompt', 'Correct', 'Wrong', 'Missed', 'Accuracy', 'Avg. time', 'Difficulty'].map((h) => (
                <th key={h} className="px-3 py-2 font-bold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.question_id} className="border-t border-white/10 text-white">
                <td className="px-3 py-3 font-black text-white/60">Q{row.index}</td>
                <td className="px-3 py-3 font-semibold max-w-[280px] truncate" title={row.prompt}>{row.prompt}</td>
                <td className="px-3 py-3 tabular-nums">{row.correct}</td>
                <td className="px-3 py-3 tabular-nums">{row.wrong}</td>
                <td className="px-3 py-3 tabular-nums">{row.missed}</td>
                <td className="px-3 py-3">{formatAccuracy(row.accuracy)}</td>
                <td className="px-3 py-3">{formatResponseMs(row.average_response_ms)}</td>
                <td className="px-3 py-3 font-black">{formatDifficulty(row.difficulty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuestionBreakdown({ questions = [] }) {
  const [open, setOpen] = useState(null);
  if (!questions.length) {
    return <p className="text-sm font-semibold text-white/60">No question results.</p>;
  }

  return (
    <div className="space-y-2">
      {questions.map((q) => {
        const outcome = questionOutcome(q);
        const expanded = open === q.question_id;
        return (
          <button
            key={q.question_id}
            type="button"
            onClick={() => setOpen(expanded ? null : q.question_id)}
            className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 text-left text-white"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-white/50 w-8">Q{q.index}</span>
              <span className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black',
                outcome === 'correct' && 'bg-[#26890C]',
                outcome === 'wrong' && 'bg-[#E21B3C]',
                outcome === 'missed' && 'bg-slate-500',
              )}
              >
                {questionOutcomeMark(outcome)}
              </span>
              <span className="flex-1 font-bold">{formatResponseMs(q.response_ms)}</span>
              <span className="font-black tabular-nums">{formatPointsDelta(q.points_awarded)}</span>
              <ChevronDown className={cn('h-4 w-4 opacity-60 transition-transform', expanded && 'rotate-180')} />
            </div>
            {expanded ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-white/80">
                <p>Streak after: {q.streak_after || 0}</p>
                <p>Power-up: {q.power_up_used ? powerUpLabel(q.power_up_used) : '—'}</p>
                {q.rank_after != null ? <p>Rank after: #{q.rank_after}</p> : null}
                {q.rank_delta ? <p>Rank change: {q.rank_delta > 0 ? `↑ ${q.rank_delta}` : `↓ ${Math.abs(q.rank_delta)}`}</p> : null}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, hint, accent, icon: Icon, className }) {
  const accents = {
    green: 'from-[#26890C] to-[#1a5f08]',
    blue: 'from-[#1368CE] to-[#0d4a94]',
    red: 'from-[#E21B3C] to-[#b0142e]',
    orange: 'from-[#FF8B2D] to-[#d56e12]',
    gold: 'from-amber-400 to-yellow-600',
    slate: 'from-slate-500 to-slate-700',
  };

  return (
    <div className={cn('rounded-3xl bg-gradient-to-br text-white px-4 py-4 shadow-lg', accents[accent] || 'from-white/15 to-black/20', className)}>
      <p className="text-[11px] font-black uppercase tracking-wider opacity-80 flex items-center gap-1">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </p>
      <p className="mt-1 text-xl sm:text-2xl font-black truncate">{value}</p>
      {hint ? <p className="text-xs font-semibold opacity-80">{hint}</p> : null}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}
