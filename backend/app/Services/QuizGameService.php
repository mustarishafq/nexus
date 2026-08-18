<?php

namespace App\Services;

use App\Events\QuizSessionStateChanged;
use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\QuizSessionAnswer;
use App\Models\QuizSessionPlayer;
use App\Models\QuizSessionPowerUp;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class QuizGameService
{
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
            'sfx_pack' => $quiz->sfx_pack ?: 'soft',
        ]);

        $this->broadcast($session, 'session.created');

        return $session->fresh(['quiz.questions.options', 'players', 'host']);
    }

    public function joinLiveSession(string $pin, User $user): QuizSession
    {
        $session = QuizSession::query()
            ->where('pin', $pin)
            ->where('mode', QuizSession::MODE_LIVE)
            ->whereIn('status', [
                QuizSession::STATUS_LOBBY,
                QuizSession::STATUS_QUESTION,
                QuizSession::STATUS_REVEAL,
                QuizSession::STATUS_LEADERBOARD,
            ])
            ->first();

        if (! $session) {
            throw ValidationException::withMessages([
                'pin' => 'No open session found for that PIN.',
            ]);
        }

        if ($session->host_user_id === $user->id) {
            throw ValidationException::withMessages([
                'pin' => 'Hosts cannot join their own session as a player.',
            ]);
        }

        $player = QuizSessionPlayer::firstOrCreate(
            [
                'quiz_session_id' => $session->id,
                'user_id' => $user->id,
            ],
            [
                'display_name' => $user->displayName(),
                'score' => 0,
                'streak' => 0,
                'joined_at' => now(),
            ]
        );

        if ($player->wasRecentlyCreated) {
            $this->seedPowerUps($session, $user);
            $this->broadcast($session, 'player.joined');
        }

        return $session->fresh(['quiz', 'players', 'host']);
    }

    public function startSession(QuizSession $session, User $host): QuizSession
    {
        $this->assertHost($session, $host);

        if ($session->status !== QuizSession::STATUS_LOBBY) {
            throw ValidationException::withMessages([
                'session' => 'Session has already started.',
            ]);
        }

        $first = $session->quiz->questions()->orderBy('sort_order')->orderBy('id')->first();
        if (! $first) {
            throw ValidationException::withMessages([
                'session' => 'Quiz has no questions.',
            ]);
        }

        $session->update([
            'status' => QuizSession::STATUS_QUESTION,
            'current_question_id' => $first->id,
            'question_started_at' => now(),
        ]);

        $this->broadcast($session, 'question.started');

        return $session->fresh($this->defaultRelations());
    }

    public function revealQuestion(QuizSession $session, User $host): QuizSession
    {
        $this->assertHost($session, $host);

        if ($session->status !== QuizSession::STATUS_QUESTION) {
            throw ValidationException::withMessages([
                'session' => 'Nothing to reveal right now.',
            ]);
        }

        $this->markMissingAnswersAsWrong($session);

        $session->update(['status' => QuizSession::STATUS_REVEAL]);
        $this->broadcast($session, 'question.revealed');

        return $session->fresh($this->defaultRelations());
    }

    public function showLeaderboard(QuizSession $session, User $host): QuizSession
    {
        $this->assertHost($session, $host);

        if (! in_array($session->status, [QuizSession::STATUS_REVEAL, QuizSession::STATUS_QUESTION], true)) {
            throw ValidationException::withMessages([
                'session' => 'Leaderboard is not available in this state.',
            ]);
        }

        if ($session->status === QuizSession::STATUS_QUESTION) {
            $this->markMissingAnswersAsWrong($session);
        }

        $session->update(['status' => QuizSession::STATUS_LEADERBOARD]);
        $this->broadcast($session, 'leaderboard.updated');

        return $session->fresh($this->defaultRelations());
    }

    public function nextQuestion(QuizSession $session, User $host): QuizSession
    {
        $this->assertHost($session, $host);

        if (! in_array($session->status, [
            QuizSession::STATUS_REVEAL,
            QuizSession::STATUS_LEADERBOARD,
            QuizSession::STATUS_QUESTION,
        ], true)) {
            throw ValidationException::withMessages([
                'session' => 'Cannot advance from this state.',
            ]);
        }

        if ($session->status === QuizSession::STATUS_QUESTION) {
            $this->markMissingAnswersAsWrong($session);
        }

        $next = $this->findNextQuestion($session);

        if (! $next) {
            $session->update([
                'status' => QuizSession::STATUS_FINISHED,
                'current_question_id' => $session->current_question_id,
                'question_started_at' => null,
                'pin' => null,
            ]);
            $this->broadcast($session, 'session.finished');

            return $session->fresh($this->defaultRelations());
        }

        $session->update([
            'status' => QuizSession::STATUS_QUESTION,
            'current_question_id' => $next->id,
            'question_started_at' => now(),
        ]);

        $this->broadcast($session, 'question.started');

        return $session->fresh($this->defaultRelations());
    }

    public function endSession(QuizSession $session, User $host): QuizSession
    {
        $this->assertHost($session, $host);

        $session->update([
            'status' => QuizSession::STATUS_FINISHED,
            'pin' => null,
            'question_started_at' => null,
        ]);

        $this->broadcast($session, 'session.finished');

        return $session->fresh($this->defaultRelations());
    }

    public function setMusicEnabled(QuizSession $session, User $host, bool $enabled): QuizSession
    {
        $this->assertHost($session, $host);
        $session->update(['music_enabled' => $enabled]);
        $this->broadcast($session, 'music.updated');

        return $session->fresh($this->defaultRelations());
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
        if ($session->status !== QuizSession::STATUS_QUESTION || ! $session->current_question_id) {
            throw ValidationException::withMessages([
                'session' => 'Answers are not open right now.',
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

        $existing = QuizSessionAnswer::query()
            ->where('quiz_session_id', $session->id)
            ->where('quiz_question_id', $session->current_question_id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            throw ValidationException::withMessages([
                'answer' => 'You already answered this question.',
            ]);
        }

        $question = QuizQuestion::with('options')->findOrFail($session->current_question_id);
        $option = $question->options->firstWhere('id', $optionId);

        if (! $option) {
            throw ValidationException::withMessages([
                'option_id' => 'Invalid option for this question.',
            ]);
        }

        $erasedIds = $this->erasedOptionIdsForPlayer($session, $user, $question);
        if (in_array($optionId, $erasedIds, true)) {
            throw ValidationException::withMessages([
                'option_id' => 'That option was removed by Eraser.',
            ]);
        }

        $startedAt = $session->question_started_at;
        $limitMs = max(1, $question->time_limit_seconds * 1000);
        $elapsedMs = $startedAt ? (int) max(0, now()->diffInMilliseconds($startedAt)) : $limitMs;
        $remainingMs = max(0, $limitMs - $elapsedMs);
        $timedOut = $elapsedMs >= $limitMs;

        $isCorrect = ! $timedOut && (bool) $option->is_correct;
        $powerUpUsed = null;

        $double = $this->pendingPowerUp($session, $user, QuizSessionPowerUp::TYPE_DOUBLE);
        $freeze = $this->pendingPowerUp($session, $user, QuizSessionPowerUp::TYPE_STREAK_FREEZE);

        if ($isCorrect) {
            $base = $this->basePoints($question->points_base, $remainingMs, $limitMs);
            $newStreak = $player->streak + 1;
            $multiplier = $this->streakMultiplier($newStreak);
            $points = (int) round($base * $multiplier);

            if ($double) {
                $points *= 2;
                $powerUpUsed = QuizSessionPowerUp::TYPE_DOUBLE;
                $double->update(['active_until_question_id' => null]);
            }

            $player->score += $points;
            $player->streak = $newStreak;
        } else {
            $points = 0;

            if ($freeze) {
                $powerUpUsed = QuizSessionPowerUp::TYPE_STREAK_FREEZE;
                $freeze->update(['active_until_question_id' => null]);
            } else {
                $player->streak = 0;
            }

            // Consume pending double even on wrong answers
            if ($double) {
                $double->update(['active_until_question_id' => null]);
                $powerUpUsed = $powerUpUsed ?? QuizSessionPowerUp::TYPE_DOUBLE;
            }
        }

        $player->save();

        $answer = QuizSessionAnswer::create([
            'quiz_session_id' => $session->id,
            'quiz_question_id' => $question->id,
            'user_id' => $user->id,
            'quiz_option_id' => $option->id,
            'is_correct' => $isCorrect,
            'points_awarded' => $points,
            'streak_after' => $player->streak,
            'power_up_used' => $powerUpUsed,
            'answered_at' => now(),
            'response_ms' => min($elapsedMs, $limitMs),
        ]);

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

        if ($session->status !== QuizSession::STATUS_QUESTION || ! $session->current_question_id) {
            throw ValidationException::withMessages([
                'session' => 'Power-ups can only be used during a question.',
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

        $powerUp = QuizSessionPowerUp::query()
            ->where('quiz_session_id', $session->id)
            ->where('user_id', $user->id)
            ->where('type', $type)
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

        $alreadyAnswered = QuizSessionAnswer::query()
            ->where('quiz_session_id', $session->id)
            ->where('quiz_question_id', $session->current_question_id)
            ->where('user_id', $user->id)
            ->exists();

        if ($alreadyAnswered) {
            throw ValidationException::withMessages([
                'type' => 'You already answered this question.',
            ]);
        }

        $erasedIds = [];

        DB::transaction(function () use ($powerUp, $session, $type, &$erasedIds) {
            $powerUp->uses_remaining = 0;
            $powerUp->active_until_question_id = $session->current_question_id;
            $powerUp->save();

            if ($type === QuizSessionPowerUp::TYPE_ERASER) {
                $erasedIds = $this->applyEraser($session, $powerUp->user_id);
            }
        });

        $this->broadcast($session, 'powerup.used');

        return [
            'power_up' => $powerUp->fresh(),
            'erased_option_ids' => $erasedIds,
        ];
    }

    public function startAsyncAttempt(Quiz $quiz, User $user): QuizSession
    {
        if ($quiz->status !== Quiz::STATUS_PUBLISHED) {
            throw ValidationException::withMessages([
                'quiz' => 'This quiz is not published for self-paced play.',
            ]);
        }

        $quiz->loadMissing('questions.options');

        if ($quiz->questions->isEmpty()) {
            throw ValidationException::withMessages([
                'quiz' => 'This quiz has no questions.',
            ]);
        }

        $session = QuizSession::create([
            'quiz_id' => $quiz->id,
            'host_user_id' => $quiz->user_id,
            'mode' => QuizSession::MODE_ASYNC,
            'pin' => null,
            'join_token' => Str::random(40),
            'status' => QuizSession::STATUS_QUESTION,
            'current_question_id' => $quiz->questions->first()->id,
            'question_started_at' => now(),
            'music_enabled' => false,
        ]);

        QuizSessionPlayer::create([
            'quiz_session_id' => $session->id,
            'user_id' => $user->id,
            'display_name' => $user->displayName(),
            'score' => 0,
            'streak' => 0,
            'joined_at' => now(),
        ]);

        return $session->fresh($this->defaultRelations());
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
            ]);
        }

        return [
            ...$result,
            'session' => $session->fresh($this->defaultRelations()),
        ];
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
        $showCorrect = $isHost || in_array($session->status, [
            QuizSession::STATUS_REVEAL,
            QuizSession::STATUS_LEADERBOARD,
            QuizSession::STATUS_FINISHED,
        ], true);

        $questions = $session->quiz->questions->map(function (QuizQuestion $q) use ($showCorrect, $session, $viewer, $isHost) {
            $erased = ($viewer && ! $isHost)
                ? $this->erasedOptionIdsForPlayer($session, $viewer, $q)
                : [];

            return [
                'id' => $q->id,
                'prompt' => $q->prompt,
                'time_limit_seconds' => $q->time_limit_seconds,
                'points_base' => $q->points_base,
                'sort_order' => $q->sort_order,
                'options' => $q->options
                    ->reject(fn (QuizOption $o) => in_array($o->id, $erased, true) && (int) $q->id === (int) $session->current_question_id && $session->status === QuizSession::STATUS_QUESTION)
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
                    'active' => $p->active_until_question_id === $session->current_question_id,
                ])
                ->all();

            if ($session->currentQuestion) {
                $erasedOptionIds = $this->erasedOptionIdsForPlayer($session, $viewer, $session->currentQuestion);
            }
        }

        $answerCount = $session->current_question_id
            ? $session->answers->where('quiz_question_id', $session->current_question_id)->count()
            : 0;

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
            'pin' => $isHost || $session->status === QuizSession::STATUS_LOBBY ? $session->pin : null,
            'join_token' => $session->join_token,
            'status' => $session->status,
            'current_question_id' => $session->current_question_id,
            'question_started_at' => $session->question_started_at?->toIso8601String(),
            'music_enabled' => (bool) $session->music_enabled,
            'bgm_theme' => $session->bgm_theme ?: 'party',
            'sfx_pack' => $session->sfx_pack ?: 'soft',
            'players' => $session->players->values()->map(fn (QuizSessionPlayer $p, int $i) => [
                'user_id' => $p->user_id,
                'display_name' => $p->display_name,
                'score' => $p->score,
                'streak' => $p->streak,
                'rank' => $i + 1,
                'joined_at' => $p->joined_at?->toIso8601String(),
            ]),
            'answer_count' => $answerCount,
            'player_count' => $session->players->count(),
            'is_host' => (bool) $isHost,
            'is_player' => (bool) $isPlayer,
            'my_answer' => $myAnswer ? [
                'quiz_option_id' => $myAnswer->quiz_option_id,
                'is_correct' => $showCorrect ? (bool) $myAnswer->is_correct : null,
                'points_awarded' => $showCorrect ? $myAnswer->points_awarded : null,
                'streak_after' => $myAnswer->streak_after,
            ] : null,
            'my_power_ups' => $myPowerUps,
            'erased_option_ids' => $erasedOptionIds,
            'created_at' => $session->created_at?->toIso8601String(),
        ];
    }

    public function basePoints(int $pointsBase, int $remainingMs, int $limitMs): int
    {
        $ratio = $limitMs > 0 ? ($remainingMs / $limitMs) : 0;
        $ratio = max(0.5, min(1.0, $ratio));

        return (int) round($pointsBase * $ratio);
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

    protected function applyEraser(QuizSession $session, int $userId): array
    {
        $question = QuizQuestion::with('options')->find($session->current_question_id);
        if (! $question) {
            return [];
        }

        $wrong = $question->options->where('is_correct', false)->values();
        if ($wrong->count() < 2) {
            return [];
        }

        $toErase = $wrong->shuffle()->take(2)->pluck('id')->all();

        // Store erased IDs on the eraser power-up row via a JSON-less approach:
        // reuse active_until_question_id already set; persist erased IDs in answers table isn't right.
        // Use cache keyed by session+user+question for the duration of the question.
        cache()->put($this->eraserCacheKey($session->id, $userId, $question->id), $toErase, now()->addHour());

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

        return cache()->get($this->eraserCacheKey($session->id, $user->id, $question->id), []);
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

    protected function markMissingAnswersAsWrong(QuizSession $session): void
    {
        if (! $session->current_question_id) {
            return;
        }

        $players = QuizSessionPlayer::query()
            ->where('quiz_session_id', $session->id)
            ->get();

        $answeredUserIds = QuizSessionAnswer::query()
            ->where('quiz_session_id', $session->id)
            ->where('quiz_question_id', $session->current_question_id)
            ->pluck('user_id')
            ->all();

        foreach ($players as $player) {
            if (in_array($player->user_id, $answeredUserIds, true)) {
                continue;
            }

            $user = User::find($player->user_id);
            if (! $user) {
                continue;
            }

            $freeze = $this->pendingPowerUp($session, $user, QuizSessionPowerUp::TYPE_STREAK_FREEZE);
            $powerUpUsed = null;
            $newStreak = 0;

            if ($freeze) {
                $newStreak = $player->streak;
                $powerUpUsed = QuizSessionPowerUp::TYPE_STREAK_FREEZE;
                $freeze->update(['active_until_question_id' => null]);
            } else {
                $player->streak = 0;
                $player->save();
            }

            if ($newStreak !== $player->streak) {
                $player->streak = $newStreak;
                $player->save();
            }

            $double = $this->pendingPowerUp($session, $user, QuizSessionPowerUp::TYPE_DOUBLE);
            $double?->update(['active_until_question_id' => null]);

            QuizSessionAnswer::create([
                'quiz_session_id' => $session->id,
                'quiz_question_id' => $session->current_question_id,
                'user_id' => $player->user_id,
                'quiz_option_id' => null,
                'is_correct' => false,
                'points_awarded' => 0,
                'streak_after' => $player->streak,
                'power_up_used' => $powerUpUsed,
                'answered_at' => now(),
                'response_ms' => null,
            ]);
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
            throw ValidationException::withMessages([
                'session' => 'Only the host can perform this action.',
            ]);
        }
    }

    /**
     * @return list<string>
     */
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
