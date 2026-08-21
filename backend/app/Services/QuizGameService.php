<?php

namespace App\Services;

use App\Events\QuizSessionStateChanged;
use App\Models\ExpReward;
use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\QuizSessionAnswer;
use App\Models\QuizSessionPlayer;
use App\Models\QuizSessionPowerUp;
use App\Models\User;
use App\Support\MediaCropNormalizer;
use App\Support\PublicStorageUrl;
use App\Support\QuizAccessories;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class QuizGameService
{
    public const COMPLETION_EXP_ACTION = 'quiz_complete';

    public const COMPLETION_EXP_SOURCE = 'quiz_session';

    public function __construct(
        protected GamificationService $gamification,
    ) {}

    public static function completionExpForRank(int $rank): int
    {
        if ($rank <= 0) {
            return 0;
        }
        if ($rank === 1) {
            return 20;
        }
        if ($rank === 2) {
            return 15;
        }
        if ($rank === 3) {
            return 10;
        }
        if ($rank <= 10) {
            return 5;
        }

        return 2;
    }

    public function createLiveSession(Quiz $quiz, User $host): QuizSession
    {
        $quiz->loadMissing('questions.options');

        if ($quiz->questions->isEmpty()) {
            throw ValidationException::withMessages([
                'quiz' => 'Add at least one question before starting a live session.',
            ]);
        }

        foreach ($quiz->questions as $question) {
            if ($question->options->count() < 2) {
                throw ValidationException::withMessages([
                    'quiz' => 'Each question needs at least two options.',
                ]);
            }
            if ($question->options->where('is_correct', true)->count() !== 1) {
                throw ValidationException::withMessages([
                    'quiz' => 'Each question must have exactly one correct option.',
                ]);
            }
        }

        $session = QuizSession::create([
            'quiz_id' => $quiz->id,
            'host_user_id' => $host->id,
            'mode' => QuizSession::MODE_LIVE,
            'pin' => $this->generateUniquePin(),
            'join_token' => Str::random(40),
            'status' => QuizSession::STATUS_LOBBY,
            'music_enabled' => true,
            'bgm_theme' => $quiz->bgm_theme ?: 'party',
            'sfx_pack' => $quiz->sfx_pack ?: 'classic',
            'host_last_seen_at' => now(),
        ]);

        $this->broadcast($session, 'session.created');

        return $session->fresh(['quiz.questions.options', 'players', 'host']);
    }

    public function joinLiveSession(string $pin, User $user): QuizSession
    {
        $session = QuizSession::query()
            ->where('pin', $pin)
            ->where('mode', QuizSession::MODE_LIVE)
            ->where('status', '!=', QuizSession::STATUS_FINISHED)
            ->first();

        if (! $session) {
            throw ValidationException::withMessages([
                'pin' => 'No open session found for that PIN.',
            ]);
        }

        if ((int) $session->host_user_id === (int) $user->id) {
            throw ValidationException::withMessages([
                'pin' => 'Hosts cannot join their own session as a player.',
            ]);
        }

        $existing = QuizSessionPlayer::query()
            ->where('quiz_session_id', $session->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            return $this->hydrateLiveSession($session)->fresh($this->defaultRelations());
        }

        $joinedEvent = false;
        try {
            $session = DB::transaction(function () use ($session, $user, &$joinedEvent) {
                $locked = $this->lockSession($session);
                $this->applyLazyEffects($locked);

                if ($locked->status !== QuizSession::STATUS_LOBBY) {
                    throw ValidationException::withMessages([
                        'pin' => 'This game has already started. Joining is closed.',
                    ]);
                }

                $player = QuizSessionPlayer::firstOrCreate(
                    [
                        'quiz_session_id' => $locked->id,
                        'user_id' => $user->id,
                    ],
                    $this->playerIdentitySnapshot($user)
                );

                if ($player->wasRecentlyCreated) {
                    $this->seedPowerUps($locked, $user);
                    $joinedEvent = true;
                }

                return $locked;
            });
        } catch (UniqueConstraintViolationException) {
            return $this->hydrateLiveSession($session)->fresh($this->defaultRelations());
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                return $this->hydrateLiveSession($session)->fresh($this->defaultRelations());
            }

            throw $e;
        }

        if ($joinedEvent) {
            $this->broadcast($session, 'player.joined');
        }

        return $session->fresh($this->defaultRelations());
    }

    public function startSession(QuizSession $session, User $host): QuizSession
    {
        $this->assertHost($session, $host);

        return $this->mutateLockedSession($session, function (QuizSession $locked) {
            if ($locked->status !== QuizSession::STATUS_LOBBY) {
                throw ValidationException::withMessages([
                    'session' => 'Session has already started.',
                ]);
            }

            if ($locked->players()->count() < 1) {
                throw ValidationException::withMessages([
                    'session' => 'Wait for at least one player before starting.',
                ]);
            }

            $first = $locked->quiz->questions()->orderBy('sort_order')->orderBy('id')->first();
            if (! $first) {
                throw ValidationException::withMessages([
                    'session' => 'Quiz has no questions.',
                ]);
            }

            $this->beginQuestion($locked, $first, true);
            $this->touchHostLastSeen($locked);

            return [$locked, 'question.started'];
        });
    }

    public function revealQuestion(QuizSession $session, User $host): QuizSession
    {
        $this->assertHost($session, $host);

        return $this->mutateLockedSession($session, function (QuizSession $locked) {
            $this->touchHostLastSeen($locked);

            if (in_array($locked->status, [
                QuizSession::STATUS_REVEAL,
                QuizSession::STATUS_LEADERBOARD,
                QuizSession::STATUS_FINISHED,
            ], true)) {
                return [$locked, null];
            }

            if ($locked->status !== QuizSession::STATUS_QUESTION) {
                throw ValidationException::withMessages([
                    'session' => 'Nothing to reveal right now.',
                ]);
            }

            $this->revealLocked($locked);

            return [$locked, 'question.revealed'];
        }, false);
    }

    public function showLeaderboard(QuizSession $session, User $host): QuizSession
    {
        $this->assertHost($session, $host);

        return $this->mutateLockedSession($session, function (QuizSession $locked) {
            $this->touchHostLastSeen($locked);

            if ($locked->status === QuizSession::STATUS_LEADERBOARD) {
                return [$locked, null];
            }

            if (! in_array($locked->status, [QuizSession::STATUS_REVEAL, QuizSession::STATUS_QUESTION], true)) {
                throw ValidationException::withMessages([
                    'session' => 'Leaderboard is not available in this state.',
                ]);
            }

            if ($locked->status === QuizSession::STATUS_QUESTION) {
                $this->revealLocked($locked);
            }

            $this->enterLeaderboardLocked($locked);

            return [$locked, 'leaderboard.updated'];
        }, false);
    }

    public function nextQuestion(QuizSession $session, User $host): QuizSession
    {
        $this->assertHost($session, $host);

        return $this->mutateLockedSession($session, function (QuizSession $locked) {
            $this->touchHostLastSeen($locked);

            if ($locked->isPaused()) {
                throw ValidationException::withMessages([
                    'session' => 'The game is paused until the host reconnects.',
                ]);
            }

            if (! in_array($locked->status, [
                QuizSession::STATUS_REVEAL,
                QuizSession::STATUS_LEADERBOARD,
            ], true)) {
                throw ValidationException::withMessages([
                    'session' => 'Cannot advance from this state.',
                ]);
            }

            if ($locked->status === QuizSession::STATUS_REVEAL) {
                $this->enterLeaderboardLocked($locked);

                return [$locked, 'leaderboard.updated'];
            }

            return $this->advanceFromLeaderboardLocked($locked);
        }, false);
    }

    public function endSession(QuizSession $session, User $host): QuizSession
    {
        $this->assertHost($session, $host);

        return $this->mutateLockedSession($session, function (QuizSession $locked) {
            $this->touchHostLastSeen($locked);

            if ($locked->status === QuizSession::STATUS_FINISHED) {
                return [$locked, null];
            }

            if ($locked->status !== QuizSession::STATUS_LOBBY) {
                throw ValidationException::withMessages([
                    'session' => 'The live game cannot be ended after it has started.',
                ]);
            }

            $this->finishLocked($locked);

            return [$locked, 'session.finished'];
        });
    }

    public function leaveLiveSession(QuizSession $session, User $user): QuizSession
    {
        if ($session->mode !== QuizSession::MODE_LIVE) {
            throw ValidationException::withMessages([
                'session' => 'Only live games can be left.',
            ]);
        }

        if ((int) $session->host_user_id === (int) $user->id) {
            throw ValidationException::withMessages([
                'session' => 'Hosts cannot leave as a player. End the live game instead.',
            ]);
        }

        return $this->mutateLockedSession($session, function (QuizSession $locked) use ($user) {
            if ($locked->status !== QuizSession::STATUS_LOBBY) {
                throw ValidationException::withMessages([
                    'session' => 'You cannot leave after the game has started.',
                ]);
            }

            $player = $locked->players()->where('user_id', $user->id)->first();
            if (! $player) {
                throw ValidationException::withMessages([
                    'session' => 'You are not in this game.',
                ]);
            }

            $locked->powerUps()->where('user_id', $user->id)->delete();
            $player->delete();

            return [$locked, 'player.left'];
        });
    }

    public function touchHostPresence(QuizSession $session, User $host): QuizSession
    {
        $this->assertHost($session, $host);

        return $this->mutateLockedSession($session, function (QuizSession $locked) {
            $event = null;
            $wasPaused = $locked->isPaused();
            $this->touchHostLastSeen($locked);
            $this->resumeLocked($locked);
            if ($wasPaused && ! $locked->isPaused()) {
                $event = 'session.resumed';
            }

            return [$locked, $event];
        });
    }

    public function hydrateLiveSession(QuizSession $session): QuizSession
    {
        if ($session->mode !== QuizSession::MODE_LIVE || $session->status === QuizSession::STATUS_FINISHED) {
            return $session;
        }

        $needsWork = $this->hostIsStale($session)
            || ($session->status === QuizSession::STATUS_QUESTION && ! $session->isPaused() && $this->questionDeadlinePassed($session))
            || ($this->isPostQuestionStatus($session->status) && ! $session->isPaused() && $this->phaseDeadlinePassed($session));

        if (! $needsWork) {
            return $session;
        }

        $event = null;
        $updated = DB::transaction(function () use ($session, &$event) {
            $locked = $this->lockSession($session);
            $beforeStatus = $locked->status;
            $wasPaused = $locked->isPaused();
            $this->applyLazyEffects($locked);
            if (! $wasPaused && $locked->isPaused()) {
                $event = 'session.paused';
            } elseif ($beforeStatus === QuizSession::STATUS_QUESTION && $locked->status === QuizSession::STATUS_REVEAL) {
                $event = 'question.revealed';
            } elseif ($beforeStatus === QuizSession::STATUS_REVEAL && $locked->status === QuizSession::STATUS_LEADERBOARD) {
                $event = 'leaderboard.updated';
            } elseif ($beforeStatus === QuizSession::STATUS_LEADERBOARD && $locked->status === QuizSession::STATUS_QUESTION) {
                $event = 'question.started';
            } elseif ($beforeStatus === QuizSession::STATUS_LEADERBOARD && $locked->status === QuizSession::STATUS_FINISHED) {
                $event = 'session.finished';
            }

            return $locked;
        });

        if ($event === 'session.finished') {
            $this->awardQuizCompletionExp($updated->fresh($this->defaultRelations()));
        }

        if ($event) {
            $this->broadcast($updated, $event);
        }

        return $updated;
    }

    public function setAudioSettings(QuizSession $session, User $host, array $settings): QuizSession
    {
        $this->assertHost($session, $host);

        $payload = [];
        if (array_key_exists('music_enabled', $settings)) {
            $payload['music_enabled'] = (bool) $settings['music_enabled'];
        }
        if (! empty($settings['bgm_theme']) && in_array($settings['bgm_theme'], Quiz::BGM_THEMES, true)) {
            $payload['bgm_theme'] = $settings['bgm_theme'];
        }
        if (! empty($settings['sfx_pack']) && in_array($settings['sfx_pack'], Quiz::SFX_PACKS, true)) {
            $payload['sfx_pack'] = $settings['sfx_pack'];
        }

        if ($payload !== []) {
            $session->update($payload);
            $this->broadcast($session, 'music.updated');
        }

        return $session->fresh($this->defaultRelations());
    }

    /**
     * @return array{answer: QuizSessionAnswer, player: QuizSessionPlayer, erased_option_ids: array<int>}
     */
    public function submitAnswer(QuizSession $session, User $user, int $optionId): array
    {
        $player = QuizSessionPlayer::query()
            ->where('quiz_session_id', $session->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $player) {
            throw ValidationException::withMessages([
                'session' => 'You are not a player in this session.',
            ]);
        }

        $erasedIds = [];
        $powerUpUsed = null;
        $points = 0;

        try {
            $answer = DB::transaction(function () use ($session, $player, $user, $optionId, &$erasedIds, &$powerUpUsed, &$points) {
                $lockedSession = $this->lockSession($session);
                $this->applyLazyEffects($lockedSession);

                if ($lockedSession->mode === QuizSession::MODE_LIVE && $lockedSession->isPaused()) {
                    throw ValidationException::withMessages([
                        'session' => 'The game is paused until the host reconnects.',
                    ]);
                }

                if (! $this->isAnsweringOpen($lockedSession)) {
                    throw ValidationException::withMessages([
                        'session' => 'Answers are not open right now.',
                    ]);
                }

                $already = QuizSessionAnswer::query()
                    ->where('quiz_session_id', $lockedSession->id)
                    ->where('quiz_question_id', $lockedSession->current_question_id)
                    ->where('user_id', $user->id)
                    ->exists();

                if ($already) {
                    throw ValidationException::withMessages([
                        'answer' => 'You already answered this question.',
                    ]);
                }

                $question = QuizQuestion::with('options')->findOrFail($lockedSession->current_question_id);
                $option = $question->options->first(fn (QuizOption $o) => (int) $o->id === $optionId);

                if (! $option) {
                    throw ValidationException::withMessages([
                        'option_id' => 'Invalid option for this question.',
                    ]);
                }

                $erasedIds = $this->erasedOptionIdsForPlayer($lockedSession, $user, $question);
                if (in_array($optionId, $erasedIds, true)) {
                    throw ValidationException::withMessages([
                        'option_id' => 'That option was removed by Eraser.',
                    ]);
                }

                [$elapsedMs, $remainingMs, $limitMs, $timedOut] = $this->timingForQuestion($lockedSession, $question);

                if ($timedOut && $lockedSession->mode === QuizSession::MODE_LIVE) {
                    throw ValidationException::withMessages([
                        'session' => 'Time is up for this question.',
                    ]);
                }

                $isCorrect = ! $timedOut && (bool) $option->is_correct;

                $lockedPlayer = QuizSessionPlayer::query()
                    ->whereKey($player->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $double = $this->pendingPowerUp($lockedSession, $user, QuizSessionPowerUp::TYPE_DOUBLE);
                $bonus = $this->pendingPowerUp($lockedSession, $user, QuizSessionPowerUp::TYPE_BONUS);
                $freeze = $this->pendingPowerUp($lockedSession, $user, QuizSessionPowerUp::TYPE_STREAK_FREEZE);
                $normalPoints = $this->normalAnswerPoints($question, $remainingMs, $limitMs, (int) $lockedPlayer->streak);

                if ($isCorrect) {
                    $points = $normalPoints;

                    if ($double) {
                        $points *= 2;
                        $powerUpUsed = QuizSessionPowerUp::TYPE_DOUBLE;
                        $this->consumePowerUp($double);
                    }

                    if ($bonus) {
                        $points += QuizSessionPowerUp::BONUS_POINTS;
                        $powerUpUsed = $powerUpUsed ?? QuizSessionPowerUp::TYPE_BONUS;
                        $this->consumePowerUp($bonus);
                    }

                    if ($freeze) {
                        $this->consumePowerUp($freeze);
                        $powerUpUsed = $powerUpUsed ?? QuizSessionPowerUp::TYPE_STREAK_FREEZE;
                    }

                    $lockedPlayer->score += $points;
                    $lockedPlayer->streak = $lockedPlayer->streak + 1;
                } else {
                    $points = 0;

                    if ($double && $normalPoints > 0) {
                        $points = -$normalPoints;
                        $powerUpUsed = QuizSessionPowerUp::TYPE_DOUBLE;
                        $this->consumePowerUp($double);
                    } elseif ($double) {
                        $this->consumePowerUp($double);
                        $powerUpUsed = $powerUpUsed ?? QuizSessionPowerUp::TYPE_DOUBLE;
                    }

                    if ($bonus) {
                        $this->consumePowerUp($bonus);
                        $powerUpUsed = $powerUpUsed ?? QuizSessionPowerUp::TYPE_BONUS;
                    }

                    if ($freeze) {
                        $powerUpUsed = QuizSessionPowerUp::TYPE_STREAK_FREEZE;
                        $this->consumePowerUp($freeze);
                    } else {
                        $lockedPlayer->streak = 0;
                    }

                    $lockedPlayer->score += $points;
                }

                $lockedPlayer->save();

                return QuizSessionAnswer::create([
                    'quiz_session_id' => $lockedSession->id,
                    'quiz_question_id' => $question->id,
                    'user_id' => $user->id,
                    'quiz_option_id' => $option->id,
                    'is_correct' => $isCorrect,
                    'points_awarded' => $points,
                    'streak_after' => $lockedPlayer->streak,
                    'power_up_used' => $powerUpUsed,
                    'answered_at' => now(),
                    'response_ms' => min($elapsedMs, $limitMs),
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'answer' => 'You already answered this question.',
            ]);
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                throw ValidationException::withMessages([
                    'answer' => 'You already answered this question.',
                ]);
            }

            throw $e;
        }

        $this->broadcast($session, 'answer.received');

        return [
            'answer' => $answer,
            'player' => $player->fresh(),
            'erased_option_ids' => $erasedIds,
        ];
    }

    /**
     * @return array{power_up: QuizSessionPowerUp, erased_option_ids: array<int>}
     */
    public function usePowerUp(QuizSession $session, User $user, string $type): array
    {
        if (! in_array($type, QuizSessionPowerUp::TYPES, true)) {
            throw ValidationException::withMessages([
                'type' => 'Invalid power-up type.',
            ]);
        }

        $player = QuizSessionPlayer::query()
            ->where('quiz_session_id', $session->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $player) {
            throw ValidationException::withMessages([
                'session' => 'You are not a player in this session.',
            ]);
        }

        $erasedIds = [];

        $powerUp = DB::transaction(function () use ($session, $user, $type, &$erasedIds) {
            $lockedSession = $this->lockSession($session);
            $this->applyLazyEffects($lockedSession);

            if ($lockedSession->mode === QuizSession::MODE_ASYNC) {
                $lockedSession->loadMissing('quiz');
                $this->assertAsyncSessionPlayable($lockedSession, $user);
                $hasInventory = QuizSessionPowerUp::query()
                    ->where('quiz_session_id', $lockedSession->id)
                    ->where('user_id', $user->id)
                    ->exists();

                if (! $hasInventory) {
                    throw ValidationException::withMessages([
                        'session' => 'Power-ups are only available in live games.',
                    ]);
                }
            } elseif ($lockedSession->mode !== QuizSession::MODE_LIVE) {
                throw ValidationException::withMessages([
                    'session' => 'Power-ups are only available in live games.',
                ]);
            }

            if ($lockedSession->mode === QuizSession::MODE_LIVE && $lockedSession->isPaused()) {
                throw ValidationException::withMessages([
                    'session' => 'The game is paused until the host reconnects.',
                ]);
            }

            if (! $this->isAnsweringOpen($lockedSession)) {
                throw ValidationException::withMessages([
                    'session' => 'Power-ups can only be used during a question.',
                ]);
            }

            if ($lockedSession->mode === QuizSession::MODE_LIVE) {
                if ($this->remainingMs($lockedSession) <= 0) {
                    throw ValidationException::withMessages([
                        'session' => 'Time is up for this question.',
                    ]);
                }
            } else {
                $currentQuestion = QuizQuestion::find($lockedSession->current_question_id);
                if ($currentQuestion) {
                    [, , , $timedOut] = $this->timingForQuestion($lockedSession, $currentQuestion);
                    if ($timedOut) {
                        throw ValidationException::withMessages([
                            'session' => 'Time is up for this question.',
                        ]);
                    }
                }
            }

            $alreadyAnswered = QuizSessionAnswer::query()
                ->where('quiz_session_id', $lockedSession->id)
                ->where('quiz_question_id', $lockedSession->current_question_id)
                ->where('user_id', $user->id)
                ->exists();

            if ($alreadyAnswered) {
                throw ValidationException::withMessages([
                    'type' => 'You already answered this question.',
                ]);
            }

            $powerUp = QuizSessionPowerUp::query()
                ->where('quiz_session_id', $lockedSession->id)
                ->where('user_id', $user->id)
                ->where('type', $type)
                ->lockForUpdate()
                ->first();

            if (! $powerUp || $powerUp->uses_remaining < 1) {
                throw ValidationException::withMessages([
                    'type' => 'No uses remaining for that power-up.',
                ]);
            }

            if ($powerUp->active_until_question_id) {
                throw ValidationException::withMessages([
                    'type' => 'That power-up is already active.',
                ]);
            }

            if (in_array($type, QuizSessionPowerUp::SCORING_TYPES, true)) {
                $otherScoringArmed = QuizSessionPowerUp::query()
                    ->where('quiz_session_id', $lockedSession->id)
                    ->where('user_id', $user->id)
                    ->whereIn('type', QuizSessionPowerUp::SCORING_TYPES)
                    ->where('type', '!=', $type)
                    ->where('active_until_question_id', $lockedSession->current_question_id)
                    ->exists();

                if ($otherScoringArmed) {
                    throw ValidationException::withMessages([
                        'type' => 'Double and Bonus cannot be used on the same question.',
                    ]);
                }
            }

            if ($type === QuizSessionPowerUp::TYPE_ERASER) {
                $erasedIds = $this->applyEraser($lockedSession, $powerUp);
                if ($erasedIds === []) {
                    throw ValidationException::withMessages([
                        'type' => 'Eraser needs at least two incorrect options.',
                    ]);
                }
            }

            $powerUp->uses_remaining = 0;
            $powerUp->active_until_question_id = $lockedSession->current_question_id;
            $powerUp->save();

            return $powerUp;
        });

        $this->broadcast($session, 'powerup.used');

        return [
            'power_up' => $powerUp->fresh(),
            'erased_option_ids' => $erasedIds,
        ];
    }

    /**
     * @return array{0: QuizSession, 1: bool} session and whether it was newly created
     */
    public function startAsyncAttempt(Quiz $quiz, User $user, bool $preview = false): array
    {
        if ($preview) {
            $this->assertSelfPacedPreviewAllowed($quiz, $user);
        } else {
            $this->assertSelfPacedPlayOpen($quiz);
            $this->assertNotSelfPacedCreator($quiz, $user);
        }

        $created = false;
        $session = DB::transaction(function () use ($quiz, $user, $preview, &$created) {
            $lockedQuiz = Quiz::query()->whereKey($quiz->id)->lockForUpdate()->firstOrFail();
            if ($preview) {
                $this->assertSelfPacedPreviewAllowed($lockedQuiz, $user);
            } else {
                $this->assertSelfPacedPlayOpen($lockedQuiz);
                $this->assertNotSelfPacedCreator($lockedQuiz, $user);
            }
            $lockedQuiz->load('questions.options');

            if ($lockedQuiz->questions->isEmpty()) {
                throw ValidationException::withMessages([
                    'quiz' => 'This quiz has no questions.',
                ]);
            }

            $existingIds = QuizSessionPlayer::query()
                ->where('user_id', $user->id)
                ->whereHas('session', function ($query) use ($lockedQuiz, $preview) {
                    $query->where('quiz_id', $lockedQuiz->id)
                        ->where('mode', QuizSession::MODE_ASYNC)
                        ->where('is_preview', $preview);
                })
                ->pluck('quiz_session_id');

            $existing = $existingIds->isEmpty()
                ? null
                : QuizSession::query()
                    ->whereIn('id', $existingIds)
                    ->orderByDesc('id')
                    ->get();

            if (! $preview && $existing && $existing->contains(fn (QuizSession $session) => $session->status === QuizSession::STATUS_FINISHED)) {
                throw ValidationException::withMessages([
                    'quiz' => 'You already completed this quiz.',
                ]);
            }

            $inProgress = $existing?->first(fn (QuizSession $session) => $session->status !== QuizSession::STATUS_FINISHED);
            if ($inProgress) {
                return $inProgress->fresh($this->defaultRelations());
            }

            if ($preview && $existing) {
                QuizSession::query()->whereIn('id', $existing->pluck('id'))->get()->each->delete();
            }

            $first = $lockedQuiz->questions->first();
            [$started, $endsAt] = $this->questionWindow($first, true);

            $created = true;
            $session = QuizSession::create([
                'quiz_id' => $lockedQuiz->id,
                'host_user_id' => $lockedQuiz->user_id,
                'mode' => QuizSession::MODE_ASYNC,
                'is_preview' => $preview,
                'pin' => null,
                'join_token' => Str::random(40),
                'status' => QuizSession::STATUS_QUESTION,
                'current_question_id' => $first->id,
                'question_started_at' => $started,
                'question_ends_at' => $endsAt,
                'music_enabled' => false,
                'bgm_theme' => $lockedQuiz->bgm_theme ?: 'party',
                'sfx_pack' => $lockedQuiz->sfx_pack ?: 'classic',
            ]);

            QuizSessionPlayer::create($this->playerIdentitySnapshot($user) + [
                'quiz_session_id' => $session->id,
                'user_id' => $user->id,
            ]);

            if ($lockedQuiz->async_power_ups_enabled) {
                $this->seedPowerUps($session, $user);
            }

            return $session->fresh($this->defaultRelations());
        });

        return [$session, $created];
    }

    public function submitAsyncAnswer(QuizSession $session, User $user, int $optionId): array
    {
        if ($session->mode !== QuizSession::MODE_ASYNC) {
            throw ValidationException::withMessages([
                'session' => 'Not an async attempt.',
            ]);
        }

        if ($session->status === QuizSession::STATUS_FINISHED) {
            throw ValidationException::withMessages([
                'session' => 'This attempt is already finished.',
            ]);
        }

        $session->loadMissing('quiz');
        $this->assertAsyncSessionPlayable($session, $user);

        $result = $this->submitAnswer($session, $user, $optionId);

        // Auto-advance async to next question or finish
        $next = $this->findNextQuestion($session);

        if ($next) {
            $session->update([
                'current_question_id' => $next->id,
                'question_started_at' => now(),
                'status' => QuizSession::STATUS_QUESTION,
            ]);
        } else {
            $session->update([
                'status' => QuizSession::STATUS_FINISHED,
                'question_started_at' => null,
                'finished_at' => $session->finished_at ?? now(),
            ]);
        }

        return [
            ...$result,
            'session' => $session->fresh($this->defaultRelations()),
        ];
    }

    /**
     * @param  callable(QuizSession): array{0: QuizSession, 1: ?string}  $callback
     */
    protected function mutateLockedSession(QuizSession $session, callable $callback, bool $lazyPostQuestion = true): QuizSession
    {
        $event = null;
        $updated = DB::transaction(function () use ($session, $callback, $lazyPostQuestion, &$event) {
            $locked = $this->lockSession($session);
            $this->applyLazyEffects($locked, $lazyPostQuestion);
            [$locked, $event] = $callback($locked);

            return $locked;
        });

        if ($event === 'session.finished') {
            $this->awardQuizCompletionExp($updated->fresh($this->defaultRelations()));
        }

        if ($event) {
            $this->broadcast($updated, $event);
        }

        return $updated->fresh($this->defaultRelations());
    }

    protected function lockSession(QuizSession $session): QuizSession
    {
        return QuizSession::query()
            ->whereKey($session->id)
            ->lockForUpdate()
            ->firstOrFail();
    }

    protected function applyLazyEffects(QuizSession $session, bool $lazyPostQuestion = true): void
    {
        if ($session->mode !== QuizSession::MODE_LIVE || $session->status === QuizSession::STATUS_FINISHED) {
            return;
        }

        $stale = $this->hostIsStale($session);

        if ($stale && $this->isPausableStatus($session->status) && ! $session->isPaused()) {
            // Expired questions still reveal once so clients are not stuck at 0s.
            // Do not auto-advance reveal/leaderboard while the host is gone.
            if ($session->status === QuizSession::STATUS_QUESTION && $this->questionDeadlinePassed($session)) {
                $this->revealLocked($session);
            }

            if ($this->isPausableStatus($session->status) && $session->status !== QuizSession::STATUS_FINISHED) {
                $this->pauseLocked($session);
            }

            return;
        }

        if ($session->isPaused()) {
            return;
        }

        if ($session->status === QuizSession::STATUS_QUESTION && $this->questionDeadlinePassed($session)) {
            $this->revealLocked($session);

            return;
        }

        if (! $lazyPostQuestion) {
            return;
        }

        if ($session->status === QuizSession::STATUS_REVEAL && $this->phaseDeadlinePassed($session)) {
            $this->enterLeaderboardLocked($session);

            return;
        }

        if ($session->status === QuizSession::STATUS_LEADERBOARD && $this->phaseDeadlinePassed($session)) {
            $this->advanceFromLeaderboardLocked($session);
        }
    }

    protected function beginQuestion(QuizSession $session, QuizQuestion $question, bool $withCountdown = false): void
    {
        [$started, $endsAt] = $this->questionWindow($question, $withCountdown);
        $session->update([
            'status' => QuizSession::STATUS_QUESTION,
            'current_question_id' => $question->id,
            'question_started_at' => $started,
            'question_ends_at' => $endsAt,
            'phase_ends_at' => null,
            'paused_at' => null,
            'pause_remaining_ms' => null,
        ]);
        $session->unsetRelation('currentQuestion');
    }

    /**
     * @return array{0: \Carbon\CarbonInterface, 1: \Carbon\CarbonInterface}
     */
    protected function questionWindow(QuizQuestion $question, bool $withCountdown = false): array
    {
        $countdown = 0;
        if ($withCountdown) {
            $countdown = max(0, (int) config('quiz.first_question_countdown_seconds', 3));
        }

        $started = now()->addSeconds($countdown);

        return [$started, $started->copy()->addSeconds(max(1, (int) $question->time_limit_seconds))];
    }

    protected function revealLocked(QuizSession $session): void
    {
        if ($session->status !== QuizSession::STATUS_QUESTION || ! $session->current_question_id) {
            return;
        }

        $this->markMissingAnswersAsWrong($session);

        $seconds = max(1, (int) config('quiz.distribution_seconds', 4));
        $session->update([
            'status' => QuizSession::STATUS_REVEAL,
            'phase_ends_at' => now()->addSeconds($seconds),
        ]);
    }

    protected function enterLeaderboardLocked(QuizSession $session): void
    {
        if ($session->status === QuizSession::STATUS_LEADERBOARD) {
            return;
        }

        $seconds = max(1, (int) config('quiz.recap_seconds', 5));
        $session->update([
            'status' => QuizSession::STATUS_LEADERBOARD,
            'phase_ends_at' => now()->addSeconds($seconds),
        ]);
    }

    /**
     * @return array{0: QuizSession, 1: string}
     */
    protected function advanceFromLeaderboardLocked(QuizSession $session): array
    {
        $next = $this->findNextQuestion($session);

        if (! $next) {
            $this->finishLocked($session);

            return [$session, 'session.finished'];
        }

        $this->beginQuestion($session, $next);

        return [$session, 'question.started'];
    }

    protected function finishLocked(QuizSession $session): void
    {
        $session->update([
            'status' => QuizSession::STATUS_FINISHED,
            'pin' => null,
            'question_started_at' => null,
            'question_ends_at' => null,
            'phase_ends_at' => null,
            'paused_at' => null,
            'pause_remaining_ms' => null,
            'finished_at' => $session->finished_at ?? now(),
        ]);
    }

    protected function pauseLocked(QuizSession $session): void
    {
        if ($session->isPaused() || ! $this->isPausableStatus($session->status)) {
            return;
        }

        $remaining = null;
        if ($session->status === QuizSession::STATUS_QUESTION) {
            if ($this->questionDeadlinePassed($session)) {
                $this->revealLocked($session);

                return;
            }

            $remaining = $this->remainingQuestionMs($session);
            if ($remaining <= 0) {
                $this->revealLocked($session);

                return;
            }
        } elseif ($this->isPostQuestionStatus($session->status)) {
            $remaining = $this->remainingPhaseMs($session);
        }

        $session->update([
            'paused_at' => now(),
            'pause_remaining_ms' => $remaining,
            'question_ends_at' => $session->status === QuizSession::STATUS_QUESTION ? null : $session->question_ends_at,
            'phase_ends_at' => $this->isPostQuestionStatus($session->status) ? null : $session->phase_ends_at,
        ]);
    }

    protected function resumeLocked(QuizSession $session): void
    {
        if (! $session->isPaused()) {
            return;
        }

        $remaining = max(0, (int) ($session->pause_remaining_ms ?? 0));
        $questionEndsAt = $session->question_ends_at;
        $questionStartedAt = $session->question_started_at;
        $phaseEndsAt = $session->phase_ends_at;

        if ($session->status === QuizSession::STATUS_QUESTION) {
            $questionEndsAt = now()->addMilliseconds($remaining);
            $session->loadMissing('currentQuestion');
            $limitMs = max(1, (int) ($session->currentQuestion?->time_limit_seconds ?? 20) * 1000);
            $questionStartedAt = $questionEndsAt->copy()->subMilliseconds($limitMs);
        } elseif ($this->isPostQuestionStatus($session->status)) {
            $phaseEndsAt = now()->addMilliseconds($remaining);
        }

        $session->update([
            'paused_at' => null,
            'pause_remaining_ms' => null,
            'question_started_at' => $questionStartedAt,
            'question_ends_at' => $questionEndsAt,
            'phase_ends_at' => $phaseEndsAt,
        ]);
    }

    protected function touchHostLastSeen(QuizSession $session): void
    {
        $session->update(['host_last_seen_at' => now()]);
    }

    protected function hostIsStale(QuizSession $session): bool
    {
        if ($session->mode !== QuizSession::MODE_LIVE || $session->status === QuizSession::STATUS_LOBBY) {
            return false;
        }

        if (! $session->host_last_seen_at) {
            return false;
        }

        $grace = max(1, (int) config('quiz.host_heartbeat_grace_seconds', 12));

        return $session->host_last_seen_at->lte(now()->subSeconds($grace));
    }

    protected function isAnsweringOpen(QuizSession $session): bool
    {
        if ($session->status !== QuizSession::STATUS_QUESTION || ! $session->current_question_id) {
            return false;
        }

        if ($session->isPaused()) {
            return false;
        }

        if (
            $session->question_started_at
            && $session->question_started_at->gt(now())
        ) {
            return false;
        }

        return true;
    }

    protected function questionDeadlinePassed(QuizSession $session): bool
    {
        if ($session->isPaused() || ! $session->question_ends_at) {
            return false;
        }

        return $session->question_ends_at->lte(now());
    }

    protected function phaseDeadlinePassed(QuizSession $session): bool
    {
        if ($session->isPaused() || ! $session->phase_ends_at) {
            return false;
        }

        return $session->phase_ends_at->lte(now());
    }

    protected function remainingQuestionMs(QuizSession $session): int
    {
        if ($session->isPaused()) {
            return max(0, (int) ($session->pause_remaining_ms ?? 0));
        }

        if ($session->question_ends_at) {
            return (int) max(0, $session->question_ends_at->getTimestampMs() - now()->getTimestampMs());
        }

        return 0;
    }

    protected function remainingPhaseMs(QuizSession $session): int
    {
        if ($session->isPaused()) {
            return max(0, (int) ($session->pause_remaining_ms ?? 0));
        }

        if ($session->phase_ends_at) {
            return (int) max(0, $session->phase_ends_at->getTimestampMs() - now()->getTimestampMs());
        }

        return 0;
    }

    protected function remainingMs(QuizSession $session): int
    {
        if ($session->status === QuizSession::STATUS_QUESTION) {
            return $this->remainingQuestionMs($session);
        }

        if ($this->isPostQuestionStatus($session->status)) {
            return $this->remainingPhaseMs($session);
        }

        return 0;
    }

    protected function isPostQuestionStatus(string $status): bool
    {
        return in_array($status, [
            QuizSession::STATUS_REVEAL,
            QuizSession::STATUS_LEADERBOARD,
        ], true);
    }

    /**
     * @return array{0: int, 1: int, 2: int, 3: bool}
     */
    protected function timingForQuestion(QuizSession $session, QuizQuestion $question): array
    {
        $limitMs = max(1, (int) $question->time_limit_seconds * 1000);

        if ($session->mode === QuizSession::MODE_LIVE) {
            $remainingMs = $this->remainingMs($session);
            $elapsedMs = min($limitMs, max(0, $limitMs - $remainingMs));

            return [$elapsedMs, $remainingMs, $limitMs, $remainingMs <= 0];
        }

        $startedAt = $session->question_started_at;
        $elapsedMs = $startedAt
            ? (int) max(0, now()->getTimestampMs() - $startedAt->getTimestampMs())
            : $limitMs;
        $remainingMs = max(0, $limitMs - $elapsedMs);

        return [$elapsedMs, $remainingMs, $limitMs, $elapsedMs >= $limitMs];
    }

    protected function isPausableStatus(string $status): bool
    {
        return in_array($status, [
            QuizSession::STATUS_QUESTION,
            QuizSession::STATUS_REVEAL,
            QuizSession::STATUS_LEADERBOARD,
        ], true);
    }

    protected function isUniqueViolation(QueryException $e): bool
    {
        $sqlState = $e->errorInfo[0] ?? null;

        return $sqlState === '23000' || str_contains($e->getMessage(), 'UNIQUE constraint');
    }

    /**
     * Build a player-safe or host-safe payload for the session.
     *
     * @return array<string, mixed>
     */
    public function serializeSession(QuizSession $session, ?User $viewer = null): array
    {
        $session->loadMissing([
            'quiz.questions.options',
            'players',
            'host',
            'currentQuestion.options',
            'answers',
            'powerUps',
        ]);

        $isHost = $viewer && (int) $viewer->id === (int) $session->host_user_id;
        $isPlayer = $viewer && $session->players->contains(fn ($p) => (int) $p->user_id === (int) $viewer->id);
        $revealed = in_array($session->status, [
            QuizSession::STATUS_REVEAL,
            QuizSession::STATUS_LEADERBOARD,
            QuizSession::STATUS_FINISHED,
        ], true);
        // Live hosts authored the quiz so they may see keys. Async "host" is the
        // quiz owner, who might also be the player — never leak answers then.
        $showCorrect = $revealed || ($isHost && $session->mode === QuizSession::MODE_LIVE);
        $hideLiveScores = $session->mode === QuizSession::MODE_LIVE
            && $session->status === QuizSession::STATUS_QUESTION;

        if (
            $viewer
            && $isPlayer
            && $session->mode === QuizSession::MODE_LIVE
            && $session->status !== QuizSession::STATUS_FINISHED
        ) {
            $this->touchPlayerLastSeen($session, $viewer);
        }

        $livePlayerQuestionFilter = $session->mode === QuizSession::MODE_LIVE && ! $isHost;
        $questionModels = $livePlayerQuestionFilter
            ? $session->quiz->questions->filter(fn (QuizQuestion $q) => (int) $q->id === (int) $session->current_question_id)->values()
            : $session->quiz->questions;

        $questions = $questionModels->map(function (QuizQuestion $q) use ($showCorrect, $session, $viewer, $isHost) {
            $erased = ($viewer && ! $isHost)
                ? $this->erasedOptionIdsForPlayer($session, $viewer, $q)
                : [];

            return [
                'id' => $q->id,
                'prompt' => $q->prompt,
                'image_url' => $q->image_url,
                'question_type' => $q->question_type ?: QuizQuestion::TYPE_MULTIPLE_CHOICE,
                'time_limit_seconds' => $q->time_limit_seconds,
                'points_base' => $q->points_base,
                'sort_order' => $q->sort_order,
                'options' => $q->options
                    ->reject(fn (QuizOption $o) => in_array((int) $o->id, $erased, true) && (int) $q->id === (int) $session->current_question_id && $session->status === QuizSession::STATUS_QUESTION)
                    ->values()
                    ->map(fn (QuizOption $o) => [
                        'id' => $o->id,
                        'label' => $o->label,
                        'sort_order' => $o->sort_order,
                        'is_correct' => $showCorrect ? (bool) $o->is_correct : null,
                    ]),
            ];
        });

        $myAnswer = null;
        $myPowerUps = [];
        $erasedOptionIds = [];

        if ($viewer && $isPlayer) {
            $myAnswer = $session->answers
                ->where('user_id', $viewer->id)
                ->where('quiz_question_id', $session->current_question_id)
                ->first();

            $myPowerUps = $session->powerUps
                ->where('user_id', $viewer->id)
                ->values()
                ->map(fn (QuizSessionPowerUp $p) => [
                    'type' => $p->type,
                    'uses_remaining' => $p->uses_remaining,
                    'active' => (int) $p->active_until_question_id === (int) $session->current_question_id,
                ])
                ->all();

            if ($session->currentQuestion) {
                $erasedOptionIds = $this->erasedOptionIdsForPlayer($session, $viewer, $session->currentQuestion);
            }
        }

        $answerCount = $session->current_question_id
            ? $session->answers->where('quiz_question_id', $session->current_question_id)->count()
            : 0;

        $ranked = $this->rankLivePlayers($session, $hideLiveScores);
        $playersPayload = collect($ranked)
            ->map(function (array $row) {
                return [
                    'user_id' => $row['user_id'],
                    'display_name' => $row['display_name'],
                    'profile_picture' => $row['profile_picture'],
                    'profile_picture_crop' => $row['profile_picture_crop'],
                    'accessory_id' => $row['accessory_id'],
                    'score' => $row['score'],
                    'streak' => $row['streak'],
                    'joined_at' => $row['joined_at'],
                    'rank' => $row['rank'],
                    'previous_rank' => $row['previous_rank'],
                    'rank_delta' => $row['rank_delta'],
                ];
            })
            ->values();

        $optionStats = null;
        $unansweredCount = null;
        if ($revealed && $session->mode === QuizSession::MODE_LIVE && $session->currentQuestion) {
            [$optionStats, $unansweredCount] = $this->optionStatsForCurrentQuestion($session);
        }

        $myAnswerPayload = null;
        $resultContext = null;
        if ($myAnswer) {
            $myAnswerPayload = [
                'quiz_option_id' => $myAnswer->quiz_option_id,
                'is_correct' => $showCorrect ? (bool) $myAnswer->is_correct : null,
                'points_awarded' => $showCorrect ? $myAnswer->points_awarded : null,
                'streak_after' => $showCorrect ? $myAnswer->streak_after : null,
                'response_ms' => $showCorrect ? $myAnswer->response_ms : null,
            ];

            if ($showCorrect && $session->mode === QuizSession::MODE_LIVE) {
                $mine = collect($ranked)->firstWhere('user_id', (int) $viewer->id);
                if ($mine) {
                    $myAnswerPayload = array_merge($myAnswerPayload, [
                        'score' => $mine['score'],
                        'previous_score' => $mine['previous_score'],
                        'rank' => $mine['rank'],
                        'previous_rank' => $mine['previous_rank'],
                        'rank_delta' => $mine['rank_delta'],
                        'points_ahead' => $mine['points_ahead'],
                        'points_behind' => $mine['points_behind'],
                        'ahead_display_name' => $mine['ahead_display_name'],
                    ]);
                    $resultContext = $this->resultContextForPlayer(
                        $session,
                        $myAnswer,
                        $mine,
                    );
                }
            }
        }

        $expReward = ($isPlayer && $session->status === QuizSession::STATUS_FINISHED)
            ? $this->viewerExpReward($session, $viewer)
            : null;

        return [
            'id' => $session->id,
            'quiz_id' => $session->quiz_id,
            'viewer_user_id' => $viewer?->id,
            'quiz' => [
                'id' => $session->quiz->id,
                'title' => $session->quiz->title,
                'description' => $session->quiz->description,
                'status' => $session->quiz->status,
                'questions' => $questions,
                'question_count' => $session->quiz->questions->count(),
            ],
            'host_user_id' => $session->host_user_id,
            'host' => [
                'id' => $session->host?->id,
                'name' => $session->host?->displayName(),
            ],
            'mode' => $session->mode,
            'is_preview' => (bool) $session->is_preview,
            'pin' => $isHost || $session->status === QuizSession::STATUS_LOBBY ? $session->pin : null,
            'join_token' => $isHost ? $session->join_token : null,
            'status' => $session->status,
            'current_question_id' => $session->current_question_id,
            'question_started_at' => $session->question_started_at?->toIso8601String(),
            'question_ends_at' => $session->question_ends_at?->toIso8601String(),
            'phase_ends_at' => $session->phase_ends_at?->toIso8601String(),
            'answering_open' => $this->isAnsweringOpen($session),
            'paused' => $session->isPaused(),
            'paused_at' => $session->paused_at?->toIso8601String(),
            'pause_remaining_ms' => $session->pause_remaining_ms,
            'heartbeat_interval_seconds' => (int) config('quiz.host_heartbeat_interval_seconds', 5),
            'distribution_seconds' => (int) config('quiz.distribution_seconds', 4),
            'recap_seconds' => (int) config('quiz.recap_seconds', 5),
            'music_enabled' => (bool) $session->music_enabled,
            'bgm_theme' => $session->bgm_theme ?: 'party',
            'sfx_pack' => $session->sfx_pack ?: 'classic',
            'players' => $playersPayload,
            'option_stats' => $optionStats,
            'unanswered_count' => $unansweredCount,
            'answer_count' => $answerCount,
            'player_count' => $session->players->count(),
            'is_host' => (bool) $isHost,
            'is_player' => (bool) $isPlayer,
            'exp_earned' => $expReward['amount'] ?? null,
            'exp_status' => $expReward['status'] ?? null,
            'my_answer' => $myAnswerPayload,
            'result_context' => $resultContext,
            'my_power_ups' => $myPowerUps,
            'erased_option_ids' => $erasedOptionIds,
            'created_at' => $session->created_at?->toIso8601String(),
        ];
    }

    /**
     * Public answer payload. Live play hides correctness until reveal.
     *
     * @return array<string, mixed>
     */
    public function presentAnswer(QuizSessionAnswer $answer, QuizSession $session, ?User $viewer = null): array
    {
        $isHost = $viewer && (int) $viewer->id === (int) $session->host_user_id;
        $showCorrect = $session->mode === QuizSession::MODE_ASYNC
            || in_array($session->status, [
                QuizSession::STATUS_REVEAL,
                QuizSession::STATUS_LEADERBOARD,
                QuizSession::STATUS_FINISHED,
            ], true)
            || ($isHost && $session->mode === QuizSession::MODE_LIVE);

        return [
            'id' => $answer->id,
            'quiz_option_id' => $answer->quiz_option_id,
            'is_correct' => $showCorrect ? (bool) $answer->is_correct : null,
            'points_awarded' => $showCorrect ? $answer->points_awarded : null,
            'streak_after' => $showCorrect ? $answer->streak_after : null,
            'answered_at' => $answer->answered_at?->toIso8601String(),
            'response_ms' => $answer->response_ms,
        ];
    }

    /**
     * Rank players with Phase 2 tie-break: score, current/previous question speed, joined_at.
     *
     * @return list<array<string, mixed>>
     */
    protected function rankLivePlayers(QuizSession $session, bool $hideLiveScores): array
    {
        $currentQuestionId = $session->current_question_id ? (int) $session->current_question_id : null;
        $previousQuestionId = $this->previousQuestionId($session);

        $currentRows = [];
        $previousRows = [];

        foreach ($session->players as $player) {
            [$visibleScore, $streak] = $this->visiblePlayerStats($session, $player, $hideLiveScores);
            $trueScore = (int) $player->score;
            $pointsThis = $this->pointsForQuestion($session, (int) $player->user_id, $currentQuestionId);
            $previousScore = max(0, $trueScore - $pointsThis);

            $currentRows[] = [
                'player' => $player,
                'score' => $hideLiveScores ? $visibleScore : $trueScore,
                'response_ms' => $hideLiveScores
                    ? $this->responseMsForQuestion($session, (int) $player->user_id, $previousQuestionId)
                    : $this->responseMsForQuestion($session, (int) $player->user_id, $currentQuestionId),
                'joined_ts' => $player->joined_at?->getTimestampMs() ?? 0,
            ];

            $previousRows[] = [
                'player' => $player,
                'score' => $previousScore,
                'response_ms' => $this->responseMsForQuestion($session, (int) $player->user_id, $previousQuestionId),
                'joined_ts' => $player->joined_at?->getTimestampMs() ?? 0,
            ];
        }

        $currentRanked = $this->sortRankRows($currentRows);
        $previousRanked = $this->sortRankRows($previousRows);
        $previousByUser = [];
        foreach ($previousRanked as $row) {
            $previousByUser[(int) $row['player']->user_id] = $row['rank'];
        }

        $result = [];
        foreach ($currentRanked as $index => $row) {
            /** @var QuizSessionPlayer $player */
            $player = $row['player'];
            $userId = (int) $player->user_id;
            [$visibleScore, $streak] = $this->visiblePlayerStats($session, $player, $hideLiveScores);
            $trueScore = $hideLiveScores ? $visibleScore : (int) $player->score;
            $pointsThis = $this->pointsForQuestion($session, $userId, $currentQuestionId);
            $previousScore = $hideLiveScores ? $visibleScore : max(0, (int) $player->score - $pointsThis);
            $previousRank = $previousByUser[$userId] ?? $row['rank'];
            $rankDelta = $previousRank - $row['rank'];

            $ahead = $currentRanked[$index - 1] ?? null;
            $behind = $currentRanked[$index + 1] ?? null;
            $aheadScore = $ahead ? (int) ($hideLiveScores
                ? $this->visiblePlayerStats($session, $ahead['player'], true)[0]
                : $ahead['player']->score) : null;
            $behindScore = $behind ? (int) ($hideLiveScores
                ? $this->visiblePlayerStats($session, $behind['player'], true)[0]
                : $behind['player']->score) : null;

            $result[] = [
                'user_id' => $userId,
                'display_name' => $player->display_name,
                'profile_picture' => PublicStorageUrl::canonicalize($player->profile_picture) ?? $player->profile_picture,
                'profile_picture_crop' => is_array($player->profile_picture_crop) ? $player->profile_picture_crop : null,
                'accessory_id' => QuizAccessories::normalize($player->quiz_accessory_id),
                'score' => $trueScore,
                'previous_score' => $previousScore,
                'streak' => $streak,
                'joined_at' => $player->joined_at?->toIso8601String(),
                'rank' => $row['rank'],
                'previous_rank' => $previousRank,
                'rank_delta' => $rankDelta,
                'points_ahead' => $aheadScore !== null ? max(0, $aheadScore - $trueScore) : null,
                'points_behind' => $behindScore !== null ? max(0, $trueScore - $behindScore) : null,
                'ahead_display_name' => $ahead ? $ahead['player']->display_name : null,
            ];
        }

        return $result;
    }

    /**
     * @param  list<array{player: QuizSessionPlayer, score: int, response_ms: ?int, joined_ts: int}>  $rows
     * @return list<array{player: QuizSessionPlayer, score: int, response_ms: ?int, joined_ts: int, rank: int}>
     */
    public function sortRankRows(array $rows): array
    {
        usort($rows, function (array $a, array $b) {
            if ($a['score'] !== $b['score']) {
                return $b['score'] <=> $a['score'];
            }

            $aMs = $a['response_ms'];
            $bMs = $b['response_ms'];
            if ($aMs === null && $bMs !== null) {
                return 1;
            }
            if ($aMs !== null && $bMs === null) {
                return -1;
            }
            if ($aMs !== null && $bMs !== null && $aMs !== $bMs) {
                return $aMs <=> $bMs;
            }

            return $a['joined_ts'] <=> $b['joined_ts'];
        });

        foreach ($rows as $i => &$row) {
            $row['rank'] = $i + 1;
        }
        unset($row);

        return $rows;
    }

    protected function previousQuestionId(QuizSession $session): ?int
    {
        if (! $session->current_question_id) {
            return null;
        }

        $session->loadMissing('quiz.questions');
        $current = $session->quiz->questions->firstWhere('id', (int) $session->current_question_id);
        if (! $current) {
            return null;
        }

        $previous = $session->quiz->questions
            ->filter(function (QuizQuestion $q) use ($current) {
                return $q->sort_order < $current->sort_order
                    || ((int) $q->sort_order === (int) $current->sort_order && (int) $q->id < (int) $current->id);
            })
            ->sortBy([
                ['sort_order', 'asc'],
                ['id', 'asc'],
            ])
            ->last();

        return $previous?->id ? (int) $previous->id : null;
    }

    protected function responseMsForQuestion(QuizSession $session, int $userId, ?int $questionId): ?int
    {
        if (! $questionId) {
            return null;
        }

        $answer = $session->answers->first(
            fn (QuizSessionAnswer $a) => (int) $a->user_id === $userId
                && (int) $a->quiz_question_id === $questionId
        );

        if (! $answer || $answer->response_ms === null) {
            return null;
        }

        return (int) $answer->response_ms;
    }

    protected function pointsForQuestion(QuizSession $session, int $userId, ?int $questionId): int
    {
        if (! $questionId) {
            return 0;
        }

        $answer = $session->answers->first(
            fn (QuizSessionAnswer $a) => (int) $a->user_id === $userId
                && (int) $a->quiz_question_id === $questionId
        );

        return $answer ? (int) $answer->points_awarded : 0;
    }

    /**
     * @return array{0: list<array{option_id: int, count: int, is_correct: bool}>, 1: int}
     */
    protected function optionStatsForCurrentQuestion(QuizSession $session): array
    {
        $question = $session->currentQuestion;
        $answers = $session->answers->where('quiz_question_id', $session->current_question_id);
        $counts = [];
        $unanswered = 0;

        foreach ($answers as $answer) {
            if ($answer->quiz_option_id === null) {
                $unanswered++;

                continue;
            }
            $id = (int) $answer->quiz_option_id;
            $counts[$id] = ($counts[$id] ?? 0) + 1;
        }

        $stats = $question->options
            ->sortBy('sort_order')
            ->values()
            ->map(fn (QuizOption $o) => [
                'option_id' => (int) $o->id,
                'count' => $counts[(int) $o->id] ?? 0,
                'is_correct' => (bool) $o->is_correct,
            ])
            ->all();

        return [$stats, $unanswered];
    }

    /**
     * @param  array<string, mixed>  $mine
     * @return array<string, bool>
     */
    protected function resultContextForPlayer(QuizSession $session, QuizSessionAnswer $answer, array $mine): array
    {
        $limitMs = max(1, (int) ($session->currentQuestion?->time_limit_seconds ?? 20) * 1000);
        $missed = $answer->quiz_option_id === null;
        $correct = ! $missed && (bool) $answer->is_correct;
        $responseMs = $answer->response_ms;
        $fast = $correct && $responseMs !== null && (int) $responseMs <= (int) floor($limitMs * 0.5);
        $rankDelta = (int) ($mine['rank_delta'] ?? 0);

        return [
            'correct' => $correct,
            'fast' => $fast,
            'streak' => $correct && (int) $answer->streak_after >= 3,
            'rank_up' => $rankDelta > 0,
            'rank_down' => $rankDelta < 0,
            'big_jump' => $rankDelta >= 3,
            'missed' => $missed,
        ];
    }

    /**
     * @return array{0: int, 1: int}
     */
    protected function visiblePlayerStats(QuizSession $session, QuizSessionPlayer $player, bool $hideLiveScores): array
    {
        if (! $hideLiveScores || ! $session->current_question_id) {
            return [(int) $player->score, (int) $player->streak];
        }

        $current = $session->answers
            ->first(fn (QuizSessionAnswer $a) => (int) $a->user_id === (int) $player->user_id
                && (int) $a->quiz_question_id === (int) $session->current_question_id);

        if (! $current) {
            return [(int) $player->score, (int) $player->streak];
        }

        $previous = $session->answers
            ->filter(fn (QuizSessionAnswer $a) => (int) $a->user_id === (int) $player->user_id
                && (int) $a->quiz_question_id !== (int) $session->current_question_id)
            ->sortByDesc('id')
            ->first();

        return [
            max(0, (int) $player->score - (int) $current->points_awarded),
            (int) ($previous?->streak_after ?? 0),
        ];
    }

    public function basePoints(int $pointsBase, int $remainingMs, int $limitMs): int
    {
        $ratio = $limitMs > 0 ? ($remainingMs / $limitMs) : 0;
        $ratio = max(0.5, min(1.0, $ratio));

        return (int) round($pointsBase * $ratio);
    }

    /**
     * Existing speed + streak result as if this answer were correct.
     * Double/Bonus wrap this value; they do not replace it.
     */
    protected function normalAnswerPoints(QuizQuestion $question, int $remainingMs, int $limitMs, int $currentStreak): int
    {
        $base = $this->basePoints((int) $question->points_base, $remainingMs, $limitMs);

        return (int) round($base * $this->streakMultiplier($currentStreak + 1));
    }

    public function streakMultiplier(int $streak): float
    {
        if ($streak >= 5) {
            return 2.0;
        }
        if ($streak >= 3) {
            return 1.5;
        }
        if ($streak >= 2) {
            return 1.2;
        }

        return 1.0;
    }

    protected function findNextQuestion(QuizSession $session): ?QuizQuestion
    {
        $session->unsetRelation('currentQuestion');
        $current = $session->currentQuestion;

        if (! $current) {
            return $session->quiz->questions()->orderBy('sort_order')->orderBy('id')->first();
        }

        return $session->quiz->questions()
            ->where(function ($q) use ($current) {
                $q->where('sort_order', '>', $current->sort_order)
                    ->orWhere(function ($inner) use ($current) {
                        $inner->where('sort_order', $current->sort_order)
                            ->where('id', '>', $current->id);
                    });
            })
            ->orderBy('sort_order')
            ->orderBy('id')
            ->first();
    }

    protected function seedPowerUps(QuizSession $session, User $user): void
    {
        foreach (QuizSessionPowerUp::TYPES as $type) {
            QuizSessionPowerUp::create([
                'quiz_session_id' => $session->id,
                'user_id' => $user->id,
                'type' => $type,
                'uses_remaining' => 1,
                'active_until_question_id' => null,
            ]);
        }
    }

    protected function applyEraser(QuizSession $session, QuizSessionPowerUp $powerUp): array
    {
        $question = QuizQuestion::with('options')->find($session->current_question_id);
        if (! $question) {
            return [];
        }

        $wrong = $question->options->where('is_correct', false)->values();
        if ($wrong->count() < 2) {
            return [];
        }

        $toErase = $wrong->shuffle()->take(2)->map(fn (QuizOption $o) => (int) $o->id)->values()->all();

        $powerUp->payload = array_merge($powerUp->payload ?? [], [
            'question_id' => (int) $question->id,
            'erased_option_ids' => $toErase,
        ]);
        $powerUp->save();

        return $toErase;
    }

    /**
     * @return array<int>
     */
    public function erasedOptionIdsForPlayer(QuizSession $session, User $user, QuizQuestion $question): array
    {
        $powerUp = QuizSessionPowerUp::query()
            ->where('quiz_session_id', $session->id)
            ->where('user_id', $user->id)
            ->where('type', QuizSessionPowerUp::TYPE_ERASER)
            ->where('active_until_question_id', $question->id)
            ->first();

        if (! $powerUp) {
            return [];
        }

        $payloadQuestionId = $powerUp->payload['question_id'] ?? null;
        if ($payloadQuestionId !== null && (int) $payloadQuestionId !== (int) $question->id) {
            return [];
        }

        $fromPayload = $powerUp->payload['erased_option_ids'] ?? null;
        if (is_array($fromPayload) && $fromPayload !== []) {
            return array_map('intval', $fromPayload);
        }

        // Legacy sessions stored eraser IDs only in cache.
        return array_map('intval', cache()->get($this->eraserCacheKey($session->id, (int) $user->id, $question->id), []));
    }

    protected function eraserCacheKey(int $sessionId, int $userId, int $questionId): string
    {
        return "quiz_eraser:{$sessionId}:{$userId}:{$questionId}";
    }

    protected function pendingPowerUp(QuizSession $session, User $user, string $type): ?QuizSessionPowerUp
    {
        return QuizSessionPowerUp::query()
            ->where('quiz_session_id', $session->id)
            ->where('user_id', $user->id)
            ->where('type', $type)
            ->where('active_until_question_id', $session->current_question_id)
            ->first();
    }

    protected function consumePowerUp(?QuizSessionPowerUp $powerUp): void
    {
        $powerUp?->update(['active_until_question_id' => null]);
    }

    protected function markMissingAnswersAsWrong(QuizSession $session): void
    {
        if (! $session->current_question_id) {
            return;
        }

        $players = QuizSessionPlayer::query()
            ->where('quiz_session_id', $session->id)
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $answeredUserIds = QuizSessionAnswer::query()
            ->where('quiz_session_id', $session->id)
            ->where('quiz_question_id', $session->current_question_id)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        foreach ($players as $player) {
            if (in_array((int) $player->user_id, $answeredUserIds, true)) {
                continue;
            }

            $user = User::find($player->user_id);
            if (! $user) {
                continue;
            }

            $freeze = $this->pendingPowerUp($session, $user, QuizSessionPowerUp::TYPE_STREAK_FREEZE);
            $double = $this->pendingPowerUp($session, $user, QuizSessionPowerUp::TYPE_DOUBLE);
            $bonus = $this->pendingPowerUp($session, $user, QuizSessionPowerUp::TYPE_BONUS);
            $powerUpUsed = null;
            $newStreak = 0;

            if ($freeze) {
                $newStreak = $player->streak;
                $powerUpUsed = QuizSessionPowerUp::TYPE_STREAK_FREEZE;
                $this->consumePowerUp($freeze);
            } else {
                $player->streak = 0;
                $player->save();
            }

            if ($newStreak !== $player->streak) {
                $player->streak = $newStreak;
                $player->save();
            }

            if ($double) {
                $this->consumePowerUp($double);
                $powerUpUsed = $powerUpUsed ?? QuizSessionPowerUp::TYPE_DOUBLE;
            }

            if ($bonus) {
                $this->consumePowerUp($bonus);
                $powerUpUsed = $powerUpUsed ?? QuizSessionPowerUp::TYPE_BONUS;
            }

            QuizSessionAnswer::firstOrCreate(
                [
                    'quiz_session_id' => $session->id,
                    'quiz_question_id' => $session->current_question_id,
                    'user_id' => $player->user_id,
                ],
                [
                    'quiz_option_id' => null,
                    'is_correct' => false,
                    'points_awarded' => 0,
                    'streak_after' => $player->streak,
                    'power_up_used' => $powerUpUsed,
                    'answered_at' => now(),
                    'response_ms' => null,
                ]
            );
        }
    }

    protected function generateUniquePin(): string
    {
        do {
            $pin = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $exists = QuizSession::query()
                ->where('pin', $pin)
                ->where('status', '!=', QuizSession::STATUS_FINISHED)
                ->exists();
        } while ($exists);

        return $pin;
    }

    protected function assertHost(QuizSession $session, User $host): void
    {
        if ((int) $session->host_user_id !== (int) $host->id) {
            throw new AuthorizationException('Only the host can perform this action.');
        }
    }

    /**
     * Frozen identity for a session player. Later profile edits do not change this.
     *
     * @return array<string, mixed>
     */
    protected function playerIdentitySnapshot(User $user): array
    {
        return [
            'display_name' => $user->displayName(),
            'profile_picture' => PublicStorageUrl::canonicalize($user->profile_picture),
            'profile_picture_crop' => MediaCropNormalizer::normalize(
                is_array($user->profile_picture_crop) ? $user->profile_picture_crop : null
            ),
            'quiz_accessory_id' => QuizAccessories::normalize($user->quiz_accessory_id),
            'score' => 0,
            'streak' => 0,
            'joined_at' => now(),
            'last_seen_at' => now(),
        ];
    }

    protected function touchPlayerLastSeen(QuizSession $session, User $user): void
    {
        QuizSessionPlayer::query()
            ->where('quiz_session_id', $session->id)
            ->where('user_id', $user->id)
            ->update(['last_seen_at' => now()]);
    }

    protected function playerWasPresentAtFinish(?QuizSessionPlayer $player): bool
    {
        if (! $player?->last_seen_at) {
            return false;
        }

        $grace = max(1, (int) config('quiz.player_presence_grace_seconds', 20));

        return $player->last_seen_at->gte(now()->subSeconds($grace));
    }

    protected function awardQuizCompletionExp(QuizSession $session): void
    {
        $session->loadMissing(['players', 'answers', 'quiz.questions']);

        if ($session->mode !== QuizSession::MODE_LIVE) {
            return;
        }

        if ($session->status !== QuizSession::STATUS_FINISHED) {
            return;
        }

        if ($session->players->isEmpty() || ! $session->current_question_id) {
            return;
        }

        $ranked = $this->rankLivePlayers($session, false);
        $playersByUserId = $session->players->keyBy(fn (QuizSessionPlayer $player) => (int) $player->user_id);
        $userIds = collect($ranked)->pluck('user_id')->filter()->unique()->all();
        $users = User::query()->whereIn('id', $userIds)->get()->keyBy('id');

        foreach ($ranked as $row) {
            $user = $users->get($row['user_id']);
            $player = $playersByUserId->get((int) $row['user_id']);
            if (! $user || ! $this->playerWasPresentAtFinish($player)) {
                continue;
            }

            $amount = self::completionExpForRank((int) $row['rank']);
            if ($amount < 1) {
                continue;
            }

            $this->gamification->offer(
                $user,
                self::COMPLETION_EXP_ACTION,
                self::COMPLETION_EXP_SOURCE,
                (string) $session->id,
                ['rank' => (int) $row['rank']],
                $amount,
            );
        }
    }

    /**
     * @return array{amount: int, status: string}|null
     */
    protected function viewerExpReward(QuizSession $session, User $viewer): ?array
    {
        $reward = ExpReward::query()
            ->where('user_id', $viewer->id)
            ->where('action_key', self::COMPLETION_EXP_ACTION)
            ->where('source_type', self::COMPLETION_EXP_SOURCE)
            ->where('source_id', (string) $session->id)
            ->first();

        if (! $reward) {
            return null;
        }

        return [
            'amount' => (int) $reward->amount,
            'status' => $reward->status,
        ];
    }

    protected function assertAsyncSessionPlayable(QuizSession $session, User $user): void
    {
        $session->loadMissing('quiz');
        if ($session->is_preview) {
            if ((int) $session->quiz->user_id !== (int) $user->id) {
                throw ValidationException::withMessages([
                    'quiz' => 'Only the quiz creator can play this preview.',
                ]);
            }

            return;
        }

        $this->assertSelfPacedPlayOpen($session->quiz);
        $this->assertNotSelfPacedCreator($session->quiz, $user);
    }

    protected function assertSelfPacedPreviewAllowed(Quiz $quiz, User $user): void
    {
        if ((int) $quiz->user_id !== (int) $user->id) {
            throw ValidationException::withMessages([
                'quiz' => 'Only the quiz creator can start a self-paced preview.',
            ]);
        }

        if ($quiz->status !== Quiz::STATUS_PUBLISHED) {
            throw ValidationException::withMessages([
                'quiz' => 'This quiz is not published for self-paced play.',
            ]);
        }
    }

    protected function assertNotSelfPacedCreator(Quiz $quiz, User $user): void
    {
        if ((int) $quiz->user_id === (int) $user->id) {
            throw ValidationException::withMessages([
                'quiz' => 'The quiz creator cannot play this as a self-paced attempt. Use Preview instead.',
            ]);
        }
    }

    protected function assertSelfPacedPlayOpen(Quiz $quiz): void
    {
        if ($quiz->status !== Quiz::STATUS_PUBLISHED) {
            throw ValidationException::withMessages([
                'quiz' => 'This quiz is not published for self-paced play.',
            ]);
        }

        if ($quiz->selfPacedDeadlineHasPassed()) {
            throw ValidationException::withMessages([
                'quiz' => 'The self-paced deadline for this quiz has passed.',
            ]);
        }
    }

    protected function defaultRelations(): array
    {
        return ['quiz.questions.options', 'players', 'host', 'currentQuestion.options', 'answers', 'powerUps'];
    }

    protected function broadcast(QuizSession $session, string $event): void
    {
        try {
            event(new QuizSessionStateChanged($session->id, $event));
        } catch (\Throwable) {
            // Broadcasting may be unavailable in local/test without Reverb.
        }
    }
}
