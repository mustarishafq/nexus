<?php

namespace Tests\Feature;

use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuizCountdownTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_async_mode_has_no_countdown(): void
    {
        config(['quiz.first_question_countdown_seconds' => 3]);
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

        $this->assertTrue($session['answering_open']);
        $optionId = $session['quiz']['questions'][0]['options'][0]['id'];
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $optionId])
            ->assertOk();
    }
}
