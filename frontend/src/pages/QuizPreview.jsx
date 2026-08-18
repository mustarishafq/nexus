// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Play, Headphones } from 'lucide-react';
import PageLoader from '@/components/PageLoader';
import {
  GlassCard, AnswerButton, ScorePill, TimerRing, QuestionTitle,
  GameStage, GameActionButton, PodiumLeaderboard, FullscreenButton, GameIconButton,
} from '@/components/games/GameUi';
import GameAudioPicker from '@/components/games/GameAudioPicker';
import {
  unlockAudio, playSfx, setSessionAudio, setStoredBgmTheme, setStoredSfxPack,
  getStoredBgmTheme, getStoredSfxPack, stopLobby, syncGameMusic,
} from '@/lib/gameAudio';
import {
  fireCorrectConfetti, fireStreakConfetti, fireWinnerConfetti,
} from '@/lib/confettiBurst';

export default function QuizPreview() {
  const { id } = useParams();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [finished, setFinished] = useState(false);
  const [bgmTheme, setBgmTheme] = useState(getStoredBgmTheme());
  const [sfxPack, setSfxPack] = useState(getStoredSfxPack());
  const [showAudio, setShowAudio] = useState(false);
  const [started, setStarted] = useState(false);
  const stageRef = useRef(null);

  const quizQuery = useQuery({
    queryKey: ['quiz', id],
    queryFn: () => db.quizzes.get(id),
  });

  const quiz = quizQuery.data;
  const questions = quiz?.questions || [];
  const question = questions[index];

  useEffect(() => {
    if (quiz?.bgm_theme) {
      setBgmTheme(quiz.bgm_theme);
      setSessionAudio({ bgmTheme: quiz.bgm_theme, sfxPack: quiz.sfx_pack || 'soft' });
    }
    if (quiz?.sfx_pack) setSfxPack(quiz.sfx_pack);
  }, [quiz?.bgm_theme, quiz?.sfx_pack]);

  useEffect(() => () => stopLobby(), []);

  useEffect(() => {
    if (!started || finished) {
      if (finished) syncGameMusic(false, bgmTheme, 'off');
      return undefined;
    }
    unlockAudio().then(() => {
      syncGameMusic(true, bgmTheme, 'game');
    });
    return undefined;
  }, [started, finished, bgmTheme]);

  useEffect(() => {
    if (!started || !question || revealed || finished) return undefined;
    setSecondsLeft(question.time_limit_seconds || 20);
    const startedAt = Date.now();
    const limit = (question.time_limit_seconds || 20) * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((startedAt + limit - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left > 0 && left <= 5) playSfx('timer-tick');
      if (left <= 0) {
        setRevealed(true);
        setStreak(0);
        playSfx('wrong');
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [started, index, question?.id, revealed, finished]);

  const correctOptionId = useMemo(
    () => question?.options?.find((o) => o.is_correct)?.id,
    [question],
  );

  const answer = (optionId) => {
    if (revealed || !question) return;
    playSfx('answer-lock');
    setSelected(optionId);
    setRevealed(true);
    const isCorrect = optionId === correctOptionId;
    const ratio = Math.max(0.5, secondsLeft / (question.time_limit_seconds || 20));
    const base = Math.round((question.points_base || 1000) * ratio);
    if (isCorrect) {
      const nextStreak = streak + 1;
      const mult = nextStreak >= 5 ? 2 : nextStreak >= 3 ? 1.5 : nextStreak >= 2 ? 1.2 : 1;
      const pts = Math.round(base * mult);
      setScore((s) => s + pts);
      setStreak(nextStreak);
      playSfx('correct');
      fireCorrectConfetti();
      if (nextStreak >= 3) {
        playSfx('streak');
        fireStreakConfetti();
      }
    } else {
      setStreak(0);
      playSfx('wrong');
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      playSfx('winner');
      fireWinnerConfetti();
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
    playSfx('question-start');
  };

  const reset = () => {
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setScore(0);
    setStreak(0);
    setFinished(false);
    setStarted(true);
    playSfx('question-start');
  };

  if (quizQuery.isLoading) return <PageLoader />;
  if (!quiz) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Quiz not found.
        <div className="mt-4"><Link to="/games" className="underline">Back</Link></div>
      </div>
    );
  }

  const phase = !started ? 'lobby' : finished ? 'finished' : revealed ? 'reveal' : 'question';

  return (
    <GameStage ref={stageRef} phase={phase}>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/games"
            className="inline-flex items-center gap-1 rounded-xl bg-white/15 border border-white/25 px-3 py-2 text-sm font-bold text-white hover:bg-white/25"
          >
            <ArrowLeft className="h-4 w-4" /> Games
          </Link>
          <div className="flex items-center gap-2">
            {(started || finished) && <ScorePill score={score} streak={streak} />}
            <FullscreenButton targetRef={stageRef} />
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Preview / Test</p>
          <h1 className="text-2xl sm:text-3xl font-black text-white drop-shadow">{quiz.title}</h1>
        </div>

        {!started ? (
          <GlassCard variant="stage" className="space-y-5">
            <div className="text-center space-y-1">
              <p className="font-black text-slate-900 dark:text-slate-50 text-lg">{questions.length} questions ready</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Pick your sound, then jump in.</p>
            </div>
            <GameAudioPicker
              surface="stage"
              bgmTheme={bgmTheme}
              sfxPack={sfxPack}
              onBgmChange={(themeId) => {
                setBgmTheme(themeId);
                setStoredBgmTheme(themeId);
                setSessionAudio({ bgmTheme: themeId });
              }}
              onSfxChange={(packId) => {
                setSfxPack(packId);
                setStoredSfxPack(packId);
                setSessionAudio({ sfxPack: packId });
              }}
            />
            <GameActionButton
              className="w-full"
              disabled={questions.length === 0}
              onClick={async () => {
                await unlockAudio();
                setSessionAudio({ bgmTheme, sfxPack });
                syncGameMusic(true, bgmTheme, 'game');
                setStarted(true);
                playSfx('question-start');
              }}
            >
              <Play className="h-5 w-5" />
              Start test
            </GameActionButton>
          </GlassCard>
        ) : finished ? (
          <div className="space-y-6">
            <PodiumLeaderboard
              players={[{ user_id: 'you', display_name: 'You', score, streak }]}
              title="Test complete!"
            />
            <div className="flex flex-wrap gap-3 justify-center">
              <GameActionButton onClick={reset}>
                <RotateCcw className="h-4 w-4" /> Try again
              </GameActionButton>
              <Link to={`/games/${id}/edit`}>
                <GameActionButton variant="secondary">Edit quiz</GameActionButton>
              </Link>
              <Link to="/games">
                <GameActionButton variant="ghost">Done</GameActionButton>
              </Link>
            </div>
          </div>
        ) : question ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold text-white">
                Q{index + 1} / {questions.length}
              </span>
              <TimerRing seconds={secondsLeft} total={question.time_limit_seconds || 20} />
              <GameIconButton title="Audio" onClick={() => setShowAudio((v) => !v)} active={showAudio}>
                <Headphones className="h-4 w-4" />
              </GameIconButton>
            </div>

            <AnimatePresence>
              {showAudio && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <GlassCard variant="stage">
                    <GameAudioPicker
                      compact
                      surface="stage"
                      bgmTheme={bgmTheme}
                      sfxPack={sfxPack}
                      onBgmChange={(themeId) => {
                        setBgmTheme(themeId);
                        setStoredBgmTheme(themeId);
                        setSessionAudio({ bgmTheme: themeId });
                      }}
                      onSfxChange={(packId) => {
                        setSfxPack(packId);
                        setStoredSfxPack(packId);
                        setSessionAudio({ sfxPack: packId });
                      }}
                    />
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            <QuestionTitle key={question.id}>{question.prompt}</QuestionTitle>

            <div className="grid gap-3">
              {(question.options || []).map((opt, i) => (
                <AnswerButton
                  key={opt.id}
                  index={i}
                  label={opt.label}
                  selected={selected === opt.id}
                  revealed={revealed}
                  isCorrect={opt.is_correct}
                  disabled={revealed}
                  delay={i * 0.05}
                  onClick={() => answer(opt.id)}
                />
              ))}
            </div>

            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl px-4 py-3 flex items-center gap-3 text-sm font-black shadow-lg ${
                  selected === correctOptionId ? 'bg-[#26890C] text-white' : 'bg-[#E21B3C] text-white'
                }`}
              >
                {selected === correctOptionId ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                <span className="flex-1">
                  {selected === correctOptionId ? 'Correct!' : 'Not quite'}
                </span>
                <GameActionButton variant="secondary" className="!py-2 !px-3 !text-xs" onClick={next}>
                  {index + 1 >= questions.length ? 'Results' : 'Next'}
                </GameActionButton>
              </motion.div>
            )}
          </div>
        ) : (
          <p className="text-center text-white/70 font-semibold">This quiz has no questions yet.</p>
        )}
      </div>
    </GameStage>
  );
}
