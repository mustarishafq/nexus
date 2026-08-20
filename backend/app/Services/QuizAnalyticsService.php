<?php

namespace App\Services;

use App\Models\ExpReward;
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
        if (! $isHost && ! $session->players()->where('user_id', $viewer->id)->exists()) {
            throw new AuthorizationException('You cannot view analytics for this session.');
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
                includeQuestions: $isHost || $userId === (int) $viewer->id,
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
                'title' => $session->quiz->title,
                'mode' => $session->mode,
                'status' => $session->status,
                'question_count' => $questions->count(),
                'player_count' => $players->count(),
            ],
            'viewer' => [
                'user_id' => $viewer->id,
                'is_host' => $isHost,
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
            'question_quality' => $isHost ? $this->questionQuality($questions, $playerPayloads) : [],
            'players' => $isHost
                ? array_map(fn (array $row) => $this->publicPlayerRow($row, true), $playerPayloads)
                : [],
            'me' => $me ? array_merge($this->publicPlayerRow($me, true), [
                'exp_earned' => $expReward['amount'] ?? null,
                'exp_status' => $expReward['status'] ?? null,
            ]) : null,
        ];
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
