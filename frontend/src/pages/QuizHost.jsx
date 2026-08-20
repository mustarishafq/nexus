// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Play, Eye, Trophy, SkipForward, Square, Music, Music2, VolumeX, Volume2, Copy, Headphones, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { subscribeQuizSession } from '@/lib/echo';
import {
  unlockAudio, playSfxOnce, emitTimerTick, syncGameMusic, stopLobby, isMusicMuted, isSfxMuted,
  setMusicMuted, setSfxMuted, setSessionAudio, phaseForSessionStatus, armUnlockOnGesture,
  resetAudioGates,
} from '@/lib/gameAudio';
import {
  fireCelebrateConfetti,
} from '@/lib/confettiBurst';
import PageLoader from '@/components/PageLoader';
import {
  GlassCard, AnswerButton, TimerRing, PulsingPin, LobbyPlayerChip, WaitingDots,
  AnswerProgress, QuestionTitle, QuestionMedia, GameStage, PodiumLeaderboard, GameActionButton,
  GameIconButton, FullscreenButton, AnswerDistributionChart, HostTopRanking, QuestionCountdown,
} from '@/components/games/GameUi';
import GameAudioPicker from '@/components/games/GameAudioPicker';
import { answerGridClass, isTrueFalseQuestion } from '@/lib/quizQuestion';
import {
  questionTimerState, quizCountdownLabel, quizCountdownRemainingMs,
} from '@/lib/quizCountdown';

function stagePhase(status) {
  if (status === 'lobby') return 'lobby';
  if (status === 'question') return 'question';
  if (status === 'reveal') return 'reveal';
  if (status === 'finished') return 'finished';
  return 'leaderboard';
}

