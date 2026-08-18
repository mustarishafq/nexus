// @ts-nocheck
import db from '@/api/apiClient';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Gamepad2, Plus, Play, Pencil, Trash2, Users, BookOpen, Hash, Sparkles, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { unlockAudio } from '@/lib/gameAudio';
import PageLoader from '@/components/PageLoader';
import { GlassCard } from '@/components/games/GameUi';
import { glassDialogMutedText, glassDialogTitleText } from '@/components/layout/glassStyles';
import { cn } from '@/lib/utils';

export default function Games() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState('mine');

  const mineQuery = useQuery({
    queryKey: ['quizzes', 'mine'],
    queryFn: () => db.quizzes.list({ scope: 'mine' }),
  });

  const publishedQuery = useQuery({
    queryKey: ['quizzes', 'published'],
    queryFn: () => db.quizzes.list({ scope: 'published' }),
    enabled: tab === 'published',
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.quizzes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Quiz deleted');
    },
    onError: (err) => toast.error(err.message || 'Failed to delete'),
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

  const joinMutation = useMutation({
    mutationFn: (joinPin) => db.quizSessions.join(joinPin),
    onSuccess: async (session) => {
      await unlockAudio();
      navigate(`/games/play/${session.id}`);
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not join'),
  });

  const quizzes = tab === 'mine' ? (mineQuery.data || []) : (publishedQuery.data || []);
  const loading = tab === 'mine' ? mineQuery.isLoading : publishedQuery.isLoading;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className={cn('text-2xl font-bold tracking-tight flex items-center gap-2', glassDialogTitleText)}>
            <Gamepad2 className="h-6 w-6 text-primary" />
            Games
          </h1>
          <p className={cn('mt-1 text-sm', glassDialogMutedText)}>
            Host live quizzes, preview solo, or join with a PIN.
          </p>
        </div>
        <Button asChild className="shadow-md shadow-primary/20">
          <Link to="/games/new">
            <Plus className="h-4 w-4 mr-2" />
            New quiz
          </Link>
        </Button>
      </div>

      <GlassCard>
        <div className={cn('flex items-center gap-2 text-sm font-medium mb-3', glassDialogTitleText)}>
          <Hash className="h-4 w-4 text-primary" />
          Join a live game
        </div>
        <form
          className="flex flex-col sm:flex-row gap-3"
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
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="Game PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="sm:max-w-[180px] text-center text-lg tracking-[0.25em] font-semibold h-11"
          />
          <Button type="submit" disabled={joinMutation.isPending} className="h-11 shadow-md shadow-primary/20">
            {joinMutation.isPending ? 'Joining…' : 'Join'}
          </Button>
        </form>
      </GlassCard>

      <div className="flex gap-2 border-b border-border">
        {[
          { id: 'mine', label: 'My quizzes', icon: BookOpen },
          { id: 'published', label: 'Play published', icon: Sparkles },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors',
              tab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : quizzes.length === 0 ? (
        <GlassCard className="text-center py-12">
          <p className={glassDialogMutedText}>
            {tab === 'mine' ? 'No quizzes yet. Create one to host a live game.' : 'No published quizzes available.'}
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
              <GlassCard className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className={cn('font-semibold truncate', glassDialogTitleText)}>{quiz.title}</h2>
                    <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'}>
                      {quiz.status}
                    </Badge>
                  </div>
                  {quiz.description && (
                    <p className={cn('text-sm mt-1 line-clamp-2', glassDialogMutedText)}>{quiz.description}</p>
                  )}
                  <p className={cn('text-xs mt-2 flex items-center gap-1', glassDialogMutedText)}>
                    <Users className="h-3.5 w-3.5" />
                    {quiz.questions_count ?? quiz.questions?.length ?? 0} questions
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {tab === 'mine' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => startLiveMutation.mutate(quiz.id)}
                        disabled={startLiveMutation.isPending}
                        className="shadow-md shadow-primary/20"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Host live
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/games/${quiz.id}/preview`}>
                          <Eye className="h-4 w-4 mr-1" />
                          Preview / Test
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/games/${quiz.id}/edit`}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (window.confirm('Delete this quiz?')) deleteMutation.mutate(quiz.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {tab === 'published' && (
                    <Button
                      size="sm"
                      onClick={() => startAsyncMutation.mutate(quiz.id)}
                      disabled={startAsyncMutation.isPending}
                      className="shadow-md shadow-primary/20"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Play now
                    </Button>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
