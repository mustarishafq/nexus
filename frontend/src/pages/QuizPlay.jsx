// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Eraser, Zap, Shield, Volume2, VolumeX, Music2, Music, CheckCircle2, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { subscribeQuizSession } from '@/lib/echo';
import {
  unlockAudio, playSfx, syncGameMusic, stopLobby, isMusicMuted, isSfxMuted,
  setMusicMuted, setSfxMuted, setSessionAudio, phaseForSessionStatus,
} from '@/lib/gameAudio';
import {
  fireCorrectConfetti, fireStreakConfetti, fireCelebrateConfetti, fireWinnerConfetti,
} from '@/lib/confettiBurst';
import PageLoader from '@/components/PageLoader';
import {
  AnswerButton, ScorePill, TimerRing, WaitingDots, QuestionTitle,
  GameStage, PodiumLeaderboard, GameActionButton, GameIconButton, FullscreenButton,
} from '@/components/games/GameUi';
import { cn } from '@/lib/utils';

const POWER_UP_META = {
  eraser: { label: 'Eraser', icon: Eraser, hint: '50/50', color: 'bg-[#1368CE]' },
  double: { label: 'Double', icon: Zap, hint: '2× points', color: 'bg-[#D89E00]' },
  streak_freeze: { label: 'Freeze', icon: Shield, hint: 'Keep streak', color: 'bg-[#864CBF]' },
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

  const selfStats = useMemo(() => {
    if (!session?.players?.length) return { score: 0, streak: 0, name: 'You' };
    const mine = session.players.find((p) => p.user_id === session.viewer_user_id);
    if (mine) return { score: mine.score, streak: mine.streak, name: mine.display_name };
    return {
      score: session.players[0].score,
      streak: session.players[0].streak,
      name: session.players[0].display_name,
    };
  }, [session]);

  useEffect(() => {
    unlockAudio();
  }, []);

  useEffect(() => {
    if (!session || isAsync) return undefined;
    setSessionAudio({ bgmTheme: session.bgm_theme, sfxPack: session.sfx_pack });
    const phase = phaseForSessionStatus(session.status);
    unlockAudio().then(() => {
      syncGameMusic(session.music_enabled, session.bgm_theme, phase);
    });
    return () => stopLobby();
  }, [session?.status, session?.music_enabled, session?.bgm_theme, session?.sfx_pack, isAsync]);

  useEffect(() => {
    if (!id || isAsync) return undefined;
    return subscribeQuizSession(id, () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-session', id] });
    });
  }, [id, queryClient, isAsync]);

  useEffect(() => {
    if (!session) return;
    const prev = prevStatus.current;
    if (prev !== session.status) {
      if (session.status === 'question') playSfx('question-start');
      if (session.status === 'reveal' && session.my_answer) {
        if (session.my_answer.is_correct) {
          playSfx('correct');
          fireCorrectConfetti();
          if ((session.my_answer.streak_after || 0) >= 3) {
            playSfx('streak');
            fireStreakConfetti();
          }
        } else {
          playSfx('wrong');
        }
      }
      if (session.status === 'leaderboard') {
        playSfx('leaderboard');
        fireCelebrateConfetti();
      }
      if (session.status === 'finished') {
        playSfx('winner');
        fireWinnerConfetti();
      }
      prevStatus.current = session.status;
    }
  }, [session?.status, session?.my_answer]);

  const answerMutation = useMutation({
    mutationFn: (optionId) => db.quizSessions.answer(id, optionId),
    onSuccess: (data) => {
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
    onError: (err) => toast.error(err?.data?.message || err.message || 'Answer failed'),
  });

  const powerUpMutation = useMutation({
    mutationFn: (type) => db.quizSessions.powerUp(id, type),
    onSuccess: (data) => {
      playSfx('power-up');
      if (data.session) queryClient.setQueryData(['quiz-session', id], data.session);
      toast.success('Power-up activated');
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Power-up failed'),
  });

  const currentQuestion = useMemo(() => {
    if (!session?.current_question_id) return null;
    return session.quiz?.questions?.find((q) => q.id === session.current_question_id) || null;
  }, [session]);

  const visibleOptions = useMemo(() => {
    if (!currentQuestion) return [];
    const erased = new Set(session?.erased_option_ids || []);
    return (currentQuestion.options || []).filter((o) => !erased.has(o.id));
  }, [currentQuestion, session?.erased_option_ids]);

  const remainingSeconds = useQuestionTimer(session, currentQuestion);

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
            <FullscreenButton targetRef={stageRef} />
          </div>
        </header>

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
            <span>{lastFeedback.is_correct ? `Correct! +${lastFeedback.points}` : 'Wrong'}</span>
          </motion.div>
        )}

        {session.status === 'lobby' && (
          <div className="rounded-3xl bg-black/25 border border-white/15 p-10 text-center space-y-5">
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
          </div>
        )}

        {session.status === 'question' && currentQuestion && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <TimerRing seconds={remainingSeconds} total={currentQuestion.time_limit_seconds || 20} />
              {!isAsync && (
                <div className="flex gap-2 flex-wrap">
                  {(session.my_power_ups || []).map((pu) => {
                    const meta = POWER_UP_META[pu.type];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    const disabled = pu.uses_remaining < 1 || pu.active || !!session.my_answer || powerUpMutation.isPending;
                    return (
                      <motion.button
                        key={pu.type}
                        type="button"
                        whileHover={disabled ? undefined : { scale: 1.06, y: -2 }}
                        whileTap={disabled ? undefined : { scale: 0.95 }}
                        disabled={disabled}
                        title={meta.hint}
                        onClick={() => powerUpMutation.mutate(pu.type)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-white shadow-lg disabled:opacity-40',
                          pu.active ? 'ring-2 ring-white' : '',
                          meta.color,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            <QuestionTitle key={currentQuestion.id}>{currentQuestion.prompt}</QuestionTitle>

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
            ) : (
              <div className="grid gap-3">
                {visibleOptions.map((opt, i) => (
                  <AnswerButton
                    key={opt.id}
                    index={i}
                    label={opt.label}
                    disabled={answerMutation.isPending}
                    delay={i * 0.05}
                    onClick={() => answerMutation.mutate(opt.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {(session.status === 'reveal' || session.status === 'leaderboard' || session.status === 'finished') && (
          <div className="space-y-5">
            {session.my_answer && session.status === 'reveal' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={cn(
                  'rounded-2xl px-5 py-5 flex items-center gap-3 font-black shadow-xl',
                  session.my_answer.is_correct ? 'bg-[#26890C] text-white' : 'bg-[#E21B3C] text-white',
                )}
              >
                {session.my_answer.is_correct ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
                <div>
                  <p className="text-xl">{session.my_answer.is_correct ? 'Correct!' : 'Wrong'}</p>
                  {session.my_answer.points_awarded != null && (
                    <p className="text-sm opacity-90">+{session.my_answer.points_awarded} points</p>
                  )}
                </div>
              </motion.div>
            )}

            {(session.status === 'leaderboard' || session.status === 'finished') && (
              <PodiumLeaderboard
                players={session.players || []}
                title={session.status === 'finished' ? 'Final scores!' : 'Leaderboard'}
                highlightUserId={session.viewer_user_id}
              />
            )}

            {session.status === 'finished' && (
              <div className="flex justify-center">
                <Link to="/games">
                  <GameActionButton variant="secondary">Back to Games</GameActionButton>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </GameStage>
  );
}

function useQuestionTimer(session, question) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!session?.question_started_at || !question || session.status !== 'question') {
      setRemaining(question?.time_limit_seconds || 0);
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
