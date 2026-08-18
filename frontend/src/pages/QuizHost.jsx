// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Play, Eye, Trophy, SkipForward, Square, Music, Music2, VolumeX, Volume2, Copy, Headphones,
} from 'lucide-react';
import { toast } from 'sonner';
import { subscribeQuizSession } from '@/lib/echo';
import {
  unlockAudio, playSfx, syncGameMusic, stopLobby, isMusicMuted, isSfxMuted,
  setMusicMuted, setSfxMuted, setSessionAudio, phaseForSessionStatus,
} from '@/lib/gameAudio';
import {
  fireCelebrateConfetti, fireWinnerConfetti,
} from '@/lib/confettiBurst';
import PageLoader from '@/components/PageLoader';
import {
  GlassCard, AnswerButton, TimerRing, PulsingPin, LobbyPlayerChip, WaitingDots,
  AnswerProgress, QuestionTitle, GameStage, PodiumLeaderboard, GameActionButton,
  GameIconButton, FullscreenButton,
} from '@/components/games/GameUi';
import GameAudioPicker from '@/components/games/GameAudioPicker';
import { cn } from '@/lib/utils';

function stagePhase(status) {
  if (status === 'lobby') return 'lobby';
  if (status === 'question') return 'question';
  if (status === 'reveal') return 'reveal';
  if (status === 'finished') return 'finished';
  return 'leaderboard';
}

