// @ts-nocheck
import db from '@/api/apiClient';
import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, BarChart3, Eye, Pencil, Play, Trash2, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { unlockAudio } from '@/lib/gameAudio';
import PageLoader from '@/components/PageLoader';
import { GlassCard } from '@/components/games/GameUi';
import { glassDialogMutedText, glassDialogTitleText } from '@/components/layout/glassStyles';
import { cn } from '@/lib/utils';
import { formatLiveSessionWhen, formatQuizOwnerMeta } from '@/lib/quizAnalyticsFormat';

export default function QuizDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const quizQuery = useQuery({
    queryKey: ['quiz', String(id)],
    queryFn: () => db.quizzes.get(id),
  });

  const historyQuery = useQuery({
    queryKey: ['quiz-history', String(id)],
    queryFn: () => db.quizzes.history(id),
  });

  const startLiveMutation = useMutation({
    mutationFn: () => db.quizzes.startSession(id, { mode: 'live' }),
    onSuccess: async (session) => {
      await unlockAudio();
      navigate(`/games/sessions/${session.id}/host`);
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not start session'),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId) => db.quizSessions.destroy(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-history', String(id)] });
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Live session deleted');
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not delete session'),
  });

  if (quizQuery.isLoading || historyQuery.isLoading) return <PageLoader />;

  if (quizQuery.isError || historyQuery.isError || !quizQuery.data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
        <p className={cn('font-semibold', glassDialogTitleText)}>This quiz is not available.</p>
        <Button asChild variant="outline"><Link to="/games">Back to Games</Link></Button>
      </div>
    );
  }

  const quiz = historyQuery.data?.quiz || quizQuery.data;
  const liveSessions = historyQuery.data?.live_sessions || [];
  const selfPaced = historyQuery.data?.self_paced;
  const meta = formatQuizOwnerMeta(quiz.created_at, quiz.updated_at);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/games"><ArrowLeft className="h-4 w-4 mr-1" /> Games</Link>
        </Button>
      </div>

      <GlassCard className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={cn('text-2xl font-bold', glassDialogTitleText)}>{quiz.title}</h1>
              <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'}>{quiz.status}</Badge>
            </div>
            {meta ? <p className={cn('text-xs', glassDialogMutedText)}>{meta}</p> : null}
            {quiz.description ? <p className={cn('text-sm', glassDialogMutedText)}>{quiz.description}</p> : null}
            <p className={cn('text-xs flex items-center gap-1', glassDialogMutedText)}>
              <Users className="h-3.5 w-3.5" />
              {quiz.question_count ?? quizQuery.data?.questions?.length ?? 0} questions
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => startLiveMutation.mutate()} disabled={startLiveMutation.isPending} className="shadow-md shadow-primary/20">
              <Play className="h-4 w-4 mr-1" />
              Host live
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/games/${id}/preview`}><Eye className="h-4 w-4 mr-1" /> Preview</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/games/${id}/edit`}><Pencil className="h-4 w-4 mr-1" /> Edit</Link>
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className={cn('font-semibold', glassDialogTitleText)}>Live history</h2>
        </div>
        {liveSessions.length === 0 ? (
          <p className={cn('text-sm', glassDialogMutedText)}>No live sessions yet. Host this quiz to start a history.</p>
        ) : (
          <ul className="divide-y divide-border">
            {liveSessions.map((session) => (
              <li key={session.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                <div>
                  <p className={cn('text-sm font-medium', glassDialogTitleText)}>{formatLiveSessionWhen(session.hosted_at)}</p>
                  <p className={cn('text-xs', glassDialogMutedText)}>
                    {session.player_count} player{session.player_count === 1 ? '' : 's'}
                    {session.host_name ? ` · Hosted by ${session.host_name}` : ''}
                    {` · ${session.status}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {session.status === 'finished' ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/games/sessions/${session.id}/analytics`}>
                        <BarChart3 className="h-4 w-4 mr-1" />
                        View analytics
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/games/sessions/${session.id}/host`}>Open host</Link>
                    </Button>
                  )}
                  {session.can_delete !== false ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={deleteSessionMutation.isPending}
                      onClick={() => {
                        if (!window.confirm('Delete this live session and its analytics?')) return;
                        deleteSessionMutation.mutate(session.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {selfPaced ? (
        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className={cn('font-semibold', glassDialogTitleText)}>Self-paced</h2>
            <Button size="sm" asChild>
              <Link to={`/games/${id}/self-paced`}>View analytics</Link>
            </Button>
          </div>
          <p className={cn('text-sm', glassDialogMutedText)}>
            {selfPaced.eligible_count != null
              ? `${selfPaced.completed_count} / ${selfPaced.eligible_count} completed`
              : `${selfPaced.completed_count} completed`}
            {selfPaced.in_progress_count ? ` · ${selfPaced.in_progress_count} in progress` : ''}
          </p>
        </GlassCard>
      ) : (
        <GlassCard>
          <p className={cn('text-sm', glassDialogMutedText)}>
            Publish this quiz to make it available as a one-time self-paced attempt.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
