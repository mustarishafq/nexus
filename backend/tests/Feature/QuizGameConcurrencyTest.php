<?php

namespace Tests\Feature;

use App\Jobs\AdvanceQuizSessionJob;
use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\QuizSessionAnswer;
use App\Models\User;
use App\Services\QuizGameService;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\GrantsUserRoleQuizPlayAccess;
use Tests\TestCase;

/**
 * Live Quiz concurrency / scalability regression coverage.
 *
 * Honesty note on what "concurrency" means here: PHPUnit feature tests run
 * synchronously in a single PHP process, so these cannot reproduce genuine
 * OS-level simultaneous HTTP requests or true network race conditions. What
 * they verify instead — which is what actually determines correctness under
 * real concurrency — is that the database-level guarantees (unique
 * constraints, row locks via lockForUpdate, idempotent status guards) hold
 * up when the same operations that would be concurrent in production are
 * fired back-to-back with no gap between them, and that the new
 * server-authoritative tick mechanism (AdvanceQuizSessionJob) is safe when
 * triggered multiple times / after the state has already moved on. Real
 * network-level/multi-process concurrency remains a residual risk, called
 * out explicitly in the task's final summary.
 */
class QuizGameConcurrencyTest extends TestCase
{
    use RefreshDatabase;
    use GrantsUserRoleQuizPlayAccess;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    private function makeQuiz(User $owner, int $questionCount = 2): Quiz
    {
        $quiz = Quiz::create([
            'user_id' => $owner->id,
            'title' => 'Concurrency Trivia',
            'description' => 'Load test quiz',
            'status' => Quiz::STATUS_PUBLISHED,
        ]);

        for ($i = 0; $i < $questionCount; $i++) {
            $question = QuizQuestion::create([
                'quiz_id' => $quiz->id,
                'prompt' => "Question {$i}",
                'time_limit_seconds' => 20,
                'points_base' => 1000,
                'sort_order' => $i,
            ]);

            QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Correct', 'is_correct' => true, 'sort_order' => 0]);
            QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Wrong A', 'is_correct' => false, 'sort_order' => 1]);
        }

        return $quiz->fresh(['questions.options']);
    }

    /**
     * @return array{host: User, players: list<User>, sessionId: int, quiz: Quiz}
     */
    private function bootLiveSessionWithPlayers(int $playerCount, int $questionCount = 2): array
    {
        $host = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($host, $questionCount);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');

        $pin = QuizSession::findOrFail($sessionId)->pin;

        $players = [];
        for ($i = 0; $i < $playerCount; $i++) {
            $player = User::factory()->create(['is_approved' => true]);
            $this->withToken($this->token($player))
                ->postJson('/api/quiz-sessions/join', ['pin' => $pin])
                ->assertOk();
            $players[] = $player;
        }

        $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/start")
            ->assertOk();

        return ['host' => $host, 'players' => $players, 'sessionId' => $sessionId, 'quiz' => $quiz];
    }

    // --- A. Multiple simultaneous answers ---------------------------------

    public function test_eight_players_answering_back_to_back_are_all_recorded_correctly(): void
    {
        $this->assertManyPlayersAnswerCorrectly(8);
    }

    public function test_twenty_players_answering_back_to_back_are_all_recorded_correctly(): void
    {
        $this->assertManyPlayersAnswerCorrectly(20);
    }

    public function test_fifty_players_answering_back_to_back_are_all_recorded_correctly(): void
    {
        $this->assertManyPlayersAnswerCorrectly(50);
    }

