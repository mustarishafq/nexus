// @ts-nocheck
import db from '@/api/apiClient';
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, ChevronDown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageLoader from '@/components/PageLoader';
import QuizAvatar from '@/components/games/QuizAvatar';
import { GameStage, GameActionButton } from '@/components/games/GameUi';
import { QuestionBreakdown, QuestionQuality, StatCard } from '@/components/games/QuizAnalyticsPanels';
import { cn } from '@/lib/utils';
import {
  formatAccuracy,
  formatQuizCreatedAt,
  formatResponseMs,
  formatScore,
} from '@/lib/quizAnalyticsFormat';
import { hostTableCells } from '@/lib/quizAnalyticsView';

export default function QuizSelfPacedAnalytics() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState(null);
  const query = useQuery({
    queryKey: ['quiz-self-paced-analytics', String(id)],
    queryFn: () => db.quizzes.selfPacedAnalytics(id),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId) => db.quizSessions.destroy(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-self-paced-analytics', String(id)] });
      queryClient.invalidateQueries({ queryKey: ['quiz-history', String(id)] });
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Self-paced attempt deleted');
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not delete attempt'),
  });

  const confirmDeleteAttempt = (sessionId) => {
    if (!window.confirm('Delete this self-paced attempt? The player will be able to try again.')) return;
    deleteSessionMutation.mutate(sessionId);
  };

  if (query.isLoading) return <PageLoader />;

  if (query.isError || !query.data) {
    return (
      <GameStage phase="finished">
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <p className="text-white font-black text-xl">Self-paced analytics aren&apos;t available yet.</p>
          <p className="text-white/70 font-semibold">Finish at least one attempt, then try again.</p>
          <Link to="/games"><GameActionButton variant="secondary">Back to Games</GameActionButton></Link>
        </div>
      </GameStage>
    );
  }

  const data = query.data;
  const summary = data.summary || {};
  const participants = data.participants || [];
  const inProgress = data.in_progress || [];
  const completedLabel = summary.eligible_count != null
    ? `${summary.completed_count ?? 0} / ${summary.eligible_count}`
    : String(summary.completed_count ?? 0);

  return (
    <GameStage phase="finished">
      <div className="max-w-5xl mx-auto space-y-6 pb-8">
        <header className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">{data.quiz?.title}</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white drop-shadow">Self-paced report</h1>
          <p className="text-sm font-semibold text-white/70">
            Individual ranking is visible to you only. Players see their own results.
          </p>
        </header>

        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard
              label="Completed"
              value={completedLabel}
              hint={summary.in_progress_count ? `${summary.in_progress_count} in progress` : null}
            />
            <StatCard label="Questions" value={data.quiz?.question_count ?? 0} />
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
                  {participants.map((p) => {
                    const cells = hostTableCells(p);
                    const open = openId === p.session_id;
                    return (
                      <React.Fragment key={p.session_id}>
                        <tr
                          className="border-t border-white/10 text-white hover:bg-white/5 cursor-pointer"
                          onClick={() => setOpenId(open ? null : p.session_id)}
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
                              {p.rank ? <span className="text-white/50">#{p.rank}</span> : null}
                              {cells.name}
                              <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')} />
                              <button
                                type="button"
                                title="Delete attempt"
                                className="ml-1 rounded-full p-1 text-white/50 hover:bg-[#E21B3C] hover:text-white"
                                disabled={deleteSessionMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmDeleteAttempt(p.session_id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
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
                            <td colSpan={9} className="px-3 py-4 space-y-4">
                              <p className="text-sm font-semibold text-white/80">
                                Completed {formatQuizCreatedAt(p.completed_at) || '—'}
                              </p>
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
            {participants.length === 0 ? (
              <p className="px-4 py-8 text-center text-white/60 font-semibold">No one has completed this quiz yet.</p>
            ) : null}
          </div>

          {inProgress.length > 0 ? (
            <div className="rounded-3xl bg-black/25 border border-white/15 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-sm font-black text-white">In progress</p>
              </div>
              <ul className="divide-y divide-white/10">
                {inProgress.map((row) => (
                  <li key={row.session_id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between text-white">
                    <div>
                      <p className="text-sm font-black">{row.display_name}</p>
                      <p className="text-xs font-semibold text-white/60">
                        Started {formatQuizCreatedAt(row.started_at) || '—'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#E21B3C] self-start sm:self-auto"
                      disabled={deleteSessionMutation.isPending}
                      onClick={() => confirmDeleteAttempt(row.session_id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex justify-center gap-3 pt-2 flex-wrap">
          <Link to={`/games/${id}`}>
            <GameActionButton variant="secondary">Quiz details</GameActionButton>
          </Link>
          <Link to="/games">
            <GameActionButton variant="secondary">Back to Games</GameActionButton>
          </Link>
        </div>
      </div>
    </GameStage>
  );
}
