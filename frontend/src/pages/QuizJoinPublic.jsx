// @ts-nocheck
import db from '@/api/apiClient';
import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import PageLoader from '@/components/PageLoader';
import { unlockAudio } from '@/lib/gameAudio';
import { toast } from 'sonner';

export default function QuizJoinPublic() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth, user, appPublicSettings } = useAuth();
  const appName = appPublicSettings?.system_name || 'EMZI Nexus';

  const metaQuery = useQuery({
    queryKey: ['quiz-join', token],
    queryFn: () => db.quizSessions.showByToken(token),
    enabled: Boolean(token),
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const pin = metaQuery.data?.pin;
      if (!pin) throw new Error('PIN unavailable');
      return db.quizSessions.join(pin);
    },
    onSuccess: async (session) => {
      await unlockAudio();
      navigate(`/games/play/${session.id}`);
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Could not join'),
  });

  if (isLoadingAuth || metaQuery.isLoading) return <PageLoader />;

  const meta = metaQuery.data;
  const error = metaQuery.isError;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Link to="/" className="font-semibold text-sm">{appName}</Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-4 text-center">
          <Gamepad2 className="h-10 w-10 mx-auto text-primary" />
          {error || !meta ? (
            <>
              <h1 className="text-xl font-bold">Game not found</h1>
              <p className="text-sm text-muted-foreground">This join link is invalid or the session has ended.</p>
              <Button asChild><Link to="/games">Go to Games</Link></Button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">{meta.quiz_title}</h1>
              <p className="text-sm text-muted-foreground">
                Hosted by {meta.host_name || 'someone'} · {meta.player_count} players
              </p>
              {meta.pin && (
                <p className="text-3xl font-black tracking-[0.2em] py-2">{meta.pin}</p>
              )}
              {!isAuthenticated || !user?.is_approved ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Sign in with your Nexus account to join.</p>
                  <Button asChild className="w-full">
                    <Link to={`/login?redirect=${encodeURIComponent(`/quiz-join/${token}`)}`}>Sign in</Link>
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  disabled={joinMutation.isPending}
                  onClick={() => joinMutation.mutate()}
                >
                  {joinMutation.isPending ? 'Joining…' : 'Join game'}
                </Button>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
