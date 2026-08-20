// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Eraser, Zap, Shield, Sparkles, Volume2, VolumeX, Music2, Music, CheckCircle2, XCircle, LogOut,
  Trophy, Rocket, Flame, TrendingUp, TrendingDown, Target, Wind, Clock, ArrowRight, Smile, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { subscribeQuizSession } from '@/lib/echo';
import {
  unlockAudio, playSfx, playSfxOnce, emitTimerTick, syncGameMusic, stopLobby, isMusicMuted, isSfxMuted,
  setMusicMuted, setSfxMuted, setSessionAudio, phaseForSessionStatus, armUnlockOnGesture,
  resetAudioGates,
} from '@/lib/gameAudio';
import {
  fireCorrectConfetti, fireStreakConfetti, fireCelebrateConfetti, fireWinnerConfetti,
} from '@/lib/confettiBurst';
import PageLoader from '@/components/PageLoader';
import {
  AnswerButton, ScorePill, TimerRing, WaitingDots, QuestionTitle, QuestionMedia,
  GameStage, PodiumLeaderboard, GameActionButton, GameIconButton, FullscreenButton,
  AnswerDistributionChart, QuestionCountdown, ExpEarnedBadge,
} from '@/components/games/GameUi';
import QuizAvatar from '@/components/games/QuizAvatar';
import { cn } from '@/lib/utils';
import { answerGridClass, isTrueFalseQuestion } from '@/lib/quizQuestion';
import {
  isQuizAnsweringOpen, questionTimerState, quizCountdownLabel, quizCountdownRemainingMs,
} from '@/lib/quizCountdown';
import {
  consumeReactionAnimation,
  finishedReactionKey,
  getOrCreateReaction,
  reactionEventKey,
  reactionTheme,
  resetReactionGates,
} from '@/lib/quizReactions';
import { formatPointsDelta } from '@/lib/quizAnalyticsFormat';
import {
  answerFeedbackText,
  isPowerUpVisibleForQuestion,
  powerUpArmedHint,
  powerUpHint,
  scoringPowerUpBlocked,
} from '@/lib/quizPowerUps';

const POWER_UP_META = {
  eraser: { label: 'Eraser', icon: Eraser, color: 'bg-[#1368CE]' },
  double: { label: 'Double', icon: Zap, color: 'bg-[#D89E00]' },
  streak_freeze: { label: 'Streak Shield', icon: Shield, color: 'bg-[#864CBF]' },
  bonus: { label: 'Bonus', icon: Sparkles, color: 'bg-[#26890C]' },
};

const POWER_UP_TOAST = {
  eraser: 'Eraser used',
  double: 'Double armed',
  streak_freeze: 'Streak Shield armed',
  bonus: 'Bonus armed',
};

function stagePhase(status) {
  if (status === 'lobby') return 'lobby';
  if (status === 'question') return 'question';
  if (status === 'reveal') return 'reveal';
  if (status === 'finished') return 'finished';
  return 'leaderboard';
}

