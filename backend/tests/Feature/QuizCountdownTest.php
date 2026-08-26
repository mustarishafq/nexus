<?php

namespace Tests\Feature;

use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\QuizSessionAnswer;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\GrantsUserRoleQuizPlayAccess;
use Tests\TestCase;

class QuizCountdownTest extends TestCase
{
    use RefreshDatabase;
    use GrantsUserRoleQuizPlayAccess;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    /**
     * @return array{host: User, player: User, sessionId: int}
     */
    private function bootLive(int $questionCount = 2): array
    {
        config(['quiz.first_question_countdown_seconds' => 3]);
        $this->freezeTime();

        $host = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = Quiz::create([
            'user_id' => $host->id,
            'title' => 'Countdown',
            'status' => Quiz::STATUS_PUBLISHED,
        ]);

        for ($i = 0; $i < $questionCount; $i++) {
            $question = QuizQuestion::create([
                'quiz_id' => $quiz->id,
                'prompt' => "Q{$i}",
                'time_limit_seconds' => 20,
                'points_base' => 1000,
                'sort_order' => $i,
            ]);
            QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Yes', 'is_correct' => true, 'sort_order' => 0]);
            QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'No', 'is_correct' => false, 'sort_order' => 1]);
            QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Maybe', 'is_correct' => false, 'sort_order' => 2]);
            QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Skip', 'is_correct' => false, 'sort_order' => 3]);
        }

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();

        return compact('host', 'player', 'sessionId');
    }

    public function test_q1_countdown_does_not_reduce_configured_answering_time(): void
    {
        $ctx = $this->bootLive(1);
        $started = $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")
            ->assertOk()
            ->json();

        $this->assertFalse($started['answering_open']);
        $session = QuizSession::findOrFail($ctx['sessionId']);
        $this->assertEquals(20, $session->question_started_at->diffInSeconds($session->question_ends_at));
        $this->assertTrue($session->question_started_at->gt(now()));
        $this->assertTrue($session->question_ends_at->gt(now()->addSeconds(20)));

        $optionId = $session->currentQuestion()->with('options')->first()->options->firstWhere('is_correct', true)->id;
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $optionId])
            ->assertStatus(422);

        $this->travel(3)->seconds();

        $open = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();
        $this->assertTrue($open['answering_open']);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $optionId])
            ->assertOk();
    }

    public function test_countdown_is_only_for_the_first_question(): void
    {
        $ctx = $this->bootLive(2);
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")
            ->assertOk();

        $q1 = QuizSession::findOrFail($ctx['sessionId']);
        $this->assertTrue($q1->question_started_at->gt(now()));

        $this->travel(3)->seconds();
        $optionId = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId'])
            ->currentQuestion->options->firstWhere('is_correct', true)->id;
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $optionId])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
        $q2 = $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")
            ->assertOk()
            ->json();

        $this->assertTrue($q2['answering_open']);
        $row = QuizSession::findOrFail($ctx['sessionId']);
        $this->assertFalse($row->question_started_at->gt(now()));
        $this->assertEquals(20, $row->question_started_at->diffInSeconds($row->question_ends_at));
    }

    public function test_async_mode_has_q1_countdown(): void
    {
        config(['quiz.first_question_countdown_seconds' => 3]);
        $this->freezeTime();
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = Quiz::create(['user_id' => $owner->id, 'title' => 'Async', 'status' => Quiz::STATUS_PUBLISHED]);
        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'prompt' => 'Q',
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Yes', 'is_correct' => true, 'sort_order' => 0]);
        QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'No', 'is_correct' => false, 'sort_order' => 1]);

        $session = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();

        $this->assertFalse($session['answering_open']);
        $row = QuizSession::findOrFail($session['id']);
        $this->assertEquals(20, $row->question_started_at->diffInSeconds($row->question_ends_at));
        $this->assertTrue($row->question_started_at->gt(now()));

        $optionId = $session['quiz']['questions'][0]['options'][0]['id'];
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $optionId])
            ->assertStatus(422);

        $this->travel(3)->seconds();

        $open = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$session['id']}")
            ->assertOk()
            ->json();
        $this->assertTrue($open['answering_open']);
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $optionId])
            ->assertOk();
    }

    public function test_async_each_question_gets_a_fresh_timer(): void
    {
        config(['quiz.first_question_countdown_seconds' => 0]);
        $this->freezeTime();
        [$player, $session] = $this->bootAsync(2, 20);

        $firstEndsAt = $session['question_ends_at'];
        $q1Id = $session['current_question_id'];
        $this->assertSame(1, $session['quiz']['current_question_number']);

        $this->travel(5)->seconds();

        $correctId = QuizQuestion::with('options')->findOrFail($q1Id)
            ->options->firstWhere('is_correct', true)->id;

        $after = $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $correctId])
            ->assertOk()
            ->json('session');

        $this->assertSame('question', $after['status']);
        $this->assertSame(2, $after['quiz']['current_question_number']);
        $this->assertNotSame($q1Id, $after['current_question_id']);
        $this->assertNotSame($firstEndsAt, $after['question_ends_at']);

        $row = QuizSession::findOrFail($session['id']);
        $this->assertEquals(20, $row->question_started_at->diffInSeconds($row->question_ends_at));
        $this->assertLessThan(1, $row->question_started_at->diffInSeconds(now()));
    }

    public function test_async_refresh_does_not_reset_question_timer(): void
    {
        config(['quiz.first_question_countdown_seconds' => 0]);
        $this->freezeTime();
        [$player, $session] = $this->bootAsync(1, 20);

        $endsAt = $session['question_ends_at'];
        $this->travel(5)->seconds();

        $later = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$session['id']}")
            ->assertOk()
            ->json();

        $this->assertSame($endsAt, $later['question_ends_at']);
        $this->assertSame($session['current_question_id'], $later['current_question_id']);
        $this->assertSame('question', $later['status']);
        $this->assertTrue($later['answering_open']);
    }

    public function test_async_timeout_counts_as_miss_and_cannot_be_answered_again(): void
    {
        config(['quiz.first_question_countdown_seconds' => 0]);
        $this->freezeTime();
        [$player, $session] = $this->bootAsync(2, 20);
        $q1Id = $session['current_question_id'];
        $q1OptionId = QuizQuestion::with('options')->findOrFail($q1Id)
            ->options->firstWhere('is_correct', true)->id;

        $this->travel(21)->seconds();

        $after = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$session['id']}")
            ->assertOk()
            ->json();

        $this->assertSame('question', $after['status']);
        $this->assertSame(2, $after['quiz']['current_question_number']);
        $this->assertNotSame($q1Id, $after['current_question_id']);
        $this->assertDatabaseHas('quiz_session_answers', [
            'quiz_session_id' => $session['id'],
            'quiz_question_id' => $q1Id,
            'user_id' => $player->id,
            'quiz_option_id' => null,
            'is_correct' => 0,
        ]);

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $q1OptionId])
            ->assertStatus(422);

        $row = QuizSession::findOrFail($session['id']);
        $this->assertEquals(20, $row->question_started_at->diffInSeconds($row->question_ends_at));
        $this->assertLessThan(1, $row->question_started_at->diffInSeconds(now()));
    }

    public function test_async_timeout_does_not_skip_later_questions(): void
    {
        config(['quiz.first_question_countdown_seconds' => 0]);
        $this->freezeTime();
        [$player, $session] = $this->bootAsync(3, 20);
        $q1Id = $session['current_question_id'];

        $this->travel(100)->seconds();

        $after = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$session['id']}")
            ->assertOk()
            ->json();

        $this->assertSame('question', $after['status']);
        $this->assertSame(2, $after['quiz']['current_question_number']);
        $this->assertNotSame($q1Id, $after['current_question_id']);
        $this->assertSame(1, QuizSessionAnswer::query()->where('quiz_session_id', $session['id'])->count());

        $row = QuizSession::findOrFail($session['id']);
        $this->assertEquals(20, $row->question_started_at->diffInSeconds($row->question_ends_at));
        $this->assertTrue($row->question_started_at->gte(now()->subSecond()));
    }

    public function test_async_last_question_timeout_finishes_the_attempt(): void
    {
        config(['quiz.first_question_countdown_seconds' => 0]);
        $this->freezeTime();
        [$player, $session] = $this->bootAsync(1, 20);
        $optionId = QuizQuestion::with('options')->findOrFail($session['current_question_id'])
            ->options->firstWhere('is_correct', true)->id;

        $this->travel(21)->seconds();

        $after = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$session['id']}")
            ->assertOk()
            ->json();

        $this->assertSame('finished', $after['status']);
        $this->assertDatabaseHas('quiz_session_answers', [
            'quiz_session_id' => $session['id'],
            'quiz_question_id' => $session['current_question_id'],
            'quiz_option_id' => null,
            'is_correct' => 0,
        ]);

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $optionId])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);
    }

    public function test_live_refresh_does_not_reset_question_timer(): void
    {
        $ctx = $this->bootLive(1);
        $started = $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")
            ->assertOk()
            ->json();

        $this->travel(3)->seconds();
        $open = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();
        $this->assertTrue($open['answering_open']);
        $endsAt = $open['question_ends_at'];

        $this->travel(5)->seconds();
        $later = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();

        $this->assertSame($endsAt, $later['question_ends_at']);
        $this->assertSame('question', $later['status']);
    }

    public function test_async_feedback_delay_keeps_a_full_answering_window(): void
    {
        config([
            'quiz.first_question_countdown_seconds' => 0,
            'quiz.async_feedback_seconds' => 2,
        ]);
        $this->freezeTime();
        [$player, $session] = $this->bootAsync(2, 25);

        $q1Id = $session['current_question_id'];
        $correctId = QuizQuestion::with('options')->findOrFail($q1Id)
            ->options->firstWhere('is_correct', true)->id;

        $after = $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $correctId])
            ->assertOk()
            ->json('session');

        $this->assertSame(2, $after['quiz']['current_question_number']);
        $this->assertFalse($after['answering_open']);
        $this->assertNotNull($after['server_now']);
        $this->assertGreaterThanOrEqual(25000, $after['remaining_question_ms']);

        $row = QuizSession::findOrFail($session['id']);
        $this->assertSame(
            now()->copy()->addSeconds(2)->toDateTimeString(),
            $row->question_started_at->toDateTimeString()
        );
        $this->assertSame(
            now()->copy()->addSeconds(27)->toDateTimeString(),
            $row->question_ends_at->toDateTimeString()
        );

        $this->travel(2)->seconds();
        $open = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$session['id']}")
            ->assertOk()
            ->json();

        $this->assertTrue($open['answering_open']);
        $this->assertGreaterThanOrEqual(24000, $open['remaining_question_ms']);
        $this->assertLessThanOrEqual(26000, $open['remaining_question_ms']);
    }

    /**
     * @return array{0: User, 1: array<string, mixed>}
     */
    private function bootAsync(int $questionCount = 2, int $timeLimit = 20): array
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = Quiz::create([
            'user_id' => $owner->id,
            'title' => 'Published',
            'status' => Quiz::STATUS_PUBLISHED,
        ]);

        for ($i = 0; $i < $questionCount; $i++) {
            $question = QuizQuestion::create([
                'quiz_id' => $quiz->id,
                'prompt' => "Q{$i}",
                'time_limit_seconds' => $timeLimit,
                'points_base' => 1000,
                'sort_order' => $i,
            ]);
            QuizOption::create([
                'quiz_question_id' => $question->id,
                'label' => 'Yes',
                'is_correct' => true,
                'sort_order' => 0,
            ]);
            QuizOption::create([
                'quiz_question_id' => $question->id,
                'label' => 'No',
                'is_correct' => false,
                'sort_order' => 1,
            ]);
        }

        $session = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();

        return [$player, $session];
    }
}
