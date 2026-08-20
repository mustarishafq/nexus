<?php

namespace Tests\Feature;

use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\QuizSessionPowerUp;
use App\Models\User;
use App\Services\QuizAnalyticsService;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuizAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    private function makeQuiz(User $owner, int $questionCount = 2): Quiz
    {
        $quiz = Quiz::create([
            'user_id' => $owner->id,
            'title' => 'Team Trivia',
            'description' => 'Fun quiz',
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

            QuizOption::create([
                'quiz_question_id' => $question->id,
                'label' => 'Correct',
                'is_correct' => true,
                'sort_order' => 0,
            ]);
            QuizOption::create([
                'quiz_question_id' => $question->id,
                'label' => 'Wrong A',
                'is_correct' => false,
                'sort_order' => 1,
            ]);
            QuizOption::create([
                'quiz_question_id' => $question->id,
                'label' => 'Wrong B',
                'is_correct' => false,
                'sort_order' => 2,
            ]);
            QuizOption::create([
                'quiz_question_id' => $question->id,
                'label' => 'Wrong C',
                'is_correct' => false,
                'sort_order' => 3,
            ]);
        }

        return $quiz->fresh(['questions.options']);
    }

    /**
     * @return array{host: User, player: User, quiz: Quiz, sessionId: int, pin: string}
     */
    private function bootLiveLobby(int $questionCount = 2, ?User $secondPlayer = null): array
    {
        $host = User::factory()->create(['is_approved' => true, 'name' => 'Host']);
        $player = User::factory()->create(['is_approved' => true, 'name' => 'Player']);
        $quiz = $this->makeQuiz($host, $questionCount);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');

        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        if ($secondPlayer) {
            $this->withToken($this->token($secondPlayer))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        }

        return compact('host', 'player', 'quiz', 'sessionId', 'pin');
    }

    /**
     * @param  callable(QuizSession, int): void  $onQuestion
     */
    private function playThroughToFinish(array $ctx, callable $onQuestion): void
    {
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")
            ->assertOk();

        $questionCount = $ctx['quiz']->questions->count();
        for ($i = 0; $i < $questionCount; $i++) {
            $session = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId']);
            $onQuestion($session, $i);
            $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
            $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
            $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
        }

        $this->assertSame(QuizSession::STATUS_FINISHED, QuizSession::findOrFail($ctx['sessionId'])->status);
    }

    public function test_analytics_rejected_until_finished(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->assertStatus(422);
    }

    public function test_unauthorized_user_cannot_view_analytics(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->playThroughToFinish($ctx, function (QuizSession $session) use ($ctx) {
            $correct = $session->currentQuestion->options->firstWhere('is_correct', true);
            $this->withToken($this->token($ctx['player']))
                ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correct->id]);
        });

        $stranger = User::factory()->create(['is_approved' => true]);
        $this->withToken($this->token($stranger))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->assertForbidden();
    }

    public function test_host_and_player_analytics_for_finished_live_session(): void
    {
        $ctx = $this->bootLiveLobby(2);
        $this->playThroughToFinish($ctx, function (QuizSession $session, int $index) use ($ctx) {
            $correct = $session->currentQuestion->options->firstWhere('is_correct', true);
            $wrong = $session->currentQuestion->options->firstWhere('is_correct', false);
            if ($index === 0) {
                $this->withToken($this->token($ctx['player']))
                    ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'double']);
                $this->withToken($this->token($ctx['player']))
                    ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correct->id]);
            } else {
                $this->withToken($this->token($ctx['player']))
                    ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $wrong->id]);
            }
        });

        $hostView = $this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->assertOk()
            ->json();

        $this->assertTrue($hostView['viewer']['is_host']);
        $this->assertSame(2, $hostView['session']['question_count']);
        $this->assertSame(1, $hostView['session']['player_count']);
        $this->assertCount(1, $hostView['players']);

        $row = $hostView['players'][0];
        $this->assertSame($ctx['player']->id, $row['user_id']);
        $this->assertSame(1, $row['correct']);
        $this->assertSame(1, $row['wrong']);
        $this->assertSame(0, $row['missed']);
        $this->assertEqualsWithDelta(0.5, $row['accuracy'], 0.0001);
        $this->assertSame($row['score'], QuizSession::find($ctx['sessionId'])->players()->first()->score);
        $this->assertSame(1, $row['best_streak']);
        $this->assertSame(1, $row['rank']);
        $this->assertNotNull($row['average_response_ms']);
        $this->assertNotNull($row['fastest_response_ms']);
        $this->assertNotNull($row['slowest_response_ms']);
        $this->assertSame($row['fastest_response_ms'], min($row['questions'][0]['response_ms'], $row['questions'][1]['response_ms']));
        $this->assertSame($row['slowest_response_ms'], max($row['questions'][0]['response_ms'], $row['questions'][1]['response_ms']));
        $this->assertCount(2, $row['questions']);
        $this->assertSame('correct', $row['questions'][0]['result']);
        $this->assertSame('wrong', $row['questions'][1]['result']);
        $this->assertGreaterThan(0, $row['questions'][0]['points_awarded']);
        $this->assertSame(0, $row['questions'][1]['points_awarded']);
        $this->assertSame(QuizSessionPowerUp::TYPE_DOUBLE, $row['questions'][0]['power_up_used']);
        $this->assertSame(1, $row['power_ups_used']);
        $this->assertSame(4, $row['power_ups_available']);
        $double = collect($row['power_ups'])->firstWhere('type', 'double');
        $this->assertTrue($double['activated']);
        $this->assertGreaterThan(0, $double['recorded']);
        $this->assertTrue($double['recorded_on_correct']);
        $this->assertSame($ctx['player']->id, $hostView['summary']['winner']['user_id']);
        $this->assertEqualsWithDelta(0.5, $hostView['summary']['average_accuracy'], 0.0001);

        $playerView = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->assertOk()
            ->json();

        $this->assertFalse($playerView['viewer']['is_host']);
        $this->assertTrue($playerView['viewer']['is_player']);
        $this->assertSame([], $playerView['players']);
        $this->assertSame($ctx['player']->id, $playerView['me']['user_id']);
        $this->assertCount(2, $playerView['me']['questions']);
        $this->assertSame($row['score'], $playerView['me']['score']);
        $this->assertSame($row['rank_delta'], $playerView['me']['rank_delta']);
    }

    public function test_player_cannot_see_another_player_question_breakdown(): void
    {
        $second = User::factory()->create(['is_approved' => true, 'name' => 'Second']);
        $ctx = $this->bootLiveLobby(1, $second);
        $this->playThroughToFinish($ctx, function (QuizSession $session) use ($ctx, $second) {
            $correct = $session->currentQuestion->options->firstWhere('is_correct', true);
            $this->withToken($this->token($ctx['player']))
                ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correct->id]);
            $this->withToken($this->token($second))
                ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correct->id]);
        });

        $view = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->assertOk()
            ->json();

        $this->assertSame($ctx['player']->id, $view['me']['user_id']);
        $this->assertCount(1, $view['me']['questions']);
        $this->assertSame([], $view['players']);
    }

    public function test_missed_questions_are_counted_and_excluded_from_response_averages(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->playThroughToFinish($ctx, function () {
            // timeout / miss — no answer
        });

        $row = $this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->assertOk()
            ->json('players.0');

        $this->assertSame(0, $row['correct']);
        $this->assertSame(0, $row['wrong']);
        $this->assertSame(1, $row['missed']);
        $this->assertSame(0, $row['accuracy']);
        $this->assertNull($row['average_response_ms']);
        $this->assertNull($row['fastest_response_ms']);
        $this->assertNull($row['slowest_response_ms']);
        $this->assertSame('missed', $row['questions'][0]['result']);
        $this->assertNull($row['questions'][0]['response_ms']);
        $this->assertSame(0, $row['questions'][0]['points_awarded']);
        $this->assertSame(0, $row['score']);
        $this->assertSame(0, $row['best_streak']);
    }

    public function test_best_streak_uses_answer_streak_after(): void
    {
        $ctx = $this->bootLiveLobby(2);
        $this->playThroughToFinish($ctx, function (QuizSession $session) use ($ctx) {
            $correct = $session->currentQuestion->options->firstWhere('is_correct', true);
            $this->withToken($this->token($ctx['player']))
                ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correct->id]);
        });

        $row = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->json('me');

        $this->assertSame(2, $row['correct']);
        $this->assertSame(2, $row['best_streak']);
        $this->assertEqualsWithDelta(1, $row['accuracy'], 0.0001);
        $this->assertSame(2, $row['questions'][1]['streak_after']);
    }

    public function test_rank_and_rank_delta_match_final_ranking(): void
    {
        $second = User::factory()->create(['is_approved' => true, 'name' => 'Amir']);
        $ctx = $this->bootLiveLobby(1, $second);

        $session = QuizSession::findOrFail($ctx['sessionId']);
        $session->players()->where('user_id', $ctx['player']->id)->update(['joined_at' => now()->subSeconds(20)]);
        $session->players()->where('user_id', $second->id)->update(['joined_at' => now()->subSeconds(5)]);

        $this->playThroughToFinish($ctx, function (QuizSession $session) use ($ctx, $second) {
            $correct = $session->currentQuestion->options->firstWhere('is_correct', true);
            $this->withToken($this->token($second))
                ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correct->id]);
        });

        $hostView = $this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->assertOk()
            ->json();

        $winner = collect($hostView['players'])->firstWhere('user_id', $second->id);
        $missed = collect($hostView['players'])->firstWhere('user_id', $ctx['player']->id);

        $this->assertSame(1, $winner['rank']);
        $this->assertSame(2, $missed['rank']);
        $this->assertSame(1, $winner['rank_delta']);
        $this->assertSame(-1, $missed['rank_delta']);
        $this->assertSame($second->id, $hostView['summary']['winner']['user_id']);
        $this->assertGreaterThan(0, $winner['score']);
        $this->assertSame(0, $missed['score']);
    }

    public function test_host_analytics_include_question_quality_and_player_does_not(): void
    {
        $second = User::factory()->create(['is_approved' => true, 'name' => 'Second']);
        $ctx = $this->bootLiveLobby(1, $second);

        $this->playThroughToFinish($ctx, function (QuizSession $session) use ($ctx, $second) {
            $correct = $session->currentQuestion->options->firstWhere('is_correct', true);
            $wrong = $session->currentQuestion->options->firstWhere('is_correct', false);
            $this->withToken($this->token($ctx['player']))
                ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correct->id]);
            $this->withToken($this->token($second))
                ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $wrong->id]);
        });

        $hostView = $this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->assertOk()
            ->json();

        $this->assertCount(1, $hostView['question_quality']);
        $quality = $hostView['question_quality'][0];
        $this->assertSame(1, $quality['index']);
        $this->assertSame('Question 0', $quality['prompt']);
        $this->assertSame(1, $quality['correct']);
        $this->assertSame(1, $quality['wrong']);
        $this->assertSame(0, $quality['missed']);
        $this->assertEqualsWithDelta(0.5, $quality['accuracy'], 0.0001);
        $this->assertNotNull($quality['average_response_ms']);
        $this->assertSame('medium', $quality['difficulty']);

        $playerView = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->assertOk()
            ->json();

        $this->assertSame([], $playerView['question_quality']);
        $this->assertSame([], $playerView['players']);
        $this->assertArrayNotHasKey('questions', $playerView['players'][0] ?? []);
    }

    public function test_question_quality_excludes_missed_from_accuracy_and_null_response_times(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->playThroughToFinish($ctx, function () {
            // miss
        });

        $quality = $this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->assertOk()
            ->json('question_quality.0');

        $this->assertSame(0, $quality['correct']);
        $this->assertSame(0, $quality['wrong']);
        $this->assertSame(1, $quality['missed']);
        $this->assertSame(0, $quality['accuracy']);
        $this->assertNull($quality['average_response_ms']);
        $this->assertNull($quality['difficulty']);
    }

    public function test_difficulty_band_boundaries(): void
    {
        $this->assertSame('easy', QuizAnalyticsService::difficultyBand(0.75, 4));
        $this->assertSame('medium', QuizAnalyticsService::difficultyBand(0.40, 5));
        $this->assertSame('hard', QuizAnalyticsService::difficultyBand(0.3999, 5));
        $this->assertNull(QuizAnalyticsService::difficultyBand(0, 0));
    }
}