export default function QuizPlay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAsync = searchParams.get('async') === '1';
  const queryClient = useQueryClient();
  const [muteMusic, setMuteMusicLocal] = useState(isMusicMuted());
  const [muteSfx, setMuteSfxLocal] = useState(isSfxMuted());
  const [lastFeedback, setLastFeedback] = useState(null);
  const prevStatus = useRef(null);
  const stageRef = useRef(null);

  const sessionQuery = useQuery({
    queryKey: ['quiz-session', id],
    queryFn: () => db.quizSessions.get(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === 'finished') return false;
      return isAsync ? false : 1500;
    },
  });

  const session = sessionQuery.data;

  useEffect(() => {
    armUnlockOnGesture();
    resetAudioGates();
    resetReactionGates();
    return () => {
      stopLobby();
      resetAudioGates();
      resetReactionGates();
    };
  }, [id]);

  useEffect(() => {
    if (!session || isAsync) return;
    setSessionAudio({ bgmTheme: session.bgm_theme });
    syncGameMusic(session.music_enabled, session.bgm_theme, phaseForSessionStatus(session.status));
  }, [session?.status, session?.music_enabled, session?.bgm_theme, isAsync]);

  const selfStats = useMemo(() => {
    if (!session?.players?.length) return { score: 0, streak: 0, name: 'You' };
    const mine = session.players.find((p) => Number(p.user_id) === Number(session.viewer_user_id));
    if (mine) return { score: mine.score, streak: mine.streak, name: mine.display_name };
    return { score: 0, streak: 0, name: 'You' };
  }, [session]);

  const mePlayer = useMemo(() => {
    if (!session?.players?.length) return null;
    return session.players.find((p) => Number(p.user_id) === Number(session.viewer_user_id)) || null;
  }, [session]);

  useEffect(() => {
    if (!id || isAsync) return undefined;
    return subscribeQuizSession(id, () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-session', id] });
    });
  }, [id, queryClient, isAsync]);

  useEffect(() => {
    if (!session) return;
    const qid = session.current_question_id;
    const prev = prevStatus.current;

    if (session.status === 'question' && qid) {
      if (prev === 'lobby') playSfxOnce('game-start', 'game-start');
      if (isAsync || isQuizAnsweringOpen(session)) {
        playSfxOnce(`q:${qid}:start`, 'question-start');
      }
    }

    if (!isAsync) {
      if (session.status === 'reveal' && qid) {
        playSfxOnce(`q:${qid}:reveal`, 'reveal');
      }

      if ((session.status === 'reveal' || session.status === 'leaderboard') && qid && session.my_answer) {
        const missed = !session.my_answer.quiz_option_id;
        const result = session.my_answer.is_correct && !missed ? 'correct' : 'wrong';
        if (playSfxOnce(`q:${qid}:result`, result) && result === 'correct') {
          fireCorrectConfetti();
          if ((session.my_answer.streak_after || 0) >= 3 && playSfxOnce(`q:${qid}:streak`, 'streak')) {
            fireStreakConfetti();
          }
        }
      }

      if (session.status === 'leaderboard' && qid) {
        if (playSfxOnce(`q:${qid}:board`, 'leaderboard')) fireCelebrateConfetti();
      }
    }

    if (session.status === 'finished') {
      if (playSfxOnce('winner', 'winner')) fireWinnerConfetti();
    }

    prevStatus.current = session.status;
  }, [session?.status, session?.current_question_id, session?.my_answer, session?.answering_open, session?.question_started_at, isAsync]);

  const answerMutation = useMutation({
    mutationFn: (optionId) => db.quizSessions.answer(id, optionId),
    onSuccess: (data) => {
      void unlockAudio();
      playSfx('answer-lock');
      if (isAsync && data.answer) {
        setLastFeedback({
          is_correct: data.answer.is_correct,
          points: data.answer.points_awarded,
        });
        if (data.answer.is_correct) {
          playSfx('correct');
          fireCorrectConfetti();
          if ((data.answer.streak_after || 0) >= 3) {
            playSfx('streak');
            fireStreakConfetti();
          }
        } else {
          playSfx('wrong');
        }
        setTimeout(() => setLastFeedback(null), 1200);
      }
      if (data.session) {
        queryClient.setQueryData(['quiz-session', id], data.session);
      } else {
        queryClient.invalidateQueries({ queryKey: ['quiz-session', id] });
      }
    },
    onError: (err) => toast.error(err.message || err?.data?.message || 'Answer failed'),
  });

  const powerUpMutation = useMutation({
    mutationFn: (type) => db.quizSessions.powerUp(id, type),
    onSuccess: (data, type) => {
      void unlockAudio();
      playSfx('power-up');
      if (data.session) queryClient.setQueryData(['quiz-session', id], data.session);
      toast.success(POWER_UP_TOAST[type] || 'Power-up activated');
    },
    onError: (err) => toast.error(err.message || err?.data?.message || 'Power-up failed'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => db.quizSessions.leave(id),
    onSuccess: () => {
      toast.success('Left the game');
      navigate('/games', { replace: true });
    },
    onError: (err) => toast.error(err.message || err?.data?.message || 'Could not leave'),
  });

  useEffect(() => {
    if (!session || isAsync) return;
    if (session.status === 'finished' && !session.current_question_id) {
      toast.message('The host ended the game.');
      navigate('/games', { replace: true });
    }
  }, [session?.status, session?.current_question_id, isAsync, navigate]);

  useEffect(() => {
    if (isAsync || !session) return undefined;
    const locked = ['question', 'reveal', 'leaderboard'].includes(session.status);
    if (!locked) return undefined;
    const onLeave = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [session?.status, isAsync]);

  const currentQuestion = useMemo(() => {
    if (!session?.current_question_id) return null;
    return session.quiz?.questions?.find((q) => Number(q.id) === Number(session.current_question_id)) || null;
  }, [session]);

  const liveReaction = useMemo(() => {
    if (isAsync || !session?.is_player || session.is_host) return null;
    const status = session.status;
    if (status !== 'leaderboard' && status !== 'finished') return null;
    if (!session.my_answer) return null;

    const input = {
      status,
      result_context: session.result_context,
      my_answer: session.my_answer,
      time_limit_seconds: currentQuestion?.time_limit_seconds,
      player_count: session.player_count,
      session_id: session.id,
      question_id: session.current_question_id,
    };

    if (status === 'finished') {
      if (Number(session.my_answer.rank) !== 1) return null;
      const key = finishedReactionKey(session.id);
      const reaction = getOrCreateReaction(key, input);
      return reaction ? { key, ...reaction } : null;
    }

    if (!session.result_context) return null;
    if (!session.current_question_id) return null;
    const key = reactionEventKey(session.id, session.current_question_id);
    const reaction = getOrCreateReaction(key, input);
    return reaction ? { key, ...reaction } : null;
  }, [isAsync, session, currentQuestion]);

  const visibleOptions = useMemo(() => {
    if (!currentQuestion) return [];
    const erased = new Set((session?.erased_option_ids || []).map(Number));
    return (currentQuestion.options || []).filter((o) => !erased.has(Number(o.id)));
  }, [currentQuestion, session?.erased_option_ids]);

  const { remaining: remainingSeconds, timedOut } = useQuestionTimer(session, currentQuestion);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (isAsync || session?.status !== 'question' || session?.paused) return undefined;
    if (quizCountdownRemainingMs(session) <= 0) return undefined;
    const timerId = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timerId);
  }, [isAsync, session?.status, session?.question_started_at, session?.answering_open, session?.paused]);

  const countdownMs = isAsync ? 0 : quizCountdownRemainingMs(session, now);
  const countdownLabel = quizCountdownLabel(countdownMs);
  const answeringOpen = isAsync || isQuizAnsweringOpen(session, now);

  useEffect(() => {
    if (!countdownLabel || countdownLabel === 'GO!' || isAsync) return;
    playSfxOnce(`countdown:${id}:${countdownLabel}`, 'timer-tick');
  }, [countdownLabel, id, isAsync]);

  const answersLocked = !!session?.my_answer || answerMutation.isPending || (!isAsync && (timedOut || !!session?.paused || !answeringOpen));

  if (sessionQuery.isLoading) return <PageLoader />;
  if (!session) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Session not found.
        <div className="mt-4"><Link to="/games" className="underline">Back</Link></div>
      </div>
    );
  }

  return (
    <GameStage ref={stageRef} phase={stagePhase(session.status)} className="max-w-none">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-white/60 truncate">{session.quiz?.title}</p>
            <div className="mt-1.5">
              <ScorePill score={selfStats.score} streak={selfStats.streak} />
            </div>
          </div>
          <div className="flex gap-2">
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
            <FullscreenButton targetRef={stageRef} />
          </div>
        </header>

        {session.paused && session.status !== 'lobby' && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-400/20 px-4 py-3 text-center text-sm font-bold text-white">
            Game paused — the host will be back shortly.
          </div>
        )}

        {lastFeedback && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              'rounded-2xl px-4 py-3 flex items-center gap-3 text-sm font-black shadow-lg',
              lastFeedback.is_correct ? 'bg-[#26890C] text-white' : 'bg-[#E21B3C] text-white',
            )}
          >
            {lastFeedback.is_correct ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            <span>{answerFeedbackText(lastFeedback.is_correct, lastFeedback.points)}</span>
          </motion.div>
        )}

        {session.status === 'lobby' && (
          <div className="rounded-3xl bg-black/25 border border-white/15 p-10 text-center space-y-5">
            {mePlayer ? (
              <div className="flex justify-center">
                <QuizAvatar
                  profileImage={mePlayer.profile_picture}
                  profileImageCrop={mePlayer.profile_picture_crop}
                  accessoryId={mePlayer.accessory_id}
                  name={mePlayer.display_name}
                  size="xl"
                />
              </div>
            ) : null}
            <WaitingDots label="Get ready" />
            <h2 className="text-3xl sm:text-4xl font-black text-white drop-shadow">You&apos;re in!</h2>
            <p className="text-white/70 font-semibold">Waiting for the host to start…</p>
            <motion.p
              key={session.player_count}
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              className="inline-block rounded-full bg-[#FF8B2D] px-5 py-2 text-sm font-black text-white shadow-lg"
            >
              {session.player_count} player{session.player_count === 1 ? '' : 's'} here
            </motion.p>
            <GameActionButton
              variant="danger"
              disabled={leaveMutation.isPending}
              onClick={() => leaveMutation.mutate()}
            >
              <LogOut className="h-4 w-4" />
              Leave
            </GameActionButton>
          </div>
        )}

        {session.status === 'question' && currentQuestion && (
          <div className="relative space-y-5 min-h-[240px]">
            <QuestionCountdown label={countdownLabel} />
            {!countdownLabel && (
            <>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <TimerRing seconds={remainingSeconds} total={currentQuestion.time_limit_seconds || 20} />
              {!isAsync && (
                <div className="flex gap-2 flex-wrap">
                  {(session.my_power_ups || []).map((pu) => {
                    const meta = POWER_UP_META[pu.type];
                    if (!meta) return null;
                    if (!isPowerUpVisibleForQuestion(pu.type, currentQuestion)) return null;
                    const Icon = meta.icon;
                    const scoringConflict = scoringPowerUpBlocked(pu.type, session.my_power_ups);
                    const disabled = pu.uses_remaining < 1 || pu.active || !!session.my_answer || powerUpMutation.isPending || !!session.paused || scoringConflict || !answeringOpen;
                    return (
                      <motion.button
                        key={pu.type}
                        type="button"
                        whileHover={disabled ? undefined : { scale: 1.06, y: -2 }}
                        whileTap={disabled ? undefined : { scale: 0.95 }}
                        disabled={disabled}
                        title={powerUpHint(pu.type)}
                        onClick={() => {
                          void unlockAudio();
                          powerUpMutation.mutate(pu.type);
                        }}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-black text-white shadow-lg disabled:opacity-40',
                          pu.active ? 'ring-2 ring-white' : '',
                          meta.color,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-left leading-tight">
                          <span className="block">{meta.label}</span>
                          <span className="block text-[9px] font-bold opacity-90">
                            {pu.active ? powerUpArmedHint(pu.type) : powerUpHint(pu.type)}
                          </span>
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            <QuestionTitle key={currentQuestion.id}>{currentQuestion.prompt}</QuestionTitle>
            <QuestionMedia src={currentQuestion.image_url} compact />

            {session.my_answer ? (
              <div className="rounded-3xl bg-black/25 border border-white/15 py-10 text-center space-y-4">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                  className="inline-flex rounded-full bg-white text-violet-900 dark:bg-slate-100 dark:text-violet-950 px-5 py-2 text-sm font-black shadow-lg"
                >
                  Locked in!
                </motion.div>
                <WaitingDots label="Waiting for reveal" />
              </div>
            ) : !isAsync && timedOut ? (
              <div className="rounded-3xl bg-black/25 border border-white/15 py-10 text-center space-y-4">
                <p className="text-2xl font-black text-white">Time&apos;s up</p>
                <WaitingDots label="Waiting for the host" />
              </div>
            ) : (
              <div className={answerGridClass(currentQuestion)}>
                {visibleOptions.map((opt, i) => (
                  <AnswerButton
                    key={opt.id}
                    index={i}
                    label={opt.label}
                    large={isTrueFalseQuestion(currentQuestion)}
                    disabled={answersLocked}
                    delay={i * 0.05}
                    onClick={() => {
                      void unlockAudio();
                      answerMutation.mutate(opt.id);
                    }}
                  />
                ))}
              </div>
            )}
            </>
            )}
          </div>
        )}

        {(session.status === 'reveal' || session.status === 'leaderboard' || session.status === 'finished') && (
          <div className="space-y-5">
            {session.status === 'reveal' && currentQuestion && (
              <>
                <QuestionMedia src={currentQuestion.image_url} compact />
                <AnswerDistributionChart
                  question={currentQuestion}
                  optionStats={session.option_stats}
                  unansweredCount={session.unanswered_count}
                  selectedOptionId={session.my_answer?.quiz_option_id}
                />
              </>
            )}

            {session.status === 'leaderboard' && (
              <PlayerRecap session={session} player={mePlayer} reaction={liveReaction} />
            )}

            {session.status === 'finished' && (
              <>
                <PodiumLeaderboard
                  players={session.players || []}
                  title="Final scores!"
                  highlightUserId={session.viewer_user_id}
                />
                {session.is_player ? (
                  <ExpEarnedBadge amount={session.exp_earned} status={session.exp_status} className="text-2xl" />
                ) : null}
                {liveReaction ? <ReactionMoment reaction={liveReaction} /> : null}
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link to={`/games/sessions/${session.id}/analytics`}>
                    <GameActionButton>
                      <BarChart3 className="h-4 w-4" />
                      View Analytics
                    </GameActionButton>
                  </Link>
                  <Link to="/games">
                    <GameActionButton variant="secondary">Back to Games</GameActionButton>
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </GameStage>
  );
}

const REACTION_ICONS = {
  winner: Trophy,
  big_jump: Rocket,
  streak_5: Flame,
  streak_3: Flame,
  rank_up: TrendingUp,
  rank_down: TrendingDown,
  correct_fast: Zap,
  correct_slow: Target,
  wrong_fast: Wind,
  wrong_slow: Smile,
  missed: Clock,
  correct: CheckCircle2,
  wrong: XCircle,
  fallback: ArrowRight,
};

const REACTION_THEMES = {
  winner: 'bg-amber-400 text-amber-950',
  big_jump: 'bg-violet-600 text-white',
  streak: 'bg-[#FF8B2D] text-white',
  rank_up: 'bg-emerald-500 text-white',
  rank_down: 'bg-rose-600 text-white',
  correct_fast: 'bg-sky-500 text-white',
  correct_slow: 'bg-[#26890C] text-white',
  wrong_fast: 'bg-amber-500 text-amber-950',
  wrong_slow: 'bg-slate-600 text-white',
  missed: 'bg-slate-500 text-white',
  correct: 'bg-[#26890C] text-white',
  wrong: 'bg-[#E21B3C] text-white',
  fallback: 'bg-white text-slate-900',
};

function ReactionMoment({ reaction, compact = false }) {
  if (!reaction?.text) return null;
  const animate = consumeReactionAnimation(reaction.key);
  const Icon = REACTION_ICONS[reaction.category] || Sparkles;
  const theme = REACTION_THEMES[reactionTheme(reaction.category)] || REACTION_THEMES.fallback;
  const enter = (delay) => (animate
    ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28, delay, ease: 'easeOut' } }
    : { initial: false, animate: { opacity: 1, y: 0 } });

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 12, scale: 0.96 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className={cn(
        'rounded-3xl text-center font-black shadow-xl',
        compact ? 'px-4 py-4' : 'px-5 py-5 sm:py-6',
        theme,
      )}
    >
      <motion.div
        initial={animate ? { scale: 0.6, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={animate ? { type: 'spring', stiffness: 420, damping: 18 } : { duration: 0 }}
        className="flex justify-center"
      >
        <Icon className={cn(compact ? 'h-8 w-8' : 'h-10 w-10', 'drop-shadow-sm')} strokeWidth={2.4} />
      </motion.div>
      <motion.p
        {...enter(0.08)}
        className={cn(
          'mt-2 tracking-[0.18em] uppercase',
          compact ? 'text-[10px]' : 'text-xs',
        )}
      >
        {reaction.label}
      </motion.p>
      <motion.p
        {...enter(0.16)}
        className={cn('mt-1.5 leading-snug', compact ? 'text-sm' : 'text-base sm:text-lg')}
      >
        {reaction.text}
      </motion.p>
      {reaction.metric ? (
        <motion.p
          {...enter(0.24)}
          className={cn('mt-2 tabular-nums opacity-90', compact ? 'text-sm' : 'text-lg')}
        >
          {reaction.metric}
        </motion.p>
      ) : null}
    </motion.div>
  );
}

function PlayerRecap({ session, player = null, reaction = null }) {
  const mine = session.my_answer;
  const missed = !mine?.quiz_option_id;
  const correct = !!mine?.is_correct && !missed;
  const rank = mine?.rank;
  const previousRank = mine?.previous_rank;
  const delta = Number(mine?.rank_delta) || 0;
  const outsideTop = rank != null && rank > 6;

  return (
    <div className="space-y-4">
      {player ? (
        <div className="flex justify-center">
          <QuizAvatar
            profileImage={player.profile_picture}
            profileImageCrop={player.profile_picture_crop}
            accessoryId={player.accessory_id}
            name={player.display_name}
            size="lg"
          />
        </div>
      ) : null}
      {reaction ? (
        <ReactionMoment reaction={reaction} />
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={cn(
            'rounded-3xl px-5 py-6 text-center font-black shadow-xl',
            missed ? 'bg-slate-600 text-white' : correct ? 'bg-[#26890C] text-white' : 'bg-[#E21B3C] text-white',
          )}
        >
          <div className="flex items-center justify-center gap-2 text-2xl sm:text-3xl">
            {missed ? <XCircle className="h-8 w-8" /> : correct ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
            <span>{missed ? 'Missed' : correct ? 'Correct!' : 'Wrong'}</span>
          </div>
          <p className="mt-2 text-lg opacity-90">{formatPointsDelta(mine?.points_awarded ?? 0)} points</p>
        </motion.div>
      )}

      <div className="rounded-3xl bg-black/25 border border-white/15 p-5 space-y-3 text-center">
        <p className="text-3xl font-black tabular-nums text-white">{mine?.score ?? 0} pts</p>
        {(mine?.streak_after || 0) > 0 && (
          <p className="text-[#FF8B2D] font-black">🔥 {mine.streak_after} streak</p>
        )}
        {rank != null && (
          <p className="text-white text-xl font-black">
            {previousRank != null && previousRank !== rank ? `#${previousRank} → #${rank}` : `#${rank}`}
          </p>
        )}
        {delta !== 0 && (
          <p className={cn('font-black', delta > 0 ? 'text-emerald-300' : 'text-rose-300')}>
            {delta > 0 ? `↑ ${delta} places` : `↓ ${Math.abs(delta)} places`}
          </p>
        )}
        {rank !== 1 && mine?.ahead_display_name && mine?.points_ahead != null && (
          <p className="text-white/80 font-semibold">
            {mine.points_ahead} points behind {mine.ahead_display_name}
          </p>
        )}
        {mine?.points_behind != null && mine.points_behind > 0 && rank !== 1 && (
          <p className="text-white/60 text-sm font-semibold">
            {mine.points_behind} points ahead of the next player
          </p>
        )}
        {outsideTop && (
          <p className="text-sm font-bold text-white/70">You&apos;re outside the Top 6 — keep pushing!</p>
        )}
      </div>
    </div>
  );
}

function useQuestionTimer(session, question) {
  const [remaining, setRemaining] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!question || session?.status !== 'question') {
      setRemaining(question?.time_limit_seconds || 0);
      setTimedOut(false);
      return undefined;
    }

    const tick = () => {
      const state = questionTimerState(session, question, Date.now());
      setRemaining(state.remainingSeconds);
      setTimedOut(state.timedOut);
      if (state.countdownMs > 0 || session?.paused) return;
      if (state.remainingSeconds > 0 && state.remainingSeconds <= 5) emitTimerTick(question?.id, state.remainingSeconds);
      if (state.timedOut && !session?.my_answer) playSfxOnce(`q:${question?.id}:timeout`, 'timeout');
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
