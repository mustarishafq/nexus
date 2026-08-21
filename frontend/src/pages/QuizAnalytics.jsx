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
  formatExpEarned,
  powerUpLabel,
} from '@/lib/quizAnalyticsFormat';
import {
  analyticsHeadline,
  hostTableCells,
  powerUpStatus,
  rankChangeLabel,
} from '@/lib/quizAnalyticsView';
import { QuestionBreakdown, QuestionQuality, StatCard } from '@/components/games/QuizAnalyticsPanels';

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

        <div className="flex justify-center gap-3 pt-2 flex-wrap">
          {data.session?.quiz_id && data.viewer?.is_host ? (
            <Link to={`/games/${data.session.quiz_id}`}>
              <GameActionButton variant="secondary">Quiz details</GameActionButton>
            </Link>
          ) : null}
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

function MiniStat({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}
