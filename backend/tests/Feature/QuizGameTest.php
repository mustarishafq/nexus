<?php

namespace Tests\Feature;

use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\QuizSessionPowerUp;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuizGameTest extends TestCase
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

    public function test_approved_user_can_create_quiz(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $response = $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'My Quiz',
                'questions' => [
                    [
                        'prompt' => '2+2?',
                        'options' => [
                            ['label' => '4', 'is_correct' => true],
                            ['label' => '5', 'is_correct' => false],
                        ],
                    ],
                ],
            ])
            ->assertCreated();

        $this->assertSame('My Quiz', $response->json('title'));
        $this->assertCount(1, $response->json('questions'));
    }

    public function test_live_session_join_answer_streak_and_power_ups(): void
    {
        $host = User::factory()->create(['is_approved' => true, 'name' => 'Host']);
        $player = User::factory()->create(['is_approved' => true, 'name' => 'Player']);
        $quiz = $this->makeQuiz($host, 2);

        $sessionResponse = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated();

        $sessionId = $sessionResponse->json('id');
        $pin = $sessionResponse->json('pin');
        $this->assertNotEmpty($pin);

        $this->withToken($this->token($player))
            ->postJson('/api/quiz-sessions/join', ['pin' => $pin])
            ->assertOk()
            ->assertJsonPath('is_player', true);

        $this->assertDatabaseHas('quiz_session_power_ups', [
            'quiz_session_id' => $sessionId,
            'user_id' => $player->id,
            'type' => QuizSessionPowerUp::TYPE_ERASER,
            'uses_remaining' => 1,
        ]);

        $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/start")
            ->assertOk()
            ->assertJsonPath('status', 'question');

        $session = QuizSession::with('currentQuestion.options')->findOrFail($sessionId);
        $correct = $session->currentQuestion->options->firstWhere('is_correct', true);

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/power-ups", ['type' => 'double'])
            ->assertOk();

        $answer = $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
            ->assertOk();

        $this->assertTrue($answer->json('answer.is_correct'));
        $this->assertGreaterThan(1000, $answer->json('answer.points_awarded')); // double applied
        $this->assertSame(1, $answer->json('player.streak'));

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
            ->assertStatus(422);

        $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/reveal")
            ->assertOk()
            ->assertJsonPath('status', 'reveal');

        $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/next")
            ->assertOk()
            ->assertJsonPath('status', 'question');

        $session->refresh()->load('currentQuestion.options');
        $correct2 = $session->currentQuestion->options->firstWhere('is_correct', true);
        $wrong = $session->currentQuestion->options->firstWhere('is_correct', false);

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/power-ups", ['type' => 'streak_freeze'])
            ->assertOk();

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $wrong->id])
            ->assertOk()
            ->assertJsonPath('player.streak', 1); // freeze kept streak

        $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/next")
            ->assertOk()
            ->assertJsonPath('status', 'finished');

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct2->id])
            ->assertStatus(422);
    }

    public function test_eraser_removes_two_wrong_options(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($host, 1);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions")
            ->json('id');
        $pin = QuizSession::find($sessionId)->pin;

        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin]);
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start");

        $result = $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/power-ups", ['type' => 'eraser'])
            ->assertOk();

        $this->assertCount(2, $result->json('erased_option_ids'));
        $this->assertCount(2, $result->json('session.quiz.questions.0.options'));
    }

    public function test_host_only_controls(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($host, 1);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions")
            ->json('id');
        $pin = QuizSession::find($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin]);

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/start")
            ->assertStatus(422);
    }

    public function test_async_attempt_flow(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 2);

        $session = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();

        $this->assertSame('async', $session['mode']);
        $this->assertSame('question', $session['status']);

        $q1 = collect($session['quiz']['questions'])->firstWhere('id', $session['current_question_id']);
        $correct = collect($q1['options'])->firstWhere('is_correct', true);
        // is_correct hidden for player during question — find via DB
        $correctId = QuizQuestion::with('options')->find($session['current_question_id'])
            ->options->firstWhere('is_correct', true)->id;

        $afterFirst = $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $correctId])
            ->assertOk()
            ->json('session');

        $this->assertSame('question', $afterFirst['status']);

        $correct2 = QuizQuestion::with('options')->find($afterFirst['current_question_id'])
            ->options->firstWhere('is_correct', true)->id;

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $correct2])
            ->assertOk()
            ->assertJsonPath('session.status', 'finished');

        $this->withToken($this->token($owner))
            ->getJson("/api/quizzes/{$quiz->id}/attempts")
            ->assertOk()
            ->assertJsonCount(1);
    }
}
