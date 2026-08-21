// @ts-nocheck
import db from '@/api/apiClient';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Gamepad2, Plus, Play, Pencil, Trash2, Users, BookOpen, Hash, Sparkles, Eye, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { unlockAudio } from '@/lib/gameAudio';
import PageLoader from '@/components/PageLoader';
import { GlassCard } from '@/components/games/GameUi';
import { glassDialogMutedText, glassDialogTitleText } from '@/components/layout/glassStyles';
import { useAuth } from '@/lib/AuthContext';
import { can } from '@/lib/roles';
import QuizAccessoryPicker from '@/components/games/QuizAccessoryPicker';
import { getDisplayName } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { formatQuizOwnerMeta, formatSelfPacedDeadline, isSelfPacedDeadlinePassed } from '@/lib/quizAnalyticsFormat';

function joinErrorMessage(err) {
  const first = err?.data?.errors ? Object.values(err.data.errors).flat().find(Boolean) : null;
  return first || err?.data?.message || err.message || 'Could not join';
}

export default function Games() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, updateAuthUser } = useAuth();
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState('mine');
  const [accessorySaving, setAccessorySaving] = useState(false);
  const showMyQuizzes = can(user, 'quiz.create');
  const activeTab = showMyQuizzes ? tab : 'published';

  const mineQuery = useQuery({
    queryKey: ['quizzes', 'mine'],
    queryFn: () => db.quizzes.list({ scope: 'mine' }),
    enabled: showMyQuizzes,
  });

  const publishedQuery = useQuery({
    queryKey: ['quizzes', 'published'],
    queryFn: () => db.quizzes.list({ scope: 'published' }),
    enabled: !showMyQuizzes || tab === 'published',
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.quizzes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Quiz deleted');
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Failed to delete'),
  });

  const startLiveMutation = useMutation({
    mutationFn: (id) => db.quizzes.startSession(id, { mode: 'live' }),
    onSuccess: async (session) => {
      await unlockAudio();
      navigate(`/games/sessions/${session.id}/host`);
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not start session'),
  });

  const startAsyncMutation = useMutation({
    mutationFn: (id) => db.quizzes.startSession(id, { mode: 'async' }),
    onSuccess: async (session) => {
      await unlockAudio();
      navigate(`/games/play/${session.id}?async=1`);
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not start attempt'),
  });

  const startPreviewMutation = useMutation({
    mutationFn: (id) => db.quizzes.startSession(id, { mode: 'async', preview: true }),
    onSuccess: async (session) => {
      await unlockAudio();
      navigate(`/games/play/${session.id}?async=1&preview=1`);
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not start preview'),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id) => db.quizzes.update(id, { status: 'draft' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Quiz unpublished');
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not unpublish'),
  });

  const joinMutation = useMutation({
    mutationFn: (joinPin) => db.quizSessions.join(joinPin),
    onSuccess: async (session) => {
      await unlockAudio();
      navigate(`/games/play/${session.id}`);
    },
    onError: (err) => toast.error(joinErrorMessage(err)),
  });

  const quizzes = activeTab === 'mine' ? (mineQuery.data || []) : (publishedQuery.data || []);
  const loading = activeTab === 'mine' ? mineQuery.isLoading : publishedQuery.isLoading;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className={cn('text-2xl font-bold tracking-tight flex items-center gap-2', glassDialogTitleText)}>
            <Gamepad2 className="h-6 w-6 text-primary" />
            Games
          </h1>
          <p className={cn('mt-1 text-sm', glassDialogMutedText)}>
            Join a live game, set your look, then host or play at your own pace.
          </p>
        </div>
        {can(user, 'quiz.create') ? (
          <Button asChild className="shadow-md shadow-primary/20">
            <Link to="/games/new">
              <Plus className="h-4 w-4 mr-2" />
              New quiz
            </Link>
          </Button>
        ) : null}
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="grid md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] md:divide-x divide-y md:divide-y-0 divide-border">
          <form
            className="p-4 sm:p-5 min-h-[220px] h-full flex flex-col items-center justify-center text-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const cleaned = pin.replace(/\D/g, '').slice(0, 6);
              if (cleaned.length !== 6) {
                toast.error('Enter a 6-digit PIN');
                return;
              }
              joinMutation.mutate(cleaned);
            }}
          >
            <div className={cn('flex items-center justify-center gap-2 text-2xl sm:text-3xl font-bold tracking-tight', glassDialogTitleText)}>
              <Hash className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              Join live
            </div>
            <p className={cn('text-xs', glassDialogMutedText)}>
              Enter the 6-digit PIN from the host screen.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center w-full">
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full sm:w-56 text-center text-2xl tracking-[0.35em] font-bold h-14"
              />
              <Button type="submit" disabled={joinMutation.isPending} className="h-14 px-6 shadow-md shadow-primary/20">
                {joinMutation.isPending ? 'Joining…' : 'Join'}
              </Button>
            </div>
          </form>

          <div className="p-4 sm:p-5">
            <QuizAccessoryPicker
              profileImage={user?.profile_picture}
              profileImageCrop={user?.profile_picture_crop}
              name={getDisplayName(user, '')}
              accessoryId={user?.quiz_accessory_id}
              disabled={accessorySaving}
              compact
              onSelect={async (id) => {
                setAccessorySaving(true);
                try {
                  const updated = await db.auth.updateMe({ quiz_accessory_id: id });
                  updateAuthUser(updated);
                  toast.success('Quiz look saved');
                } catch (err) {
                  toast.error(err?.message || 'Could not save accessory');
                } finally {
                  setAccessorySaving(false);
                }
              }}
            />
          </div>
        </div>
      </GlassCard>

      {showMyQuizzes ? (
        <div className="flex gap-2 border-b border-border">
          {[
            { id: 'mine', label: 'My quizzes', icon: BookOpen },
            { id: 'published', label: 'Published', icon: Sparkles },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors',
                activeTab === id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className={cn('flex items-center gap-2 text-sm font-medium', glassDialogTitleText)}>
          <Sparkles className="h-4 w-4 text-primary" />
          Published
        </div>
      )}

      {loading ? (
        <PageLoader />
      ) : quizzes.length === 0 ? (
        <GlassCard className="text-center py-12">
          <p className={glassDialogMutedText}>
            {activeTab === 'mine' ? 'No quizzes yet. Create one to host a live game.' : 'No published quizzes available.'}
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-3">
          {quizzes.map((quiz, i) => (
            <motion.div
              key={quiz.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              {activeTab === 'mine' ? (
                <OwnerQuizCard
                  quiz={quiz}
                  startLivePending={startLiveMutation.isPending}
                  onHost={() => startLiveMutation.mutate(quiz.id)}
                  onDelete={() => {
                    if (window.confirm('Delete this quiz?')) deleteMutation.mutate(quiz.id);
                  }}
                />
              ) : (
                <PublishedQuizCard
                  quiz={quiz}
                  pending={startAsyncMutation.isPending}
                  previewPending={startPreviewMutation.isPending}
                  unpublishPending={unpublishMutation.isPending}
                  isCreator={Number(quiz.user_id) === Number(user?.id) || Number(quiz.owner?.id) === Number(user?.id)}
                  canDelete={can(user, 'quiz.manage')}
                  onPlay={() => startAsyncMutation.mutate(quiz.id)}
                  onPreview={() => startPreviewMutation.mutate(quiz.id)}
                  onUnpublish={() => {
                    if (window.confirm('Unpublish this quiz? It will leave Published and stay in My quizzes.')) {
                      unpublishMutation.mutate(quiz.id);
                    }
                  }}
                  onDelete={() => {
                    if (window.confirm('Delete this quiz? This cannot be undone.')) {
                      deleteMutation.mutate(quiz.id);
                    }
                  }}
                />
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function OwnerQuizCard({ quiz, startLivePending, onHost, onDelete }) {
  const meta = formatQuizOwnerMeta(quiz.created_at, quiz.updated_at);
  const selfPaced = quiz.self_paced;

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn('font-semibold truncate', glassDialogTitleText)}>{quiz.title}</h2>
            <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'}>
              {quiz.status}
            </Badge>
          </div>
          {meta ? <p className={cn('text-xs', glassDialogMutedText)}>{meta}</p> : null}
          {quiz.description ? (
            <p className={cn('text-sm line-clamp-2', glassDialogMutedText)}>{quiz.description}</p>
          ) : null}
          <p className={cn('text-xs flex items-center gap-1', glassDialogMutedText)}>
            <Users className="h-3.5 w-3.5" />
            {quiz.questions_count ?? quiz.questions?.length ?? 0} questions
            {selfPaced ? ` · ${selfPaced.completed_count} self-paced completed` : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button size="sm" onClick={onHost} disabled={startLivePending} className="shadow-md shadow-primary/20">
            <Play className="h-4 w-4 mr-1" />
            Host live
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/games/${quiz.id}`}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Details
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/games/${quiz.id}/preview`}>
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/games/${quiz.id}/edit`}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Link>
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

function PublishedQuizCard({ quiz, pending, previewPending, unpublishPending, isCreator, canDelete, onPlay, onPreview, onUnpublish, onDelete }) {
  const attempt = quiz.viewer_attempt;
  const completed = attempt?.status === 'completed';
  const inProgress = attempt?.status === 'in_progress';
  const deadlineLabel = formatSelfPacedDeadline(quiz.async_deadline_at);
  const deadlinePassed = isSelfPacedDeadlinePassed(quiz.async_deadline_at);

  return (
    <GlassCard className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className={cn('font-semibold truncate', glassDialogTitleText)}>{quiz.title}</h2>
          {isCreator ? <Badge variant="secondary">Your quiz</Badge> : null}
          {!isCreator && completed ? <Badge variant="secondary">Completed</Badge> : null}
          {!isCreator && inProgress ? <Badge>In progress</Badge> : null}
        </div>
        {isCreator ? (
          <p className={cn('text-xs mt-1', glassDialogMutedText)}>
            Preview plays like self-paced, including power-ups. It does not save a result.
          </p>
        ) : null}
        {quiz.description ? (
          <p className={cn('text-sm mt-1 line-clamp-2', glassDialogMutedText)}>{quiz.description}</p>
        ) : null}
        <p className={cn('text-xs mt-2 flex items-center gap-1', glassDialogMutedText)}>
          <Users className="h-3.5 w-3.5" />
          {quiz.questions_count ?? quiz.questions?.length ?? 0} questions
        </p>
        {deadlineLabel ? (
          <p className={cn('text-xs mt-1', glassDialogMutedText)}>
            {deadlinePassed ? 'Deadline passed' : `Deadline ${deadlineLabel}`}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {isCreator ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={previewPending}
              onClick={onPreview}
            >
              <Eye className="h-4 w-4 mr-1" />
              {previewPending ? 'Starting…' : 'Preview'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={unpublishPending}
              onClick={onUnpublish}
            >
              Unpublish
            </Button>
          </>
        ) : completed ? (
          <Button size="sm" variant="outline" asChild>
            <Link to={`/games/sessions/${attempt.session_id}/analytics`}>View results</Link>
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onPlay}
            disabled={pending || deadlinePassed}
            className="shadow-md shadow-primary/20"
          >
            <Play className="h-4 w-4 mr-1" />
            {deadlinePassed ? 'Deadline passed' : (inProgress ? 'Continue' : 'Play now')}
          </Button>
        )}
        {canDelete ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:bg-red-500/15 hover:text-red-400 dark:text-red-400 dark:hover:bg-red-400/15 dark:hover:text-red-300"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        ) : null}
      </div>
    </GlassCard>
  );
}
