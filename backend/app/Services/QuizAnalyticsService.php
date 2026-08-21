<?php

namespace App\Services;

use App\Models\ExpReward;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\QuizSessionAnswer;
use App\Models\QuizSessionPlayer;
use App\Models\QuizSessionPowerUp;
use App\Models\User;
use App\Support\PublicStorageUrl;
use App\Support\QuizAccessories;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class QuizAnalyticsService
{
    /**
     * Read-only post-game report from persisted session/answer/player rows.
     * Works for any finished session (live is the primary path). Async sessions
     * are not given a separate analytics pipeline and still have no power-ups.
     */
    public function __construct(
        protected QuizGameService $game,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function forSession(QuizSession $session, User $viewer): array
    {
        $isHost = (int) $session->host_user_id === (int) $viewer->id;
        $session->loadMissing('quiz');
        $isOwner = (int) $session->quiz->user_id === (int) $viewer->id;
        $isPlayer = $session->players()->where('user_id', $viewer->id)->exists();
        if (! $isHost && ! $isOwner && ! $isPlayer) {
            throw new AuthorizationException('You cannot view analytics for this session.');
        }

        if ($session->is_preview) {
            throw ValidationException::withMessages([
                'session' => 'Preview sessions do not have analytics.',
            ]);
        }

        if ($session->status !== QuizSession::STATUS_FINISHED) {
            throw ValidationException::withMessages([
                'session' => 'Analytics are available after the game finishes.',
            ]);
        }

        $session->load([
            'quiz.questions' => fn ($q) => $q->orderBy('sort_order')->orderBy('id'),
            'players',
            'answers',
            'powerUps',
        ]);

        $isPlayer = $session->players->contains(
            fn (QuizSessionPlayer $player) => (int) $player->user_id === (int) $viewer->id
        );
        $isSelfPaced = $session->mode === QuizSession::MODE_ASYNC && ! $session->is_preview;
        $showHostPayload = $isSelfPaced ? false : ($isHost || $isOwner);

        $questions = $session->quiz->questions->values();
        $players = $session->players;
        $answersByUser = $session->answers->groupBy(fn (QuizSessionAnswer $a) => (int) $a->user_id);
        $powerUpsByUser = $session->powerUps->groupBy(fn (QuizSessionPowerUp $p) => (int) $p->user_id);

        $openingRanks = $this->ranksFor($players, fn () => 0, fn () => null);
        $finalRanks = $this->ranksFor(
            $players,
            fn (QuizSessionPlayer $p) => (int) $p->score,
            fn (QuizSessionPlayer $p) => $this->lastResponseMs($answersByUser->get((int) $p->user_id) ?? collect(), $questions),
        );

        $rankAfterByQuestion = $this->rankAfterEachQuestion($players, $questions, $answersByUser, $openingRanks);

        $playerPayloads = [];
        foreach ($players as $player) {
            $userId = (int) $player->user_id;
            $answers = $answersByUser->get($userId) ?? collect();
            $powerUps = $powerUpsByUser->get($userId) ?? collect();
            $playerPayloads[] = $this->serializePlayer(
                $player,
                $questions,
                $answers,
                $powerUps,
                $openingRanks[$userId] ?? 1,
                $finalRanks[$userId] ?? 1,
                $rankAfterByQuestion,
                includeQuestions: $showHostPayload || $userId === (int) $viewer->id,
            );
        }

        usort($playerPayloads, fn (array $a, array $b) => $a['rank'] <=> $b['rank']);

        $answeredTimes = [];
        $answeredCount = 0;
        $correctCount = 0;
        foreach ($playerPayloads as $row) {
            $answeredCount += $row['correct'] + $row['wrong'];
            $correctCount += $row['correct'];
            foreach ($row['response_times'] as $ms) {
                $answeredTimes[] = $ms;
            }
        }

        $winner = $playerPayloads[0] ?? null;

        $me = collect($playerPayloads)->firstWhere('user_id', (int) $viewer->id);
        $expReward = $isPlayer ? $this->viewerExpReward($session, $viewer) : null;

        return [
            'session' => [
                'id' => $session->id,
                'quiz_id' => (int) $session->quiz_id,
                'title' => $session->quiz->title,
                'mode' => $session->mode,
                'status' => $session->status,
                'hosted_at' => $session->created_at?->toIso8601String(),
                'finished_at' => $session->finished_at?->toIso8601String() ?? ($session->status === QuizSession::STATUS_FINISHED ? $session->updated_at?->toIso8601String() : null),
                'question_count' => $questions->count(),
                'player_count' => $players->count(),
            ],
            'viewer' => [
                'user_id' => $viewer->id,
                'is_host' => $showHostPayload,
                'is_player' => $isPlayer,
            ],
            'summary' => [
                'average_accuracy' => $answeredCount > 0 ? round($correctCount / $answeredCount, 4) : 0,
                'average_response_ms' => $answeredTimes === [] ? null : (int) round(array_sum($answeredTimes) / count($answeredTimes)),
                'winner' => $winner ? [
                    'user_id' => $winner['user_id'],
                    'display_name' => $winner['display_name'],
                    'score' => $winner['score'],
                ] : null,
            ],
            'question_quality' => $showHostPayload ? $this->questionQuality($questions, $playerPayloads) : [],
            'players' => $showHostPayload
                ? array_map(fn (array $row) => $this->publicPlayerRow($row, true), $playerPayloads)
                : [],
            'me' => $me ? array_merge($this->publicPlayerRow($me, true), [
                'exp_earned' => $expReward['amount'] ?? null,
                'exp_status' => $expReward['status'] ?? null,
            ]) : null,
        ];
    }

    /**
     * Creator live history plus a compact self-paced summary.
     *
     * @return array<string, mixed>
     */
    public function historyForQuiz(Quiz $quiz, User $viewer): array
    {
        $this->assertQuizOwner($quiz, $viewer);

        $quiz->loadMissing(['questions', 'owner:id,name,full_name,email,company_id']);

        $liveSessions = $quiz->sessions()
            ->where('mode', QuizSession::MODE_LIVE)
            ->with(['host:id,name,full_name', 'players'])
            ->withCount('players')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn (QuizSession $session) => $this->serializeLiveHistoryRow($session))
            ->all();

        $asyncSessions = $quiz->sessions()
            ->selfPaced()
            ->get(['id', 'status']);

        return [
            'quiz' => [
                'id' => $quiz->id,
                'title' => $quiz->title,
                'description' => $quiz->description,
                'status' => $quiz->status,
                'created_at' => $quiz->created_at?->toIso8601String(),
                'updated_at' => $quiz->updated_at?->toIso8601String(),
                'question_count' => $quiz->questions->count(),
                'async_power_ups_enabled' => (bool) $quiz->async_power_ups_enabled,
                'async_deadline_at' => $quiz->async_deadline_at?->toIso8601String(),
            ],
            'live_sessions' => $liveSessions,
            'self_paced' => $this->selfPacedSummary($quiz, $asyncSessions),
        ];
    }

    /**
     * Aggregated self-paced report. Quiz creator only — no public leaderboard.
     *
     * @return array<string, mixed>
     */
    public function selfPacedForQuiz(Quiz $quiz, User $viewer): array
    {
        $this->assertQuizOwner($quiz, $viewer);

        $quiz->load([
            'questions' => fn ($q) => $q->orderBy('sort_order')->orderBy('id'),
            'owner:id,name,full_name,email,company_id',
        ]);

        $sessions = $quiz->sessions()
            ->selfPaced()
            ->with(['players', 'answers', 'powerUps'])
            ->orderByDesc('created_at')
            ->get();

        $finished = $sessions->where('status', QuizSession::STATUS_FINISHED)->values();
        $inProgress = $sessions->where('status', '!=', QuizSession::STATUS_FINISHED);
        $questions = $quiz->questions->values();

        $participants = [];
        $playerPayloads = [];

        foreach ($finished as $session) {
            $player = $session->players->first();
            if (! $player) {
                continue;
            }

            $answers = $session->answers->where('user_id', (int) $player->user_id)->values();
            $powerUps = $session->powerUps->where('user_id', (int) $player->user_id)->values();
            $payload = $this->serializePlayer(
                $player,
                $questions,
                $answers,
                $powerUps,
                1,
                1,
                [],
                includeQuestions: true,
            );
            $payload['session_id'] = $session->id;
            $payload['completed_at'] = $session->finished_at?->toIso8601String()
                ?? $session->updated_at?->toIso8601String();
            $playerPayloads[] = $payload;
        }

        usort($playerPayloads, function (array $a, array $b) {
            $score = ((int) $b['score']) <=> ((int) $a['score']);
            if ($score !== 0) {
                return $score;
            }

            $aTime = $a['average_response_ms'] ?? PHP_INT_MAX;
            $bTime = $b['average_response_ms'] ?? PHP_INT_MAX;

            return $aTime <=> $bTime;
        });

        $answeredTimes = [];
        $answeredCount = 0;
        $correctCount = 0;
        $scores = [];
        foreach ($playerPayloads as $index => $row) {
            $row['rank'] = $index + 1;
            $answeredCount += $row['correct'] + $row['wrong'];
            $correctCount += $row['correct'];
            $scores[] = (int) $row['score'];
            foreach ($row['response_times'] ?? [] as $ms) {
                $answeredTimes[] = $ms;
            }

            $public = $this->publicPlayerRow($row, true);
            $public['session_id'] = $row['session_id'];
            $public['completed_at'] = $row['completed_at'];
            $participants[] = $public;
        }

        $winner = $participants[0] ?? null;

        return [
            'quiz' => [
                'id' => $quiz->id,
                'title' => $quiz->title,
                'status' => $quiz->status,
                'question_count' => $questions->count(),
                'async_power_ups_enabled' => (bool) $quiz->async_power_ups_enabled,
            ],
            'viewer' => [
                'user_id' => $viewer->id,
                'is_host' => true,
                'is_player' => false,
            ],
            'summary' => [
                'completed_count' => count($participants),
                'in_progress_count' => $inProgress->count(),
                'eligible_count' => $this->eligibleSelfPacedCount($quiz),
                'average_accuracy' => $answeredCount > 0 ? round($correctCount / $answeredCount, 4) : 0,
                'average_score' => $scores === [] ? 0 : (int) round(array_sum($scores) / count($scores)),
                'average_response_ms' => $answeredTimes === [] ? null : (int) round(array_sum($answeredTimes) / count($answeredTimes)),
                'winner' => $winner ? [
                    'user_id' => $winner['user_id'],
                    'display_name' => $winner['display_name'],
                    'score' => $winner['score'],
                ] : null,
            ],
            'question_quality' => $this->questionQuality($questions, $playerPayloads),
            'participants' => $participants,
            'in_progress' => $sessions
                ->where('status', '!=', QuizSession::STATUS_FINISHED)
                ->values()
                ->map(function (QuizSession $session) {
                    $player = $session->players->first();

                    return [
                        'session_id' => $session->id,
                        'user_id' => $player ? (int) $player->user_id : null,
                        'display_name' => $player?->display_name ?: 'Player',
                        'started_at' => $session->created_at?->toIso8601String(),
                        'status' => $session->status,
                    ];
                })
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeLiveHistoryRow(QuizSession $session): array
    {
        $ended = $session->finished_at ?? ($session->status === QuizSession::STATUS_FINISHED ? $session->updated_at : null);
        $started = $session->created_at;
        $duration = ($started && $ended) ? max(0, $ended->getTimestamp() - $started->getTimestamp()) : null;

        return [
            'id' => $session->id,
            'status' => $session->status,
            'hosted_at' => $started?->toIso8601String(),
            'finished_at' => $ended?->toIso8601String(),
            'duration_seconds' => $duration,
            'player_count' => (int) ($session->players_count ?? $session->players->count()),
            'host_user_id' => (int) $session->host_user_id,
            'host_name' => $session->host?->displayName(),
            'can_delete' => ! $session->isLockedLiveHistory(),
        ];
    }

    /**
     * Compact owner extras for My Quizzes cards.
     *
     * @param  list<QuizSession>  $liveSessions
     * @return array<string, mixed>
     */
    public function serializeMineIndexExtras(Quiz $quiz, array $liveSessions, int $completedAsync, int $inProgressAsync): array
    {
        $recent = array_slice($liveSessions, 0, 3);

        return [
            'recent_live_sessions' => array_map(
                fn (QuizSession $session) => $this->serializeLiveHistoryRow($session),
                $recent
            ),
            'live_session_count' => count($liveSessions),
            'self_paced' => $this->selfPacedSummaryCounts($quiz, $completedAsync, $inProgressAsync),
        ];
    }

    /**
     * @return array{status: string, session_id: int}|null
     */
    public function serializeViewerAttempt(?QuizSession $session): ?array
    {
        if (! $session) {
            return null;
        }

        return [
            'status' => $session->status === QuizSession::STATUS_FINISHED ? 'completed' : 'in_progress',
            'session_id' => $session->id,
        ];
    }

    public function canManageQuiz(Quiz $quiz, User $viewer): bool
    {
        return PermissionService::canManageQuiz($viewer, $quiz);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, QuizSession>  $asyncSessions
     * @return array<string, mixed>|null
     */
    protected function selfPacedSummary(Quiz $quiz, $asyncSessions): ?array
    {
        $completed = $asyncSessions->where('status', QuizSession::STATUS_FINISHED)->count();
        $inProgress = $asyncSessions->where('status', '!=', QuizSession::STATUS_FINISHED)->count();

        return $this->selfPacedSummaryCounts($quiz, $completed, $inProgress);
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function selfPacedSummaryCounts(Quiz $quiz, int $completedAsync, int $inProgressAsync): ?array
    {
        if ($quiz->status !== Quiz::STATUS_PUBLISHED && $completedAsync === 0 && $inProgressAsync === 0) {
            return null;
        }

        return [
            'completed_count' => $completedAsync,
            'in_progress_count' => $inProgressAsync,
            'eligible_count' => $this->eligibleSelfPacedCount($quiz),
        ];
    }

    protected function assertQuizOwner(Quiz $quiz, User $viewer): void
    {
        if ((int) $quiz->user_id !== (int) $viewer->id) {
            throw new AuthorizationException('You cannot view analytics for this quiz.');
        }
    }

    protected function eligibleSelfPacedCount(Quiz $quiz): ?int
    {
        $companyId = $quiz->relationLoaded('owner') && array_key_exists('company_id', $quiz->owner?->getAttributes() ?? [])
            ? $quiz->owner?->company_id
            : User::query()->whereKey($quiz->user_id)->value('company_id');
        if (! $companyId) {
            return null;
        }

        return User::query()
            ->where('is_approved', true)
            ->where('company_id', $companyId)
            ->count();
    }

    /**
     * @param  Collection<int, QuizQuestion>  $questions
     * @param  list<array<string, mixed>>  $playerPayloads
     * @return list<array<string, mixed>>
     */
    public function questionQuality(Collection $questions, array $playerPayloads): array
    {
        $rows = [];

        foreach ($questions as $index => $question) {
            $correct = 0;
            $wrong = 0;
            $missed = 0;
            $times = [];

            foreach ($playerPayloads as $player) {
                $qRow = collect($player['questions'] ?? [])->firstWhere('question_id', (int) $question->id);
                $result = $qRow['result'] ?? 'missed';
                if ($result === 'correct') {
                    $correct++;
                } elseif ($result === 'wrong') {
                    $wrong++;
                } else {
                    $missed++;
                }
                if (($qRow['response_ms'] ?? null) !== null) {
                    $times[] = (int) $qRow['response_ms'];
                }
            }

            $answered = $correct + $wrong;
            $accuracy = $answered > 0 ? round($correct / $answered, 4) : 0;

            $rows[] = [
                'index' => $index + 1,
                'question_id' => (int) $question->id,
                'prompt' => $question->prompt,
                'correct' => $correct,
                'wrong' => $wrong,
                'missed' => $missed,
                'accuracy' => $accuracy,
                'average_response_ms' => $times === [] ? null : (int) round(array_sum($times) / count($times)),
                'difficulty' => self::difficultyBand($accuracy, $answered),
            ];
        }

        return $rows;
    }

    public static function difficultyBand(float $accuracy, int $answered): ?string
    {
        if ($answered <= 0) {
            return null;
        }
        if ($accuracy >= 0.75) {
            return 'easy';
        }
        if ($accuracy >= 0.40) {
            return 'medium';
        }

        return 'hard';
    }

    /**
     * @return array{amount: int, status: string}|null
     */
    protected function viewerExpReward(QuizSession $session, User $viewer): ?array
    {
        $reward = ExpReward::query()
            ->where('user_id', $viewer->id)
            ->where('action_key', QuizGameService::COMPLETION_EXP_ACTION)
            ->where('source_type', QuizGameService::COMPLETION_EXP_SOURCE)
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

    /**
     * @param  Collection<int, QuizSessionPlayer>  $players
     * @param  Collection<int, QuizQuestion>  $questions
     * @param  Collection<int, Collection<int, QuizSessionAnswer>>  $answersByUser
     * @param  array<int, int>  $openingRanks
     * @return array<int, array<int, array{rank: int, rank_delta: int}>>
     */
    protected function rankAfterEachQuestion(Collection $players, Collection $questions, Collection $answersByUser, array $openingRanks): array
    {
        $cumulative = [];
        foreach ($players as $player) {
            $cumulative[(int) $player->user_id] = 0;
        }

        $previous = $openingRanks;
        $byQuestion = [];

        foreach ($questions as $question) {
            $questionId = (int) $question->id;
            foreach ($players as $player) {
                $userId = (int) $player->user_id;
                $answer = ($answersByUser->get($userId) ?? collect())
                    ->first(fn (QuizSessionAnswer $a) => (int) $a->quiz_question_id === $questionId);
                $cumulative[$userId] += (int) ($answer?->points_awarded ?? 0);
            }

            $ranks = $this->ranksFor(
                $players,
                fn (QuizSessionPlayer $p) => $cumulative[(int) $p->user_id],
                function (QuizSessionPlayer $p) use ($answersByUser, $questionId) {
                    $answer = ($answersByUser->get((int) $p->user_id) ?? collect())
                        ->first(fn (QuizSessionAnswer $a) => (int) $a->quiz_question_id === $questionId);

                    return $answer?->response_ms !== null ? (int) $answer->response_ms : null;
                },
            );

            foreach ($ranks as $userId => $rank) {
                $byQuestion[$questionId][$userId] = [
                    'rank' => $rank,
                    'rank_delta' => ($previous[$userId] ?? $rank) - $rank,
                ];
            }

            $previous = $ranks;
        }

        return $byQuestion;
    }

    /**
     * @param  Collection<int, QuizSessionPlayer>  $players
     * @param  callable(QuizSessionPlayer): int  $scoreFn
     * @param  callable(QuizSessionPlayer): ?int  $responseFn
     * @return array<int, int>
     */
    protected function ranksFor(Collection $players, callable $scoreFn, callable $responseFn): array
    {
        $rows = [];
        foreach ($players as $player) {
            $rows[] = [
                'player' => $player,
                'score' => (int) $scoreFn($player),
                'response_ms' => $responseFn($player),
                'joined_ts' => $player->joined_at?->getTimestampMs() ?? 0,
            ];
        }

        $ranked = $this->game->sortRankRows($rows);
        $out = [];
        foreach ($ranked as $row) {
            $out[(int) $row['player']->user_id] = (int) $row['rank'];
        }

        return $out;
    }

    /**
     * @param  Collection<int, QuizSessionAnswer>  $answers
     * @param  Collection<int, QuizQuestion>  $questions
     */
    protected function lastResponseMs(Collection $answers, Collection $questions): ?int
    {
        $last = $questions->last();
        if (! $last) {
            return null;
        }

        $answer = $answers->first(fn (QuizSessionAnswer $a) => (int) $a->quiz_question_id === (int) $last->id);

        return $answer?->response_ms !== null ? (int) $answer->response_ms : null;
    }

    /**
     * @param  Collection<int, QuizQuestion>  $questions
     * @param  Collection<int, QuizSessionAnswer>  $answers
     * @param  Collection<int, QuizSessionPowerUp>  $powerUps
     * @param  array<int, array<int, array{rank: int, rank_delta: int}>>  $rankAfterByQuestion
     * @return array<string, mixed>
     */
    protected function serializePlayer(
        QuizSessionPlayer $player,
        Collection $questions,
        Collection $answers,
        Collection $powerUps,
        int $openingRank,
        int $finalRank,
        array $rankAfterByQuestion,
        bool $includeQuestions,
    ): array {
        $byQuestion = $answers->keyBy(fn (QuizSessionAnswer $a) => (int) $a->quiz_question_id);
        $correct = 0;
        $wrong = 0;
        $missed = 0;
        $times = [];
        $bestStreak = 0;
        $questionRows = [];

        foreach ($questions as $index => $question) {
            $questionId = (int) $question->id;
            /** @var QuizSessionAnswer|null $answer */
            $answer = $byQuestion->get($questionId);
            $isMissed = ! $answer || $answer->quiz_option_id === null;
            $isCorrect = $answer && ! $isMissed && (bool) $answer->is_correct;

            if ($isMissed) {
                $missed++;
                $result = 'missed';
            } elseif ($isCorrect) {
                $correct++;
                $result = 'correct';
            } else {
                $wrong++;
                $result = 'wrong';
            }

            if ($answer?->response_ms !== null) {
                $times[] = (int) $answer->response_ms;
            }
            if ($answer) {
                $bestStreak = max($bestStreak, (int) $answer->streak_after);
            }

            $rankInfo = $rankAfterByQuestion[$questionId][(int) $player->user_id] ?? null;

            $questionRows[] = [
                'index' => $index + 1,
                'question_id' => $questionId,
                'result' => $result,
                'is_correct' => $isCorrect,
                'quiz_option_id' => $answer?->quiz_option_id,
                'response_ms' => $answer?->response_ms !== null ? (int) $answer->response_ms : null,
                'points_awarded' => (int) ($answer?->points_awarded ?? 0),
                'streak_after' => (int) ($answer?->streak_after ?? 0),
                'power_up_used' => $answer?->power_up_used,
                'rank_after' => $rankInfo['rank'] ?? null,
                'rank_delta' => $rankInfo['rank_delta'] ?? 0,
            ];
        }

        $answered = $correct + $wrong;
        $powerUpRows = $this->serializePowerUps($powerUps, $answers);
        $usedCount = count(array_filter($powerUpRows, fn (array $p) => $p['activated']));

        return [
            'user_id' => (int) $player->user_id,
            'display_name' => $player->display_name,
            'profile_picture' => PublicStorageUrl::canonicalize($player->profile_picture) ?? $player->profile_picture,
            'profile_picture_crop' => is_array($player->profile_picture_crop) ? $player->profile_picture_crop : null,
            'accessory_id' => QuizAccessories::normalize($player->quiz_accessory_id),
            'score' => (int) $player->score,
            'rank' => $finalRank,
            'opening_rank' => $openingRank,
            'rank_delta' => $openingRank - $finalRank,
            'accuracy' => $answered > 0 ? round($correct / $answered, 4) : 0,
            'correct' => $correct,
            'wrong' => $wrong,
            'missed' => $missed,
            'average_response_ms' => $times === [] ? null : (int) round(array_sum($times) / count($times)),
            'fastest_response_ms' => $times === [] ? null : min($times),
            'slowest_response_ms' => $times === [] ? null : max($times),
            'best_streak' => $bestStreak,
            'power_ups_used' => $usedCount,
            'power_ups_available' => count($powerUpRows),
            'power_ups' => $powerUpRows,
            'response_times' => $times,
            'questions' => $includeQuestions ? $questionRows : [],
        ];
    }

    /**
     * @param  Collection<int, QuizSessionPowerUp>  $powerUps
     * @param  Collection<int, QuizSessionAnswer>  $answers
     * @return list<array<string, mixed>>
     */
    protected function serializePowerUps(Collection $powerUps, Collection $answers): array
    {
        if ($powerUps->isEmpty()) {
            return [];
        }
        $byType = $powerUps->keyBy('type');
        $recorded = $answers->pluck('power_up_used')->filter()->countBy();

        $rows = [];
        foreach (QuizSessionPowerUp::TYPES as $type) {
            $row = $byType->get($type);
            $activated = $row && (int) $row->uses_remaining < 1;
            $recordedCount = (int) ($recorded[$type] ?? 0);
            $recordedCorrect = $answers
                ->filter(fn (QuizSessionAnswer $a) => $a->power_up_used === $type && (bool) $a->is_correct && $a->quiz_option_id !== null)
                ->count();

            $rows[] = [
                'type' => $type,
                'activated' => (bool) $activated,
                'recorded' => $recordedCount,
                'recorded_on_correct' => $recordedCorrect > 0,
            ];
        }

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    protected function publicPlayerRow(array $row, bool $includeQuestions): array
    {
        unset($row['response_times']);
        if (! $includeQuestions) {
            $row['questions'] = [];
            $row['power_ups'] = [];
        }

        return $row;
    }
}