export default function QuizHost() {
  const { id } = useParams();
  const navigate = useNavigate();
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
    armUnlockOnGesture();
    resetAudioGates();
    return () => {
      stopLobby();
      resetAudioGates();
    };
  }, [id]);

  useEffect(() => {
    if (!session) return;
    setSessionAudio({ bgmTheme: session.bgm_theme });
    syncGameMusic(session.music_enabled, session.bgm_theme, phaseForSessionStatus(session.status));
  }, [session?.status, session?.music_enabled, session?.bgm_theme]);

  useEffect(() => {
    if (!id) return undefined;
    return subscribeQuizSession(id, () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-session', id] });
    });
  }, [id, queryClient]);

  useEffect(() => {
    if (!id || !session || session.status === 'finished' || !session.is_host) return undefined;
    const intervalSeconds = Math.max(3, Number(session.heartbeat_interval_seconds) || 5);
    const beat = () => {
      db.quizSessions.heartbeat(id)
        .then((data) => queryClient.setQueryData(['quiz-session', id], data))
        .catch(() => {});
    };
    beat();
    const timerId = setInterval(beat, intervalSeconds * 1000);
    return () => clearInterval(timerId);
  }, [id, session?.status, session?.is_host, session?.heartbeat_interval_seconds, queryClient]);

  const run = useMutation({
    mutationFn: async ({ action, fromTimeout, ...args }) => {
      void fromTimeout;
      if (action === 'start') return db.quizSessions.start(id);
      if (action === 'reveal') return db.quizSessions.reveal(id);
      if (action === 'leaderboard') return db.quizSessions.leaderboard(id);
      if (action === 'next') return db.quizSessions.next(id);
      if (action === 'end') return db.quizSessions.end(id);
      if (action === 'music') return db.quizSessions.music(id, args);
      throw new Error('Unknown action');
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(['quiz-session', id], data);
      const qid = data?.current_question_id;
      if (vars.action === 'start') {
        playSfxOnce('game-start', 'game-start');
        playSfxOnce(`q:${qid}:start`, 'question-start');
      }
      if (vars.action === 'next') playSfxOnce(`q:${qid}:start`, 'question-start');
      if (vars.action === 'reveal') {
        playSfxOnce(`q:${qid}:${vars.fromTimeout ? 'timeout' : 'reveal'}`, vars.fromTimeout ? 'timeout' : 'reveal');
        fireCelebrateConfetti();
      }
      if (vars.action === 'leaderboard') {
        playSfxOnce(`q:${qid}:board`, 'leaderboard');
        fireCelebrateConfetti();
      }
      if (vars.action === 'end') {
        toast.success('Live game ended');
        navigate('/games', { replace: true });
      }
    },
    onError: (err) => toast.error(err.message || err?.data?.message || 'Action failed'),
  });

  const act = (vars) => {
    void unlockAudio();
    run.mutate(vars);
  };

  useEffect(() => {
    if (!session) return undefined;
    const locked = ['question', 'reveal', 'leaderboard'].includes(session.status);
    if (!locked) return undefined;
    const onLeave = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [session?.status]);

  const currentQuestion = useMemo(() => {
    if (!session?.current_question_id) return null;
    return session.quiz?.questions?.find((q) => Number(q.id) === Number(session.current_question_id)) || null;
  }, [session]);

  const joinUrl = useMemo(() => {
    if (!session?.join_token) return '';
    return `${window.location.origin}/quiz-join/${session.join_token}`;
  }, [session?.join_token]);

  const { remaining: remainingSeconds, timedOut } = useQuestionTimer(session, currentQuestion);
  const { remaining: phaseSeconds } = usePhaseTimer(session);
  const autoRevealedFor = useRef(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (session?.status !== 'question' || session?.paused) return undefined;
    if (quizCountdownRemainingMs(session) <= 0) return undefined;
    const timerId = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timerId);
  }, [session?.status, session?.question_started_at, session?.answering_open, session?.paused]);

  const countdownLabel = quizCountdownLabel(quizCountdownRemainingMs(session, now));

  useEffect(() => {
    if (!countdownLabel || countdownLabel === 'GO!') return;
    playSfxOnce(`countdown:${id}:${countdownLabel}`, 'timer-tick');
  }, [countdownLabel, id]);

  useEffect(() => {
    if (session?.paused || session?.status !== 'question' || !timedOut || !session.current_question_id) return;
    if (autoRevealedFor.current === session.current_question_id || run.isPending) return;
    autoRevealedFor.current = session.current_question_id;
    run.mutate({ action: 'reveal', fromTimeout: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate once per question timeout
  }, [timedOut, session?.status, session?.current_question_id, session?.paused]);

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
              void unlockAudio();
              const next = !muteMusic;
              setMuteMusicLocal(next);
              setMusicMuted(next);
            }}
          >
            {muteMusic ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </GameIconButton>
          <GameIconButton
            title={muteSfx ? 'Unmute SFX' : 'Mute SFX'}
            onClick={() => {
              void unlockAudio();
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

      {session.paused && session.status !== 'lobby' && (
        <div className="mb-5 rounded-2xl border border-amber-300/40 bg-amber-400/20 px-4 py-3 text-center text-sm font-bold text-white">
          Game paused — waiting for the host connection to recover.
        </div>
      )}

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
                  onClick={() => act({ action: 'music', enabled: !session.music_enabled })}
                >
                  BGM {session.music_enabled ? 'On' : 'Off'}
                </GameActionButton>
              </div>
              <GameAudioPicker
                compact
                surface="stage"
                bgmTheme={session.bgm_theme || 'party'}
                sfxOn={!muteSfx}
                onBgmChange={(bgm_theme) => {
                  void unlockAudio();
                  run.mutate({ action: 'music', bgm_theme });
                }}
                onSfxEnabledChange={(enabled) => setMuteSfxLocal(!enabled)}
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
                onClick={() => {
                  void unlockAudio();
                  run.mutate({ action: 'start' });
                }}
                className="sm:min-w-[180px]"
              >
                <Play className="h-5 w-5" />
                Start!
              </GameActionButton>
              <GameActionButton
                variant="danger"
                disabled={run.isPending}
                onClick={() => act({ action: 'end' })}
              >
                <Square className="h-4 w-4" />
                End live
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
                    <LobbyPlayerChip
                      key={p.user_id}
                      name={p.display_name}
                      index={i}
                      profilePicture={p.profile_picture}
                      profilePictureCrop={p.profile_picture_crop}
                      accessoryId={p.accessory_id}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}

      {session.status === 'question' && currentQuestion && (
        <div className="relative space-y-5 min-h-[240px]">
          <QuestionCountdown label={countdownLabel} />
          {!countdownLabel && (
          <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TimerRing seconds={remainingSeconds} total={currentQuestion.time_limit_seconds || 20} />
            <div className="flex-1 min-w-[160px] max-w-xs ml-auto">
              <AnswerProgress answered={session.answer_count} total={session.player_count} />
            </div>
          </div>
          <QuestionTitle key={currentQuestion.id}>{currentQuestion.prompt}</QuestionTitle>
          <QuestionMedia src={currentQuestion.image_url} />
          <div className={isTrueFalseQuestion(currentQuestion) ? answerGridClass(currentQuestion) : 'grid sm:grid-cols-2 gap-3'}>
            {(currentQuestion.options || []).map((opt, i) => (
              <AnswerButton
                key={opt.id}
                index={i}
                label={opt.label}
                large={isTrueFalseQuestion(currentQuestion)}
                disabled
                delay={i * 0.06}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <GameActionButton onClick={() => act({ action: 'reveal' })} disabled={run.isPending}>
              <Eye className="h-4 w-4" />
              Reveal
            </GameActionButton>
            <GameActionButton variant="secondary" onClick={() => act({ action: 'leaderboard' })} disabled={run.isPending}>
              <Trophy className="h-4 w-4" />
              Scores
            </GameActionButton>
          </div>
          </>
          )}
        </div>
      )}

      {(session.status === 'reveal' || session.status === 'leaderboard' || session.status === 'finished') && (
        <div className="space-y-6">
          {session.status === 'reveal' && currentQuestion && (
            <>
              <div className="flex justify-center">
                <TimerRing seconds={phaseSeconds} total={session.distribution_seconds || 4} />
              </div>
              <QuestionTitle>{currentQuestion.prompt}</QuestionTitle>
              <QuestionMedia src={currentQuestion.image_url} compact />
              <AnswerDistributionChart
                question={currentQuestion}
                optionStats={session.option_stats}
                unansweredCount={session.unanswered_count}
              />
            </>
          )}

          {session.status === 'leaderboard' && (
            <>
              <div className="flex justify-center">
                <TimerRing seconds={phaseSeconds} total={session.recap_seconds || 5} />
              </div>
              <HostTopRanking players={session.players || []} limit={6} />
            </>
          )}

          {session.status === 'finished' && (
            <PodiumLeaderboard
              players={session.players || []}
              title="Final scores!"
            />
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            {session.status !== 'finished' && (
              <GameActionButton onClick={() => act({ action: 'next' })} disabled={run.isPending || session.paused}>
                <SkipForward className="h-4 w-4" />
                Next
              </GameActionButton>
            )}
            {session.status === 'finished' && (
              <>
                <Link to={`/games/sessions/${session.id}/analytics`}>
                  <GameActionButton>
                    <BarChart3 className="h-4 w-4" />
                    View Analytics
                  </GameActionButton>
                </Link>
                <Link to="/games">
                  <GameActionButton variant="secondary">Back to Games</GameActionButton>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </GameStage>
  );
}

function useQuestionTimer(session, question) {
  const [remaining, setRemaining] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!question || session?.status !== 'question') {
      setRemaining(0);
      setTimedOut(false);
      return undefined;
    }

    const tick = () => {
      const state = questionTimerState(session, question, Date.now());
      setRemaining(state.remainingSeconds);
      setTimedOut(state.timedOut);
      if (state.countdownMs > 0 || session?.paused) return;
      if (state.remainingSeconds > 0 && state.remainingSeconds <= 5) emitTimerTick(question?.id, state.remainingSeconds);
    };

    tick();
    if (session?.paused) return undefined;
    const timerId = setInterval(tick, 250);
    return () => clearInterval(timerId);
  }, [
    session?.question_ends_at,
    session?.question_started_at,
    session?.status,
    session?.paused,
    session?.pause_remaining_ms,
    session?.answering_open,
    question?.id,
    question?.time_limit_seconds,
  ]);

  return { remaining, timedOut };
}

function usePhaseTimer(session) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (session?.status !== 'reveal' && session?.status !== 'leaderboard') {
      setRemaining(0);
      return undefined;
    }

    const tick = () => {
      if (session?.paused) {
        setRemaining(Math.max(0, Math.ceil((session.pause_remaining_ms || 0) / 1000)));
        return;
      }
      if (!session?.phase_ends_at) {
        setRemaining(0);
        return;
      }
      const left = Math.max(0, Math.ceil((new Date(session.phase_ends_at).getTime() - Date.now()) / 1000));
      setRemaining(left);
    };

    tick();
    if (session?.paused) return undefined;
    const timerId = setInterval(tick, 250);
    return () => clearInterval(timerId);
  }, [session?.status, session?.phase_ends_at, session?.paused, session?.pause_remaining_ms]);

  return { remaining };
}