    private function assertManyPlayersAnswerCorrectly(int $playerCount): void
    {
        ['players' => $players, 'sessionId' => $sessionId] = $this->bootLiveSessionWithPlayers($playerCount);
        $session = QuizSession::with('quiz.questions.options')->findOrFail($sessionId);
        $question = $session->quiz->questions->first();
        $correct = $question->options->firstWhere('is_correct', true);
        $wrong = $question->options->firstWhere('is_correct', false);

        foreach ($players as $index => $player) {
            $optionId = $index % 2 === 0 ? $correct->id : $wrong->id;
            $this->withToken($this->token($player))
                ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $optionId])
                ->assertOk();
        }

        // Exactly one answer row per player, no duplicates, no lost answers.
        $this->assertSame(
            $playerCount,
            QuizSessionAnswer::query()->where('quiz_session_id', $sessionId)->where('quiz_question_id', $question->id)->count()
        );
        $this->assertSame(
            $playerCount,
            QuizSessionAnswer::query()->where('quiz_session_id', $sessionId)->where('quiz_question_id', $question->id)->distinct()->count('user_id')
        );

        foreach ($players as $index => $player) {
            $answer = QuizSessionAnswer::query()->where('quiz_session_id', $sessionId)->where('user_id', $player->id)->first();
            $expectedCorrect = $index % 2 === 0;
            $this->assertSame($expectedCorrect, (bool) $answer->is_correct);
            $this->assertSame($expectedCorrect, $answer->points_awarded > 0);
        }

        $totalScore = (int) \App\Models\QuizSessionPlayer::query()->where('quiz_session_id', $sessionId)->sum('score');
        $totalPoints = (int) QuizSessionAnswer::query()->where('quiz_session_id', $sessionId)->sum('points_awarded');
        $this->assertSame($totalPoints, $totalScore);

        // Duplicate-answer protection still holds with this many rows already present.
        $this->withToken($this->token($players[0]))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
            ->assertStatus(422);
        $this->assertSame($playerCount, QuizSessionAnswer::query()->where('quiz_session_id', $sessionId)->count());

        // Session remains in a valid, servable state.
        $payload = $this->withToken($this->token($players[0]))
            ->getJson("/api/quiz-sessions/{$sessionId}")
            ->assertOk()
            ->json();
        $this->assertSame($playerCount, $payload['answer_count']);
        $this->assertSame($playerCount, $payload['player_count']);
    }

    // --- B. Simultaneous transition attempts -------------------------------

    public function test_multiple_simultaneous_reveal_calls_produce_exactly_one_transition(): void
    {
        ['host' => $host, 'sessionId' => $sessionId] = $this->bootLiveSessionWithPlayers(5);
        $token = $this->token($host);

        for ($i = 0; $i < 5; $i++) {
            $this->withToken($token)->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();
        }

        $session = QuizSession::findOrFail($sessionId);
        $this->assertSame(QuizSession::STATUS_REVEAL, $session->status);
    }

    public function test_multiple_simultaneous_next_question_calls_do_not_skip_a_question(): void
    {
        ['host' => $host, 'sessionId' => $sessionId] = $this->bootLiveSessionWithPlayers(5, 3);
        $token = $this->token($host);
        $this->withToken($token)->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();
        $this->withToken($token)->postJson("/api/quiz-sessions/{$sessionId}/leaderboard")->assertOk();

        $firstQuestionId = QuizSession::findOrFail($sessionId)->current_question_id;

        // Simulate 5 racing "next" triggers (e.g. a double-click plus the
        // lazy on-request path plus a tick job all landing close together).
        // Exactly one may legitimately advance the phase; once the session
        // is no longer in reveal/leaderboard, further "next" calls are
        // correctly rejected rather than skipping additional questions.
        $statusCodes = [];
        for ($i = 0; $i < 5; $i++) {
            $statusCodes[] = $this->withToken($token)->postJson("/api/quiz-sessions/{$sessionId}/next")->status();
        }
        $this->assertSame(1, count(array_filter($statusCodes, fn ($code) => $code === 200)));
        $this->assertTrue(collect($statusCodes)->every(fn ($code) => in_array($code, [200, 422], true)));

        $session = QuizSession::with('quiz.questions')->findOrFail($sessionId);
        $this->assertSame(QuizSession::STATUS_QUESTION, $session->status);
        $this->assertNotSame($firstQuestionId, $session->current_question_id);

        $secondQuestion = $session->quiz->questions->sortBy(['sort_order', 'id'])->values()->get(1);
        $this->assertSame($secondQuestion->id, $session->current_question_id, 'A race must not skip past the second question.');
    }

    public function test_stale_tick_job_no_ops_after_host_already_advanced_manually(): void
    {
        ['host' => $host, 'sessionId' => $sessionId] = $this->bootLiveSessionWithPlayers(3);
        $staleVersion = (int) QuizSession::findOrFail($sessionId)->state_version;

        // Host manually reveals before the job scheduled for the original
        // question deadline would have fired.
        $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/reveal")
            ->assertOk();

        $afterManualReveal = QuizSession::findOrFail($sessionId);
        $this->assertSame(QuizSession::STATUS_REVEAL, $afterManualReveal->status);
        $this->assertNotSame($staleVersion, $afterManualReveal->state_version);

        // The now-stale job for the original deadline fires late.
        (new AdvanceQuizSessionJob($sessionId, $staleVersion))->handle(app(QuizGameService::class));

        $after = QuizSession::findOrFail($sessionId);
        $this->assertSame($afterManualReveal->status, $after->status);
        $this->assertSame($afterManualReveal->state_version, $after->state_version);
        $this->assertSame(
            $afterManualReveal->phase_ends_at?->toIso8601String(),
            $after->phase_ends_at?->toIso8601String(),
            'A stale tick job must not reset the phase deadline that a real transition already set.'
        );
    }

    public function test_duplicate_tick_jobs_for_the_same_elapsed_deadline_only_transition_once(): void
    {
        ['sessionId' => $sessionId] = $this->bootLiveSessionWithPlayers(4);
        $version = (int) QuizSession::findOrFail($sessionId)->state_version;

        // Force the deadline into the past, as if a job fired late.
        QuizSession::query()->whereKey($sessionId)->update(['question_ends_at' => now()->subSeconds(5)]);

        $service = app(QuizGameService::class);

        // Two "workers" both picking up what looks like the same due job.
        (new AdvanceQuizSessionJob($sessionId, $version))->handle($service);
        $afterFirst = QuizSession::findOrFail($sessionId);

        (new AdvanceQuizSessionJob($sessionId, $version))->handle($service);
        $afterSecond = QuizSession::findOrFail($sessionId);

        $this->assertSame(QuizSession::STATUS_REVEAL, $afterFirst->status);
        $this->assertSame($afterFirst->status, $afterSecond->status);
        $this->assertSame($afterFirst->state_version, $afterSecond->state_version);
        $this->assertSame(
            $afterFirst->phase_ends_at?->toIso8601String(),
            $afterSecond->phase_ends_at?->toIso8601String(),
            'The second duplicate job must not re-run the transition (it would reset the reveal window).'
        );
    }

    // --- C. Concurrent polling around a deadline ---------------------------

    public function test_many_participants_polling_around_the_deadline_see_one_consistent_transition(): void
    {
        ['players' => $players, 'sessionId' => $sessionId] = $this->bootLiveSessionWithPlayers(15);
        QuizSession::query()->whereKey($sessionId)->update(['question_ends_at' => now()->subSecond()]);

        $statuses = [];
        foreach ($players as $player) {
            $payload = $this->withToken($this->token($player))
                ->getJson("/api/quiz-sessions/{$sessionId}")
                ->assertOk()
                ->json();
            $statuses[] = $payload['status'];
        }

        // Every participant's poll observed the same already-applied
        // transition, never a mix of some still on "question" and others
        // already moved to "reveal".
        $this->assertCount(1, array_unique($statuses));
        $this->assertSame(QuizSession::STATUS_REVEAL, $statuses[0]);
        $this->assertSame(QuizSession::STATUS_REVEAL, QuizSession::findOrFail($sessionId)->status);
    }

    // --- D/E. Missed realtime event & reconnect reconciliation -------------

    public function test_participant_away_through_multiple_transitions_reconciles_on_next_request(): void
    {
        ['host' => $host, 'players' => $players, 'sessionId' => $sessionId] = $this->bootLiveSessionWithPlayers(5, 3);
        $away = $players[0];
        $token = $this->token($host);

        // The "away" participant neither polls nor receives any broadcast
        // while the host drives the game through several phases.
        $this->withToken($token)->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();
        $this->withToken($token)->postJson("/api/quiz-sessions/{$sessionId}/leaderboard")->assertOk();
        $this->withToken($token)->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();

        $authoritative = QuizSession::findOrFail($sessionId);

        $payload = $this->withToken($this->token($away))
            ->getJson("/api/quiz-sessions/{$sessionId}")
            ->assertOk()
            ->json();

        $this->assertSame($authoritative->status, $payload['status']);
        $this->assertSame($authoritative->current_question_id, $payload['current_question_id']);
        $this->assertSame((int) $authoritative->state_version, $payload['state_version']);
    }

    // --- F. Large participant count -----------------------------------------

    public function test_two_hundred_players_session_serializes_and_answers_correctly(): void
    {
        $playerCount = 200;
        ['players' => $players, 'sessionId' => $sessionId] = $this->bootLiveSessionWithPlayers($playerCount);
        $session = QuizSession::with('quiz.questions.options')->findOrFail($sessionId);
        $question = $session->quiz->questions->first();
        $correct = $question->options->firstWhere('is_correct', true);

        foreach ($players as $player) {
            $this->withToken($this->token($player))
                ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
                ->assertOk();
        }

        $this->assertSame($playerCount, QuizSessionAnswer::query()->where('quiz_session_id', $sessionId)->count());

        DB::enableQueryLog();
        $start = microtime(true);
        $payload = $this->withToken($this->token($players[0]))
            ->getJson("/api/quiz-sessions/{$sessionId}")
            ->assertOk()
            ->json();
        $elapsedMs = (microtime(true) - $start) * 1000;
        $queryCount = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertCount($playerCount, $payload['players']);
        $this->assertSame($playerCount, $payload['answer_count']);

        fwrite(STDERR, sprintf(
            "\n[QuizGameConcurrencyTest] 200-player GET /quiz-sessions/{id}: %d queries, %.1fms\n",
            $queryCount,
            $elapsedMs
        ));

        // Not a hard perf budget (CI hardware varies) — a generous ceiling so
        // a future regression that reintroduces a per-player query (N+1) or
        // similar fails loudly instead of silently degrading at scale.
        $this->assertLessThan(60, $queryCount, 'Serializing a 200-player session should not scale query count with player count.');

        // Reveal + leaderboard still compute correctly at this scale.
        $host = User::find($session->host_user_id);
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();
        $leaderboardPayload = $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/leaderboard")
            ->assertOk()
            ->json();
        $this->assertCount($playerCount, $leaderboardPayload['players']);
        $topScore = collect($leaderboardPayload['players'])->max('score');
        $this->assertGreaterThan(0, $topScore);
        $ranks = collect($leaderboardPayload['players'])->pluck('rank')->sort()->values()->all();
        $this->assertSame(range(1, $playerCount), $ranks, 'Every player must have a unique, contiguous rank.');
    }
}