export default function QuizHost() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [muteMusic, setMuteMusicLocal] = useState(isMusicMuted());
  const [muteSfx, setMuteSfxLocal] = useState(isSfxMuted());
  const [showAudio, setShowAudio] = useState(false);
  const stageRef = useRef(null);

  const sessionQuery = useQuery({
    queryKey: ['quiz-session', id],
    queryFn: () => db.quizSessions.get(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === 'finished') return false;
      return 2000;
    },
  });

  const session = sessionQuery.data;

  useEffect(() => {
    unlockAudio();
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    setSessionAudio({ bgmTheme: session.bgm_theme, sfxPack: session.sfx_pack });
    const phase = phaseForSessionStatus(session.status);
    unlockAudio().then(() => {
      syncGameMusic(session.music_enabled, session.bgm_theme, phase);
    });
    return () => stopLobby();
  }, [session?.status, session?.music_enabled, session?.bgm_theme, session?.sfx_pack]);

  useEffect(() => {
    if (!id) return undefined;
    return subscribeQuizSession(id, () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-session', id] });
    });
  }, [id, queryClient]);

  const run = useMutation({
    mutationFn: async ({ action, ...args }) => {
      if (action === 'start') return db.quizSessions.start(id);
      if (action === 'reveal') return db.quizSessions.reveal(id);
      if (action === 'leaderboard') return db.quizSessions.leaderboard(id);
      if (action === 'next') return db.quizSessions.next(id);
      if (action === 'end') return db.quizSessions.end(id);
      if (action === 'music') return db.quizSessions.music(id, args);
      throw new Error('Unknown action');
    },
    onSuccess: async (data, vars) => {
      queryClient.setQueryData(['quiz-session', id], data);
      await unlockAudio();
      const phase = phaseForSessionStatus(data?.status);
      if (data?.music_enabled !== false && phase !== 'off') {
        syncGameMusic(true, data.bgm_theme, phase);
      }
      if (vars.action === 'start' || vars.action === 'next') playSfx('question-start');
      if (vars.action === 'reveal') {
        playSfx('correct');
        fireCelebrateConfetti();
      }
      if (vars.action === 'leaderboard') {
        playSfx('leaderboard');
        fireCelebrateConfetti();
      }
      if (vars.action === 'end') {
        playSfx('winner');
        fireWinnerConfetti();
        syncGameMusic(false, data?.bgm_theme, 'off');
      }
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Action failed'),
  });

  const currentQuestion = useMemo(() => {
    if (!session?.current_question_id) return null;
    return session.quiz?.questions?.find((q) => q.id === session.current_question_id) || null;
  }, [session]);

  const joinUrl = useMemo(() => {
    if (!session?.join_token) return '';
    return `${window.location.origin}/quiz-join/${session.join_token}`;
  }, [session?.join_token]);

  const remainingSeconds = useQuestionTimer(session, currentQuestion);

  if (sessionQuery.isLoading) return <PageLoader />;
  if (!session) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Session not found.
        <div className="mt-4">
          <Link to="/games" className="underline">Back</Link>
        </div>
      </div>
    );
  }

  const phase = stagePhase(session.status);

  return (
    <GameStage ref={stageRef} phase={phase}>
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Hosting live</p>
          <h1 className="text-2xl sm:text-3xl font-black text-white drop-shadow">{session.quiz?.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm font-semibold text-white/80">
            <span className="rounded-full bg-white/20 px-3 py-0.5 capitalize">{session.status}</span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {session.player_count}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <GameIconButton
            title={muteMusic ? 'Unmute music' : 'Mute music'}
            onClick={() => {
              const next = !muteMusic;
              setMuteMusicLocal(next);
              setMusicMuted(next);
              if (next) stopLobby();
              else syncGameMusic(session.music_enabled, session.bgm_theme, phaseForSessionStatus(session.status));
            }}
          >
            {muteMusic ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </GameIconButton>
          <GameIconButton
            title={muteSfx ? 'Unmute SFX' : 'Mute SFX'}
            onClick={() => {
              const next = !muteSfx;
              setMuteSfxLocal(next);
              setSfxMuted(next);
            }}
          >
            {muteSfx ? <Music className="h-4 w-4 opacity-40" /> : <Music2 className="h-4 w-4" />}
          </GameIconButton>
          <GameIconButton title="Sound settings" onClick={() => setShowAudio((v) => !v)} active={showAudio}>
            <Headphones className="h-4 w-4" />
          </GameIconButton>
          <FullscreenButton targetRef={stageRef} />
        </div>
      </header>

      <AnimatePresence>
        {showAudio && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <GlassCard variant="stage">
              <div className="flex items-center justify-between mb-3 gap-2">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Session sound</p>
                <GameActionButton
                  variant="ghost"
                  className="!text-violet-800 !bg-violet-100 !shadow-none !border-0 py-2 px-3 text-xs dark:!text-violet-200 dark:!bg-violet-500/20"
                  onClick={() => run.mutate({ action: 'music', enabled: !session.music_enabled })}
                >
                  BGM {session.music_enabled ? 'On' : 'Off'}
                </GameActionButton>
              </div>
              <GameAudioPicker
                compact
                surface="stage"
                bgmTheme={session.bgm_theme || 'party'}
                sfxPack={session.sfx_pack || 'soft'}
                onBgmChange={(bgm_theme) => run.mutate({ action: 'music', bgm_theme })}
                onSfxChange={(sfx_pack) => run.mutate({ action: 'music', sfx_pack })}
              />
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {session.status === 'lobby' && (
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5">
          <div className="rounded-3xl bg-black/20 border border-white/15 backdrop-blur-md p-6 sm:p-8 text-center space-y-6">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/70">Players join with</p>
            <div className="flex justify-center">
              <PulsingPin pin={session.pin} />
            </div>
            {joinUrl && (
              <div className="flex justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl bg-white dark:bg-slate-100 p-3 shadow-xl"
                >
                  <QRCodeSVG value={joinUrl} size={148} />
                </motion.div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <GameActionButton
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(joinUrl || session.pin);
                  toast.success('Copied join link');
                }}
              >
                <Copy className="h-4 w-4" />
                Copy link
              </GameActionButton>
              <GameActionButton
                disabled={session.player_count < 1 || run.isPending}
                onClick={() => run.mutate({ action: 'start' })}
                className="sm:min-w-[180px]"
              >
                <Play className="h-5 w-5" />
                Start!
              </GameActionButton>
            </div>
            {session.quiz_id && (
              <Link
                to={`/games/${session.quiz_id}/preview`}
                target="_blank"
                className="inline-flex items-center gap-1 text-sm font-semibold text-white/70 hover:text-white"
              >
                <Eye className="h-4 w-4" />
                Solo preview
              </Link>
            )}
          </div>

          <div className="rounded-3xl bg-black/20 border border-white/15 backdrop-blur-md p-5 sm:p-6 flex flex-col min-h-[340px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-white">Lobby</h2>
              <motion.span
                key={session.players?.length || 0}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                className="rounded-full bg-[#FF8B2D] text-white px-3 py-1 text-sm font-black tabular-nums shadow-lg"
              >
                {session.players?.length || 0}
              </motion.span>
            </div>
            {(session.players?.length || 0) === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
                <WaitingDots label="Waiting for players" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 content-start max-h-[420px] overflow-auto pr-1">
                <AnimatePresence mode="popLayout">
                  {(session.players || []).map((p, i) => (
                    <LobbyPlayerChip key={p.user_id} name={p.display_name} index={i} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}

      {session.status === 'question' && currentQuestion && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TimerRing seconds={remainingSeconds} total={currentQuestion.time_limit_seconds || 20} />
            <div className="flex-1 min-w-[160px] max-w-xs ml-auto">
              <AnswerProgress answered={session.answer_count} total={session.player_count} />
            </div>
          </div>
          <QuestionTitle key={currentQuestion.id}>{currentQuestion.prompt}</QuestionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            {(currentQuestion.options || []).map((opt, i) => (
              <AnswerButton key={opt.id} index={i} label={opt.label} disabled delay={i * 0.06} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <GameActionButton onClick={() => run.mutate({ action: 'reveal' })} disabled={run.isPending}>
              <Eye className="h-4 w-4" />
              Reveal
            </GameActionButton>
            <GameActionButton variant="secondary" onClick={() => run.mutate({ action: 'leaderboard' })} disabled={run.isPending}>
              <Trophy className="h-4 w-4" />
              Scores
            </GameActionButton>
          </div>
        </div>
      )}

      {(session.status === 'reveal' || session.status === 'leaderboard' || session.status === 'finished') && (
        <div className="space-y-6">
          {session.status === 'reveal' && currentQuestion && (
            <>
              <QuestionTitle>{currentQuestion.prompt}</QuestionTitle>
              <div className="grid sm:grid-cols-2 gap-3">
                {(currentQuestion.options || []).map((opt, i) => (
                  <AnswerButton
                    key={opt.id}
                    index={i}
                    label={opt.label}
                    revealed
                    isCorrect={opt.is_correct}
                    disabled
                    delay={i * 0.05}
                  />
                ))}
              </div>
            </>
          )}

          {(session.status === 'leaderboard' || session.status === 'finished') && (
            <PodiumLeaderboard
              players={session.players || []}
              title={session.status === 'finished' ? 'Final scores!' : 'Leaderboard'}
            />
          )}

          {session.status === 'reveal' && (
            <div className="rounded-2xl bg-black/20 border border-white/15 p-3">
              <p className="text-center text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Quick peek</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {(session.players || []).slice(0, 5).map((p, i) => (
                  <span key={p.user_id} className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                    #{i + 1} {p.display_name} · {p.score}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            {session.status !== 'finished' && (
              <>
                {session.status === 'reveal' && (
                  <GameActionButton variant="secondary" onClick={() => run.mutate({ action: 'leaderboard' })} disabled={run.isPending}>
                    <Trophy className="h-4 w-4" />
                    Show podium
                  </GameActionButton>
                )}
                <GameActionButton onClick={() => run.mutate({ action: 'next' })} disabled={run.isPending}>
                  <SkipForward className="h-4 w-4" />
                  Next
                </GameActionButton>
                <GameActionButton variant="danger" onClick={() => run.mutate({ action: 'end' })} disabled={run.isPending}>
                  <Square className="h-4 w-4" />
                  End
                </GameActionButton>
              </>
            )}
            {session.status === 'finished' && (
              <Link to="/games">
                <GameActionButton variant="secondary">Back to Games</GameActionButton>
              </Link>
            )}
          </div>
        </div>
      )}
    </GameStage>
  );
}

function useQuestionTimer(session, question) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!session?.question_started_at || !question || session.status !== 'question') {
      setRemaining(0);
      return undefined;
    }

    const tick = () => {
      const started = new Date(session.question_started_at).getTime();
      const limit = (question.time_limit_seconds || 20) * 1000;
      const left = Math.max(0, Math.ceil((started + limit - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0 && left <= 5) playSfx('timer-tick');
    };

    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [session?.question_started_at, session?.status, question?.id, question?.time_limit_seconds]);

  return remaining;
}
