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
use Tests\TestCase;

class QuizTrueFalseTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    /**
     * @return array<string, mixed>
     */
    private function trueFalseQuestion(string $prompt = 'The sky is blue', bool $trueIsCorrect = true, array $overrides = []): array
    {
        return array_merge([
            'prompt' => $prompt,
            'question_type' => QuizQuestion::TYPE_TRUE_FALSE,
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'options' => [
                ['label' => 'True', 'is_correct' => $trueIsCorrect],
                ['label' => 'False', 'is_correct' => ! $trueIsCorrect],
            ],
        ], $overrides);
    }

    /**
     * @return array<string, mixed>
     */
    private function mcQuestion(string $prompt = '2+2?'): array
    {
        return [
            'prompt' => $prompt,
            'question_type' => QuizQuestion::TYPE_MULTIPLE_CHOICE,
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'options' => [
                ['label' => '3', 'is_correct' => false],
                ['label' => '4', 'is_correct' => true],
                ['label' => '5', 'is_correct' => false],
                ['label' => '6', 'is_correct' => false],
            ],
        ];
    }

    public function test_true_false_question_creation_succeeds(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'T/F Quiz',
                'questions' => [$this->trueFalseQuestion()],
            ])
            ->assertCreated()
            ->assertJsonPath('questions.0.question_type', 'true_false')
            ->assertJsonPath('questions.0.options.0.label', 'True')
            ->assertJsonPath('questions.0.options.1.label', 'False');
    }

    public function test_true_false_update_succeeds_and_normalizes_labels(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $id = $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'T/F Quiz',
                'questions' => [$this->trueFalseQuestion('Ice is cold')],
            ])
            ->assertCreated()
            ->json('id');

        $this->withToken($this->token($user))
            ->putJson("/api/quizzes/{$id}", [
                'questions' => [$this->trueFalseQuestion('Ice is cold', false, [
                    'options' => [
                        ['label' => 'FALSE', 'is_correct' => true],
                        ['label' => 'true', 'is_correct' => false],
                    ],
                ])],
            ])
            ->assertOk()
            ->assertJsonPath('questions.0.options.0.label', 'True')
            ->assertJsonPath('questions.0.options.0.is_correct', false)
            ->assertJsonPath('questions.0.options.1.label', 'False')
            ->assertJsonPath('questions.0.options.1.is_correct', true);
    }

    public function test_true_false_cannot_have_three_or_more_options(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Bad T/F',
                'questions' => [$this->trueFalseQuestion('Prompt', true, [
                    'options' => [
                        ['label' => 'True', 'is_correct' => true],
                        ['label' => 'False', 'is_correct' => false],
                        ['label' => 'Maybe', 'is_correct' => false],
                    ],
                ])],
            ])
            ->assertStatus(422);
    }

    public function test_true_false_must_be_exactly_true_and_false(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Bad labels',
                'questions' => [$this->trueFalseQuestion('Prompt', true, [
                    'options' => [
                        ['label' => 'Yes', 'is_correct' => true],
                        ['label' => 'No', 'is_correct' => false],
                    ],
                ])],
            ])
            ->assertStatus(422);
    }

    public function test_true_false_requires_exactly_one_correct_option(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Both correct',
                'questions' => [$this->trueFalseQuestion('Prompt', true, [
                    'options' => [
                        ['label' => 'True', 'is_correct' => true],
                        ['label' => 'False', 'is_correct' => true],
                    ],
                ])],
            ])
            ->assertStatus(422);

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'None correct',
                'questions' => [$this->trueFalseQuestion('Prompt', true, [
                    'options' => [
                        ['label' => 'True', 'is_correct' => false],
                        ['label' => 'False', 'is_correct' => false],
                    ],
                ])],
            ])
            ->assertStatus(422);
    }

    public function test_multiple_choice_remains_unchanged(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->postJson('/api/quizzes', [
                'title' => 'Mixed',
                'questions' => [
                    $this->mcQuestion('MC'),
                    $this->trueFalseQuestion('TF'),
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('questions.0.question_type', 'multiple_choice')
            ->assertJsonCount(4, 'questions.0.options')
            ->assertJsonPath('questions.1.question_type', 'true_false')
            ->assertJsonCount(2, 'questions.1.options');
    }

    public function test_true_false_works_in_live_gameplay_with_existing_scoring(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = Quiz::create([
            'user_id' => $host->id,
            'title' => 'TF Live',
            'status' => Quiz::STATUS_PUBLISHED,
        ]);
        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'prompt' => 'Ice is cold',
            'question_type' => QuizQuestion::TYPE_TRUE_FALSE,
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'True', 'is_correct' => true, 'sort_order' => 0]);
        QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'False', 'is_correct' => false, 'sort_order' => 1]);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();

        $correct = QuizQuestion::with('options')->findOrFail($question->id)->options->firstWhere('is_correct', true);
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
            ->assertOk();

        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();
        $answer = QuizSessionAnswer::query()->where('quiz_session_id', $sessionId)->first();
        $this->assertTrue((bool) $answer->is_correct);
        $this->assertGreaterThan(0, $answer->points_awarded);
        $this->assertSame(1, $answer->streak_after);
    }

    public function test_true_false_works_in_async_gameplay(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quizId = $this->withToken($this->token($owner))
            ->postJson('/api/quizzes', [
                'title' => 'Async TF',
                'status' => Quiz::STATUS_PUBLISHED,
                'questions' => [$this->trueFalseQuestion()],
            ])
            ->assertCreated()
            ->json('id');

        $session = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quizId}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();

        $trueId = collect($session['quiz']['questions'][0]['options'])->firstWhere('label', 'True')['id'];
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $trueId])
            ->assertOk()
            ->assertJsonPath('session.status', 'finished')
            ->assertJsonPath('answer.is_correct', true);
    }

    public function test_true_false_scoring_matches_multiple_choice(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $tfPlayer = User::factory()->create(['is_approved' => true]);
        $mcPlayer = User::factory()->create(['is_approved' => true]);

        $tfQuiz = Quiz::create(['user_id' => $host->id, 'title' => 'TF', 'status' => Quiz::STATUS_PUBLISHED]);
        $tfQ = QuizQuestion::create([
            'quiz_id' => $tfQuiz->id,
            'prompt' => 'A',
            'question_type' => QuizQuestion::TYPE_TRUE_FALSE,
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        QuizOption::create(['quiz_question_id' => $tfQ->id, 'label' => 'True', 'is_correct' => true, 'sort_order' => 0]);
        QuizOption::create(['quiz_question_id' => $tfQ->id, 'label' => 'False', 'is_correct' => false, 'sort_order' => 1]);

        $mcQuiz = Quiz::create(['user_id' => $host->id, 'title' => 'MC', 'status' => Quiz::STATUS_PUBLISHED]);
        $mcQ = QuizQuestion::create([
            'quiz_id' => $mcQuiz->id,
            'prompt' => 'B',
            'question_type' => QuizQuestion::TYPE_MULTIPLE_CHOICE,
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        QuizOption::create(['quiz_question_id' => $mcQ->id, 'label' => 'Yes', 'is_correct' => true, 'sort_order' => 0]);
        QuizOption::create(['quiz_question_id' => $mcQ->id, 'label' => 'No', 'is_correct' => false, 'sort_order' => 1]);
        QuizOption::create(['quiz_question_id' => $mcQ->id, 'label' => 'Maybe', 'is_correct' => false, 'sort_order' => 2]);
        QuizOption::create(['quiz_question_id' => $mcQ->id, 'label' => 'Skip', 'is_correct' => false, 'sort_order' => 3]);

        $this->freezeTime();
        $tfPoints = $this->playSoloAndScore($host, $tfPlayer, $tfQuiz);
        $mcPoints = $this->playSoloAndScore($host, $mcPlayer, $mcQuiz);
        $this->assertSame($mcPoints, $tfPoints);
    }

    public function test_eraser_is_invalid_for_true_false_while_other_power_ups_work(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = Quiz::create(['user_id' => $host->id, 'title' => 'TF', 'status' => Quiz::STATUS_PUBLISHED]);
        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'prompt' => 'Ice is cold',
            'question_type' => QuizQuestion::TYPE_TRUE_FALSE,
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'True', 'is_correct' => true, 'sort_order' => 0]);
        QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'False', 'is_correct' => false, 'sort_order' => 1]);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/power-ups", ['type' => 'eraser'])
            ->assertStatus(422);

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/power-ups", ['type' => 'double'])
            ->assertOk();
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/power-ups", ['type' => 'bonus'])
            ->assertStatus(422);
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/power-ups", ['type' => 'streak_freeze'])
            ->assertOk();
    }

    private function playSoloAndScore(User $host, User $player, Quiz $quiz): int
    {
        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();
        $session = QuizSession::with('currentQuestion.options')->findOrFail($sessionId);
        $correct = $session->currentQuestion->options->firstWhere('is_correct', true);
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
            ->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();

        return (int) QuizSessionAnswer::query()->where('quiz_session_id', $sessionId)->value('points_awarded');
    }
}
