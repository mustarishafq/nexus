<?php

namespace Tests\Feature;

use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\QuizSessionAnswer;
use App\Models\QuizSessionPlayer;
use App\Models\QuizSessionPowerUp;
use App\Models\User;
use App\Services\QuizGameService;
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
        $this->assertDatabaseHas('quiz_session_power_ups', [
            'quiz_session_id' => $sessionId,
            'user_id' => $player->id,
            'type' => QuizSessionPowerUp::TYPE_DOUBLE,
            'uses_remaining' => 1,
        ]);
        $this->assertDatabaseHas('quiz_session_power_ups', [
            'quiz_session_id' => $sessionId,
            'user_id' => $player->id,
            'type' => QuizSessionPowerUp::TYPE_STREAK_FREEZE,
            'uses_remaining' => 1,
        ]);
        $this->assertDatabaseHas('quiz_session_power_ups', [
            'quiz_session_id' => $sessionId,
            'user_id' => $player->id,
            'type' => QuizSessionPowerUp::TYPE_BONUS,
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

        $this->assertNull($answer->json('answer.is_correct'));
        $this->assertNull($answer->json('answer.points_awarded'));
        $meDuringQuestion = collect($answer->json('session.players'))->firstWhere('user_id', $player->id);
        $this->assertSame(0, $meDuringQuestion['score']);
        $this->assertSame(0, $meDuringQuestion['streak']);

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
            ->assertStatus(422);

        $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/reveal")
            ->assertOk()
            ->assertJsonPath('status', 'reveal');

        $playerView = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$sessionId}")
            ->assertOk();

        $this->assertTrue($playerView->json('my_answer.is_correct'));
        $this->assertGreaterThan(1000, $playerView->json('my_answer.points_awarded'));
        $this->assertSame(1, $playerView->json('my_answer.streak_after'));
        $meAfterReveal = collect($playerView->json('players'))->firstWhere('user_id', $player->id);
        $this->assertGreaterThan(1000, $meAfterReveal['score']);
        $this->assertSame(1, $meAfterReveal['streak']);

        $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/next")
            ->assertOk()
            ->assertJsonPath('status', 'leaderboard');
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
            ->assertOk();

        $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/reveal")
            ->assertOk();

        $afterWrong = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$sessionId}")
            ->assertOk();
        $this->assertSame(1, collect($afterWrong->json('players'))->firstWhere('user_id', $player->id)['streak']);

        $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/next")
            ->assertOk()
            ->assertJsonPath('status', 'leaderboard');
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

        $question = QuizSession::with('currentQuestion.options')->findOrFail($sessionId)->currentQuestion;
        $correctId = $question->options->firstWhere('is_correct', true)->id;
        $erased = collect($result->json('erased_option_ids'))->map(fn ($id) => (int) $id);
        $this->assertFalse($erased->contains((int) $correctId));
        $eraser = QuizSessionPowerUp::query()
            ->where('quiz_session_id', $sessionId)
            ->where('user_id', $player->id)
            ->where('type', QuizSessionPowerUp::TYPE_ERASER)
            ->first();
        $this->assertSame((int) $question->id, (int) ($eraser->payload['question_id'] ?? 0));

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $erased->first()])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['option_id']);

        cache()->flush();

        $afterFlush = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$sessionId}")
            ->assertOk();

        $this->assertCount(2, $afterFlush->json('quiz.questions.0.options'));
        $this->assertCount(2, $afterFlush->json('erased_option_ids'));
    }

    public function test_eraser_payload_without_question_id_still_applies(): void
    {
        $ctx = $this->bootLiveQuestion(1);
        $question = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId'])->currentQuestion;
        $wrongIds = $question->options->where('is_correct', false)->take(2)->pluck('id')->map(fn ($id) => (int) $id)->all();

        $powerUp = QuizSessionPowerUp::query()
            ->where('quiz_session_id', $ctx['sessionId'])
            ->where('user_id', $ctx['player']->id)
            ->where('type', QuizSessionPowerUp::TYPE_ERASER)
            ->first();
        $powerUp->uses_remaining = 0;
        $powerUp->active_until_question_id = $question->id;
        $powerUp->payload = ['erased_option_ids' => $wrongIds];
        $powerUp->save();

        $view = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk();
        $this->assertEqualsCanonicalizing($wrongIds, $view->json('erased_option_ids'));
        $this->assertCount(2, $view->json('quiz.questions.0.options'));
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
            ->assertStatus(403);
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

    public function test_live_answer_after_timer_is_rejected(): void
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

        $correctId = QuizSession::with('currentQuestion.options')->findOrFail($sessionId)
            ->currentQuestion->options->firstWhere('is_correct', true)->id;

        $this->travel(21)->seconds();

        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correctId])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);
    }

    public function test_cannot_edit_quiz_while_live_session_is_active(): void
    {
        $ctx = $this->bootLiveLobby(1);

        $this->withToken($this->token($ctx['host']))
            ->putJson("/api/quizzes/{$ctx['quiz']->id}", ['title' => 'Changed in lobby'])
            ->assertOk();

        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start");

        $this->withToken($this->token($ctx['host']))
            ->putJson("/api/quizzes/{$ctx['quiz']->id}", ['title' => 'Changed mid-game'])
            ->assertStatus(422);

        $this->withToken($this->token($ctx['host']))
            ->deleteJson("/api/quizzes/{$ctx['quiz']->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'This quiz cannot be deleted while a live game is in progress.');
        $this->assertDatabaseHas('quizzes', ['id' => $ctx['quiz']->id]);
    }

    public function test_host_cannot_delete_quiz_during_live_session(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start");
        $questionId = $ctx['quiz']->questions()->value('id');

        $this->withToken($this->token($ctx['host']))
            ->deleteJson("/api/quizzes/{$ctx['quiz']->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'This quiz cannot be deleted while a live game is in progress.');

        $this->assertDatabaseHas('quizzes', ['id' => $ctx['quiz']->id, 'title' => $ctx['quiz']->title]);
        $this->assertDatabaseHas('quiz_questions', ['id' => $questionId, 'quiz_id' => $ctx['quiz']->id]);
    }

    public function test_quiz_with_finished_live_session_can_be_deleted(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
        $this->assertSame(QuizSession::STATUS_FINISHED, QuizSession::findOrFail($ctx['sessionId'])->status);

        $this->withToken($this->token($ctx['host']))
            ->deleteJson("/api/quizzes/{$ctx['quiz']->id}")
            ->assertOk();
        $this->assertDatabaseMissing('quizzes', ['id' => $ctx['quiz']->id]);
    }

    public function test_quiz_with_no_live_session_can_be_deleted(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($host, 1);

        $this->withToken($this->token($host))
            ->deleteJson("/api/quizzes/{$quiz->id}")
            ->assertOk();
        $this->assertDatabaseMissing('quizzes', ['id' => $quiz->id]);
    }

    public function test_live_lobby_can_be_deleted_before_start(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->assertSame(QuizSession::STATUS_LOBBY, QuizSession::findOrFail($ctx['sessionId'])->status);

        $this->withToken($this->token($ctx['host']))
            ->deleteJson("/api/quizzes/{$ctx['quiz']->id}")
            ->assertOk();
        $this->assertDatabaseMissing('quizzes', ['id' => $ctx['quiz']->id]);
    }

    public function test_quiz_cannot_be_deleted_when_any_live_session_is_still_active(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();

        $secondId = $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quizzes/{$ctx['quiz']->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($secondId)->pin;
        $other = User::factory()->create(['is_approved' => true]);
        $this->withToken($this->token($other))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$secondId}/start")->assertOk();

        $this->withToken($this->token($ctx['host']))
            ->deleteJson("/api/quizzes/{$ctx['quiz']->id}")
            ->assertStatus(422);
        $this->assertDatabaseHas('quizzes', ['id' => $ctx['quiz']->id]);
        $this->assertGreaterThan(0, $ctx['quiz']->questions()->count());
    }

    public function test_can_edit_quiz_when_live_session_was_abandoned(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start");
        QuizSession::whereKey($ctx['sessionId'])->update([
            'host_last_seen_at' => now()->subMinutes(25),
        ]);

        $this->withToken($this->token($ctx['host']))
            ->putJson("/api/quizzes/{$ctx['quiz']->id}", ['title' => 'Unlocked after host left'])
            ->assertOk()
            ->assertJsonPath('title', 'Unlocked after host left');

        $this->withToken($this->token($ctx['host']))
            ->deleteJson("/api/quizzes/{$ctx['quiz']->id}")
            ->assertOk();
        $this->assertDatabaseMissing('quizzes', ['id' => $ctx['quiz']->id]);
    }

    /**
     * @return array{host: User, player: User, quiz: Quiz, sessionId: int, pin: string}
     */
    private function bootLiveLobby(int $questionCount = 2): array
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

        return compact('host', 'player', 'quiz', 'sessionId', 'pin');
    }

    public function test_live_player_receives_only_current_question_while_host_gets_full_quiz(): void
    {
        $ctx = $this->bootLiveLobby(2);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();

        $playerView = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();

        $hostView = $this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();

        $this->assertCount(1, $playerView['quiz']['questions']);
        $this->assertSame($playerView['current_question_id'], $playerView['quiz']['questions'][0]['id']);
        $this->assertSame(2, $playerView['quiz']['question_count']);
        $this->assertCount(2, $hostView['quiz']['questions']);
        $this->assertNotNull($hostView['question_ends_at']);
    }

    public function test_self_paced_mode_still_returns_full_quiz(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 2);

        $session = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();

        $this->assertSame('async', $session['mode']);
        $this->assertCount(2, $session['quiz']['questions']);
        $this->assertFalse($session['paused']);
    }

    public function test_new_player_cannot_join_after_start_but_existing_player_can_reconnect(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();

        $late = User::factory()->create(['is_approved' => true]);
        $this->withToken($this->token($late))
            ->postJson('/api/quiz-sessions/join', ['pin' => $ctx['pin']])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['pin']);

        $this->withToken($this->token($ctx['player']))
            ->postJson('/api/quiz-sessions/join', ['pin' => $ctx['pin']])
            ->assertOk()
            ->assertJsonPath('is_player', true);

        $this->assertSame(1, QuizSessionPlayer::query()->where('quiz_session_id', $ctx['sessionId'])->count());
    }

    public function test_host_cannot_join_own_game(): void
    {
        $ctx = $this->bootLiveLobby(1);

        $this->withToken($this->token($ctx['host']))
            ->postJson('/api/quiz-sessions/join', ['pin' => $ctx['pin']])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['pin']);
    }

    public function test_empty_live_game_cannot_start(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($host, 1);
        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions")
            ->json('id');

        $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$sessionId}/start")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);
    }

    public function test_server_stores_question_deadline_and_rejects_late_answers(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $started = $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")
            ->assertOk()
            ->json();

        $this->assertNotNull($started['question_started_at']);
        $this->assertNotNull($started['question_ends_at']);

        $correctId = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId'])
            ->currentQuestion->options->firstWhere('is_correct', true)->id;

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correctId])
            ->assertOk();
    }

    public function test_lazy_auto_reveal_after_deadline_does_not_duplicate_missed_answers(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();

        $this->travel(21)->seconds();

        $first = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk();

        $this->assertSame('reveal', $first->json('status'));
        $this->assertSame(1, QuizSessionAnswer::query()->where('quiz_session_id', $ctx['sessionId'])->count());

        $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->assertJsonPath('status', 'reveal');

        $this->assertSame(1, QuizSessionAnswer::query()->where('quiz_session_id', $ctx['sessionId'])->count());
    }

    public function test_host_reveal_before_deadline_is_idempotent(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();

        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")
            ->assertOk()
            ->assertJsonPath('status', 'reveal');

        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")
            ->assertOk()
            ->assertJsonPath('status', 'reveal');

        $this->assertSame(1, QuizSessionAnswer::query()->where('quiz_session_id', $ctx['sessionId'])->count());
    }

    public function test_reveal_then_next_does_not_corrupt_question_state(): void
    {
        $ctx = $this->bootLiveLobby(2);
        $start = $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->json();
        $firstId = $start['current_question_id'];

        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->travel(1)->seconds();
        $recap = $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk()->json();
        $this->assertSame('leaderboard', $recap['status']);
        $this->assertSame($firstId, $recap['current_question_id']);

        $next = $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk()->json();

        $this->assertSame('question', $next['status']);
        $this->assertNotSame($firstId, $next['current_question_id']);
        $this->assertNotNull($next['question_started_at']);
        $this->assertNotNull($next['question_ends_at']);
        $this->assertNotSame($start['question_started_at'], $next['question_started_at']);
        $this->assertNotSame($start['question_ends_at'], $next['question_ends_at']);
    }

    public function test_answer_after_reveal_is_a_clean_conflict(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();

        $correctId = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId'])
            ->currentQuestion->options->firstWhere('is_correct', true)->id;

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correctId])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);
    }

    public function test_final_question_finishes_and_clears_pin(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")
            ->assertOk()
            ->assertJsonPath('status', 'leaderboard');
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")
            ->assertOk()
            ->assertJsonPath('status', 'finished')
            ->assertJsonPath('pin', null);

        $this->assertDatabaseHas('quiz_sessions', [
            'id' => $ctx['sessionId'],
            'status' => 'finished',
            'pin' => null,
        ]);
    }

    public function test_end_session_from_lobby_is_idempotent(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/end")
            ->assertOk()
            ->assertJsonPath('status', 'finished')
            ->assertJsonPath('pin', null);
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/end")
            ->assertOk()
            ->assertJsonPath('status', 'finished');
    }

    public function test_host_cannot_end_live_session_after_start(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/end")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);
        $this->assertSame('question', QuizSession::find($ctx['sessionId'])->status);
    }

    public function test_player_can_leave_lobby_but_not_after_start(): void
    {
        $ctx = $this->bootLiveLobby(1);

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/leave")
            ->assertOk();

        $this->assertDatabaseMissing('quiz_session_players', [
            'quiz_session_id' => $ctx['sessionId'],
            'user_id' => $ctx['player']->id,
        ]);

        $this->withToken($this->token($ctx['player']))
            ->postJson('/api/quiz-sessions/join', ['pin' => $ctx['pin']])
            ->assertOk();

        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/leave")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);
        $this->assertDatabaseHas('quiz_session_players', [
            'quiz_session_id' => $ctx['sessionId'],
            'user_id' => $ctx['player']->id,
        ]);
    }

    public function test_host_heartbeat_keeps_session_active_and_timeout_pauses(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/heartbeat")->assertOk();

        $this->travel(10)->seconds();

        $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->assertJsonPath('paused', false)
            ->assertJsonPath('status', 'question');

        $this->travel(3)->seconds();

        $paused = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();

        $this->assertTrue($paused['paused']);
        $this->assertSame('question', $paused['status']);
        $this->assertGreaterThan(0, $paused['pause_remaining_ms']);
        $this->assertNull($paused['question_ends_at']);
    }

    public function test_paused_question_time_stays_frozen_until_host_resumes(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();

        $this->travel(5)->seconds();
        QuizSession::whereKey($ctx['sessionId'])->update(['host_last_seen_at' => now()->subSeconds(13)]);

        $paused = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();

        $this->assertTrue($paused['paused']);
        $remaining = $paused['pause_remaining_ms'];
        $this->assertGreaterThan(10_000, $remaining);
        $this->assertLessThanOrEqual(15_000, $remaining);

        $this->travel(30)->seconds();

        $stillPaused = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();

        $this->assertTrue($stillPaused['paused']);
        $this->assertSame($remaining, $stillPaused['pause_remaining_ms']);

        $resumed = $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/heartbeat")
            ->assertOk()
            ->json();

        $this->assertFalse($resumed['paused']);
        $this->assertSame('question', $resumed['status']);
        $this->assertNotNull($resumed['question_ends_at']);
    }

    public function test_answer_and_power_up_rejected_while_paused(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        QuizSession::whereKey($ctx['sessionId'])->update(['host_last_seen_at' => now()->subSeconds(13)]);
        $this->withToken($this->token($ctx['player']))->getJson("/api/quiz-sessions/{$ctx['sessionId']}")->assertJsonPath('paused', true);

        $correctId = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId'])
            ->currentQuestion->options->firstWhere('is_correct', true)->id;

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correctId])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'double'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);
    }

    public function test_lobby_is_not_paused(): void
    {
        $ctx = $this->bootLiveLobby(1);
        QuizSession::whereKey($ctx['sessionId'])->update(['host_last_seen_at' => now()->subSeconds(60)]);

        $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->assertJsonPath('status', 'lobby')
            ->assertJsonPath('paused', false);
    }

    public function test_option_histogram_and_no_individual_answer_mapping(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $second = User::factory()->create(['is_approved' => true, 'name' => 'Second']);
        $third = User::factory()->create(['is_approved' => true, 'name' => 'Third']);
        $this->withToken($this->token($second))->postJson('/api/quiz-sessions/join', ['pin' => $ctx['pin']])->assertOk();
        $this->withToken($this->token($third))->postJson('/api/quiz-sessions/join', ['pin' => $ctx['pin']])->assertOk();

        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $session = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId']);
        $correct = $session->currentQuestion->options->firstWhere('is_correct', true);
        $wrong = $session->currentQuestion->options->firstWhere('is_correct', false);

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correct->id]);
        $this->withToken($this->token($second))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $wrong->id]);

        $payload = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();
        $this->assertNull($payload['option_stats']);
        $this->assertCount(1, $payload['quiz']['questions']);
        $this->assertContains(null, array_column($payload['quiz']['questions'][0]['options'], 'is_correct'));

        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();

        $revealed = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();

        $this->assertSame('reveal', $revealed['status']);
        $this->assertCount(1, $revealed['quiz']['questions']);
        $this->assertCount(4, $revealed['option_stats']);
        $this->assertSame(1, $revealed['unanswered_count']);

        $byId = collect($revealed['option_stats'])->keyBy('option_id');
        $this->assertSame(1, $byId[$correct->id]['count']);
        $this->assertTrue($byId[$correct->id]['is_correct']);
        $this->assertSame(1, $byId[$wrong->id]['count']);
        $this->assertFalse($byId[$wrong->id]['is_correct']);
        $zeros = collect($revealed['option_stats'])->where('count', 0);
        $this->assertGreaterThanOrEqual(2, $zeros->count());

        $encoded = json_encode($revealed);
        $this->assertStringNotContainsString('"user_id":'.$second->id.',"option', $encoded);
        foreach ($revealed['option_stats'] as $stat) {
            $this->assertArrayNotHasKey('user_id', $stat);
            $this->assertArrayNotHasKey('user_ids', $stat);
        }
        foreach ($revealed['players'] as $row) {
            $this->assertArrayNotHasKey('quiz_option_id', $row);
        }
    }

    public function test_my_answer_recap_fields_after_reveal(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $correctId = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId'])
            ->currentQuestion->options->firstWhere('is_correct', true)->id;
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correctId]);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal");

        $mine = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json('my_answer');

        $this->assertNotNull($mine['response_ms']);
        $this->assertGreaterThan(0, $mine['points_awarded']);
        $this->assertSame(1, $mine['streak_after']);
        $this->assertSame($mine['points_awarded'], $mine['score']);
        $this->assertSame(0, $mine['previous_score']);
        $this->assertSame(1, $mine['rank']);
        $this->assertSame(1, $mine['previous_rank']);
        $this->assertSame(0, $mine['rank_delta']);
        $this->assertNull($mine['points_ahead']);
        $this->assertNull($mine['points_behind']);

        $context = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json('result_context');
        $this->assertTrue($context['correct']);
        $this->assertFalse($context['missed']);
        $this->assertArrayHasKey('fast', $context);
        $this->assertArrayHasKey('rank_up', $context);
    }

    public function test_ranking_uses_score_then_response_ms_then_joined_at(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $fast = User::factory()->create(['is_approved' => true, 'name' => 'Fast']);
        $slow = User::factory()->create(['is_approved' => true, 'name' => 'Slow']);
        $this->withToken($this->token($fast))->postJson('/api/quiz-sessions/join', ['pin' => $ctx['pin']]);
        $this->withToken($this->token($slow))->postJson('/api/quiz-sessions/join', ['pin' => $ctx['pin']]);

        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $correctId = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId'])
            ->currentQuestion->options->firstWhere('is_correct', true)->id;

        foreach ([$ctx['player'], $fast, $slow] as $user) {
            $this->withToken($this->token($user))
                ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correctId]);
        }
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal");

        QuizSessionPlayer::query()->where('quiz_session_id', $ctx['sessionId'])->update(['score' => 1000]);
        QuizSessionAnswer::query()->where('quiz_session_id', $ctx['sessionId'])->update(['points_awarded' => 1000]);
        QuizSessionAnswer::query()->where('quiz_session_id', $ctx['sessionId'])->where('user_id', $fast->id)->update(['response_ms' => 400]);
        QuizSessionAnswer::query()->where('quiz_session_id', $ctx['sessionId'])->where('user_id', $slow->id)->update(['response_ms' => 8000]);
        QuizSessionAnswer::query()->where('quiz_session_id', $ctx['sessionId'])->where('user_id', $ctx['player']->id)->update(['response_ms' => null]);

        $players = collect($this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json('players'));

        $this->assertSame($fast->id, $players[0]['user_id']);
        $this->assertSame(1, $players[0]['rank']);
        $this->assertSame($slow->id, $players[1]['user_id']);
        $this->assertSame($ctx['player']->id, $players[2]['user_id']);
    }

    public function test_reveal_deadline_moves_one_phase_to_leaderboard(): void
    {
        $ctx = $this->bootLiveLobby(2);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();

        $this->travel(30)->seconds();
        QuizSession::whereKey($ctx['sessionId'])->update(['host_last_seen_at' => now()]);

        $once = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();

        $this->assertSame('leaderboard', $once['status']);
        $this->assertNotNull($once['phase_ends_at']);

        $twice = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();
        $this->assertSame('leaderboard', $twice['status']);
    }

    public function test_leaderboard_deadline_advances_or_finishes(): void
    {
        $ctx = $this->bootLiveLobby(2);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $firstId = QuizSession::find($ctx['sessionId'])->current_question_id;
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertJsonPath('status', 'leaderboard');

        $this->travel(6)->seconds();
        $next = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();

        $this->assertSame('question', $next['status']);
        $this->assertNotSame($firstId, $next['current_question_id']);
        $this->assertNotNull($next['question_ends_at']);
        $this->assertNull($next['option_stats']);
    }

    public function test_final_recap_deadline_finishes_and_clears_pin(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertJsonPath('status', 'leaderboard');

        $this->travel(6)->seconds();
        $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->assertJsonPath('status', 'finished')
            ->assertJsonPath('pin', null);
    }

    public function test_reveal_and_leaderboard_pause_freezes_phase_time(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->travel(1)->seconds();
        QuizSession::whereKey($ctx['sessionId'])->update(['host_last_seen_at' => now()->subSeconds(13)]);

        $paused = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();

        $this->assertTrue($paused['paused']);
        $this->assertSame('reveal', $paused['status']);
        $this->assertNull($paused['phase_ends_at']);
        $remaining = $paused['pause_remaining_ms'];
        $this->assertGreaterThan(0, $remaining);

        $this->travel(20)->seconds();
        $still = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json();
        $this->assertTrue($still['paused']);
        $this->assertSame($remaining, $still['pause_remaining_ms']);
        $this->assertSame('reveal', $still['status']);

        $resumed = $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/heartbeat")
            ->assertOk()
            ->json();
        $this->assertFalse($resumed['paused']);
        $this->assertSame('reveal', $resumed['status']);
        $this->assertNotNull($resumed['phase_ends_at']);
    }

    public function test_async_does_not_enter_live_distribution_flow(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 2);

        $session = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();

        $this->assertSame('question', $session['status']);
        $this->assertNull($session['option_stats']);
        $this->assertCount(2, $session['quiz']['questions']);

        $correctId = QuizQuestion::with('options')->find($session['current_question_id'])
            ->options->firstWhere('is_correct', true)->id;
        $after = $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $correctId])
            ->assertOk()
            ->json('session');

        $this->assertSame('question', $after['status']);
        $this->assertNull($after['option_stats']);
    }

    public function test_session_copies_quiz_audio_and_keeps_legacy_sfx_pack(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($host, 1);
        $quiz->update([
            'bgm_theme' => 'energy',
            'sfx_pack' => 'carnival',
        ]);

        $session = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json();

        $this->assertSame('energy', $session['bgm_theme']);
        $this->assertSame('carnival', $session['sfx_pack']);
        $this->assertTrue($session['music_enabled']);

        $updated = $this->withToken($this->token($host))
            ->postJson("/api/quiz-sessions/{$session['id']}/music", ['bgm_theme' => 'chill'])
            ->assertOk()
            ->json();

        $this->assertSame('chill', $updated['bgm_theme']);
        $this->assertSame('carnival', $updated['sfx_pack']);
    }

    public function test_live_player_inventory_includes_bonus(): void
    {
        $ctx = $this->bootLiveLobby(1);
        $types = QuizSessionPowerUp::query()
            ->where('quiz_session_id', $ctx['sessionId'])
            ->where('user_id', $ctx['player']->id)
            ->pluck('type')
            ->sort()
            ->values()
            ->all();

        $this->assertSame(
            collect(QuizSessionPowerUp::TYPES)->sort()->values()->all(),
            $types,
        );
    }

    public function test_double_wrong_deducts_normal_points_not_double(): void
    {
        $this->freezeTime();
        $ctx = $this->bootLiveQuestion(2);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'double'])
            ->assertOk();

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['wrongId']])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")
            ->assertOk();

        $afterWrong = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk();
        $normal = $this->expectedNormalPointsForSession($ctx['sessionId']);
        $points = $afterWrong->json('my_answer.points_awarded');
        $this->assertSame(-$normal, $points);
        $this->assertNotSame(-$normal * 2, $points);
        $this->assertSame(-$normal, collect($afterWrong->json('players'))->firstWhere('user_id', $ctx['player']->id)['score']);
        $this->assertSame(0, QuizSessionPowerUp::query()
            ->where('quiz_session_id', $ctx['sessionId'])
            ->where('user_id', $ctx['player']->id)
            ->where('type', QuizSessionPowerUp::TYPE_DOUBLE)
            ->value('uses_remaining'));

        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'double'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);
    }

    public function test_double_timeout_miss_does_not_award_points(): void
    {
        $ctx = $this->bootLiveQuestion(1);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'double'])
            ->assertOk();

        $this->travel(21)->seconds();
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")
            ->assertOk();

        $view = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk();
        $this->assertFalse($view->json('my_answer.is_correct'));
        $this->assertSame(0, $view->json('my_answer.points_awarded'));
        $this->assertNull(QuizSessionPowerUp::query()
            ->where('quiz_session_id', $ctx['sessionId'])
            ->where('user_id', $ctx['player']->id)
            ->where('type', QuizSessionPowerUp::TYPE_DOUBLE)
            ->value('active_until_question_id'));
    }

    public function test_power_up_rejected_after_answer_reveal_and_timeout(): void
    {
        $ctx = $this->bootLiveQuestion(1);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['correctId']])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'double'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);

        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);
    }

    public function test_power_up_rejected_when_server_time_has_expired(): void
    {
        $ctx = $this->bootLiveQuestion(1);
        QuizSession::whereKey($ctx['sessionId'])->update(['question_ends_at' => null]);

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);

        $live = $this->bootLiveQuestion(1);
        $this->travel(21)->seconds();
        $this->withToken($this->token($live['player']))
            ->postJson("/api/quiz-sessions/{$live['sessionId']}/power-ups", ['type' => 'double'])
            ->assertStatus(422);
    }

    public function test_streak_shield_is_consumed_on_correct_and_does_not_carry(): void
    {
        $ctx = $this->bootLiveQuestion(2);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'streak_freeze'])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['correctId']])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")
            ->assertOk();

        $afterCorrect = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk();
        $this->assertTrue($afterCorrect->json('my_answer.is_correct'));
        $this->assertSame(1, $afterCorrect->json('my_answer.streak_after'));
        $points = $afterCorrect->json('my_answer.points_awarded');
        $this->assertGreaterThanOrEqual(500, $points);
        $this->assertLessThanOrEqual(1000, $points);

        $shield = QuizSessionPowerUp::query()
            ->where('quiz_session_id', $ctx['sessionId'])
            ->where('user_id', $ctx['player']->id)
            ->where('type', QuizSessionPowerUp::TYPE_STREAK_FREEZE)
            ->first();
        $this->assertSame(0, $shield->uses_remaining);
        $this->assertNull($shield->active_until_question_id);

        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'streak_freeze'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);
    }

    public function test_streak_shield_preserves_streak_on_wrong_and_timeout(): void
    {
        $ctx = $this->bootLiveQuestion(2);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['correctId']])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->assertSame(1, collect(
            $this->withToken($this->token($ctx['player']))->getJson("/api/quiz-sessions/{$ctx['sessionId']}")->json('players')
        )->firstWhere('user_id', $ctx['player']->id)['streak']);

        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'streak_freeze'])
            ->assertOk();

        $paused = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk()
            ->json();
        $this->assertFalse($paused['paused']);
        $this->assertNotNull($paused['question_ends_at']);

        $this->travel(2)->seconds();
        $later = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json();
        $this->assertFalse($later['paused']);
        $this->assertSame('question', $later['status']);
        $this->assertSame($paused['question_ends_at'], $later['question_ends_at']);

        $wrongId = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId'])
            ->currentQuestion->options->firstWhere('is_correct', false)->id;
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $wrongId])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();

        $afterWrong = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk();
        $this->assertSame(1, collect($afterWrong->json('players'))->firstWhere('user_id', $ctx['player']->id)['streak']);
        $this->assertSame(0, $afterWrong->json('my_answer.points_awarded'));
    }

    public function test_streak_shield_preserves_streak_on_timeout_miss(): void
    {
        $ctx = $this->bootLiveQuestion(2);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['correctId']])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'streak_freeze'])
            ->assertOk();

        $this->travel(21)->seconds();
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")
            ->assertOk();

        $afterMiss = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk();
        $this->assertSame(1, collect($afterMiss->json('players'))->firstWhere('user_id', $ctx['player']->id)['streak']);
        $this->assertSame(0, $afterMiss->json('my_answer.points_awarded'));
        $this->assertFalse($afterMiss->json('my_answer.is_correct'));
        $this->assertNull(QuizSessionPowerUp::query()
            ->where('quiz_session_id', $ctx['sessionId'])
            ->where('user_id', $ctx['player']->id)
            ->where('type', QuizSessionPowerUp::TYPE_STREAK_FREEZE)
            ->value('active_until_question_id'));
    }

    public function test_bonus_adds_flat_points_on_correct_only(): void
    {
        $this->freezeTime();
        $ctx = $this->bootLiveQuestion(1);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['correctId']])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();

        $points = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json('my_answer.points_awarded');

        $normal = $this->expectedNormalPointsForSession($ctx['sessionId']);
        $this->assertSame($normal + QuizSessionPowerUp::BONUS_POINTS, $points);
        $this->assertSame(500, QuizSessionPowerUp::BONUS_POINTS);
        $this->assertSame($normal + 500, $points);
        $this->assertSame(QuizSessionPowerUp::TYPE_BONUS, QuizSessionAnswer::query()
            ->where('quiz_session_id', $ctx['sessionId'])
            ->where('user_id', $ctx['player']->id)
            ->value('power_up_used'));
    }

    public function test_bonus_wrong_and_timeout_award_no_extra_points(): void
    {
        $ctx = $this->bootLiveQuestion(2);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['wrongId']])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();

        $afterWrong = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk();
        $this->assertSame(0, $afterWrong->json('my_answer.points_awarded'));

        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertStatus(422);

        $ctx2 = $this->bootLiveQuestion(1);
        $this->withToken($this->token($ctx2['player']))
            ->postJson("/api/quiz-sessions/{$ctx2['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertOk();
        $this->travel(21)->seconds();
        $this->withToken($this->token($ctx2['host']))->postJson("/api/quiz-sessions/{$ctx2['sessionId']}/reveal")->assertOk();
        $miss = $this->withToken($this->token($ctx2['player']))
            ->getJson("/api/quiz-sessions/{$ctx2['sessionId']}")
            ->assertOk();
        $this->assertSame(0, $miss->json('my_answer.points_awarded'));
    }

    public function test_double_and_bonus_cannot_stack_on_the_same_question(): void
    {
        $ctx = $this->bootLiveQuestion(1);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'double'])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'streak_freeze'])
            ->assertOk();
    }

    public function test_streak_shield_can_coexist_with_bonus(): void
    {
        $ctx = $this->bootLiveQuestion(1);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'streak_freeze'])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['correctId']])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();

        $view = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->assertOk();
        $this->assertTrue($view->json('my_answer.is_correct'));
        $this->assertSame(1, $view->json('my_answer.streak_after'));
        $this->assertGreaterThanOrEqual(1000, $view->json('my_answer.points_awarded'));
        $this->assertSame(QuizSessionPowerUp::TYPE_BONUS, QuizSessionAnswer::query()
            ->where('quiz_session_id', $ctx['sessionId'])
            ->where('user_id', $ctx['player']->id)
            ->value('power_up_used'));
    }

    public function test_power_up_validation_rejects_lobby_finished_async_and_duplicates(): void
    {
        $lobby = $this->bootLiveLobby(1);
        $this->withToken($this->token($lobby['player']))
            ->postJson("/api/quiz-sessions/{$lobby['sessionId']}/power-ups", ['type' => 'eraser'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);

        $live = $this->bootLiveQuestion(1);
        $this->withToken($this->token($live['player']))
            ->postJson("/api/quiz-sessions/{$live['sessionId']}/power-ups", ['type' => 'eraser'])
            ->assertOk();
        $this->withToken($this->token($live['player']))
            ->postJson("/api/quiz-sessions/{$live['sessionId']}/power-ups", ['type' => 'eraser'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);

        $this->withToken($this->token($live['host']))->postJson("/api/quiz-sessions/{$live['sessionId']}/reveal")->assertOk();
        $this->withToken($this->token($live['host']))->postJson("/api/quiz-sessions/{$live['sessionId']}/next")->assertOk();
        $this->withToken($this->token($live['host']))->postJson("/api/quiz-sessions/{$live['sessionId']}/next")->assertOk();
        $this->withToken($this->token($live['player']))
            ->postJson("/api/quiz-sessions/{$live['sessionId']}/power-ups", ['type' => 'double'])
            ->assertStatus(422);

        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1);
        $async = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();
        $this->assertEmpty($async['my_power_ups'] ?? []);
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$async['id']}/power-ups", ['type' => 'double'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session']);
    }

    /**
     * Power-up activation uses session lockForUpdate plus the power-up row lock.
     * These SQLite tests serialize transactions and do not prove MySQL/InnoDB races.
     */
    public function test_duplicate_activation_is_rejected_after_first_use(): void
    {
        $ctx = $this->bootLiveQuestion(1);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'double'])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'double'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);
    }

    public function test_double_correct_awards_twice_normal_points(): void
    {
        $this->freezeTime();
        $ctx = $this->bootLiveQuestion(1);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'double'])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['correctId']])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();

        $points = $this->withToken($this->token($ctx['player']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json('my_answer.points_awarded');
        $normal = $this->expectedNormalPointsForSession($ctx['sessionId']);
        $this->assertSame($normal * 2, $points);
        $this->assertSame(QuizSessionPowerUp::TYPE_DOUBLE, QuizSessionAnswer::query()
            ->where('quiz_session_id', $ctx['sessionId'])
            ->where('user_id', $ctx['player']->id)
            ->value('power_up_used'));
    }

    public function test_double_and_bonus_cannot_be_applied_twice_to_the_same_answer(): void
    {
        $this->freezeTime();
        $ctx = $this->bootLiveQuestion(1);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['correctId']])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['correctId']])
            ->assertStatus(422);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertStatus(422);

        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->assertSame(
            $this->expectedNormalPointsForSession($ctx['sessionId']) + QuizSessionPowerUp::BONUS_POINTS,
            QuizSessionAnswer::query()
                ->where('quiz_session_id', $ctx['sessionId'])
                ->where('user_id', $ctx['player']->id)
                ->value('points_awarded'),
        );
        $this->assertSame(1, QuizSessionAnswer::query()->where('quiz_session_id', $ctx['sessionId'])->count());

        $double = $this->bootLiveQuestion(1);
        $this->withToken($this->token($double['player']))
            ->postJson("/api/quiz-sessions/{$double['sessionId']}/power-ups", ['type' => 'double'])
            ->assertOk();
        $this->withToken($this->token($double['player']))
            ->postJson("/api/quiz-sessions/{$double['sessionId']}/answer", ['option_id' => $double['correctId']])
            ->assertOk();
        $this->withToken($this->token($double['player']))
            ->postJson("/api/quiz-sessions/{$double['sessionId']}/answer", ['option_id' => $double['correctId']])
            ->assertStatus(422);
        $this->withToken($this->token($double['player']))
            ->postJson("/api/quiz-sessions/{$double['sessionId']}/power-ups", ['type' => 'double'])
            ->assertStatus(422);
        $this->withToken($this->token($double['host']))->postJson("/api/quiz-sessions/{$double['sessionId']}/reveal")->assertOk();
        $this->assertSame(
            $this->expectedNormalPointsForSession($double['sessionId']) * 2,
            QuizSessionAnswer::query()
                ->where('quiz_session_id', $double['sessionId'])
                ->where('user_id', $double['player']->id)
                ->value('points_awarded'),
        );
    }

    public function test_bonus_is_not_multiplied_by_streak(): void
    {
        $this->freezeTime();
        $ctx = $this->bootLiveQuestion(2);
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $ctx['correctId']])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")->assertOk();

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertOk();
        $correctId = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId'])
            ->currentQuestion->options->firstWhere('is_correct', true)->id;
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correctId])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();

        $points = QuizSessionAnswer::query()
            ->where('quiz_session_id', $ctx['sessionId'])
            ->where('user_id', $ctx['player']->id)
            ->orderByDesc('id')
            ->value('points_awarded');
        $normal = $this->expectedNormalPointsForSession($ctx['sessionId'], 1);
        $this->assertSame($normal + 500, $points);
        $this->assertNotSame((int) round($normal + (500 * 1.2)), $points);
    }

    public function test_normal_speed_and_streak_scoring_are_unchanged_without_power_ups(): void
    {
        $this->freezeTime();
        $full = $this->bootLiveQuestion(1);
        $this->withToken($this->token($full['player']))
            ->postJson("/api/quiz-sessions/{$full['sessionId']}/answer", ['option_id' => $full['correctId']])
            ->assertOk();
        $this->withToken($this->token($full['host']))->postJson("/api/quiz-sessions/{$full['sessionId']}/reveal")->assertOk();
        $this->assertSame(
            $this->expectedNormalPointsForSession($full['sessionId']),
            QuizSessionAnswer::query()
                ->where('quiz_session_id', $full['sessionId'])
                ->value('points_awarded'),
        );

        $slow = $this->bootLiveQuestion(1);
        $this->travel(10)->seconds();
        $this->withToken($this->token($slow['player']))
            ->postJson("/api/quiz-sessions/{$slow['sessionId']}/answer", ['option_id' => $slow['correctId']])
            ->assertOk();
        $this->withToken($this->token($slow['host']))->postJson("/api/quiz-sessions/{$slow['sessionId']}/reveal")->assertOk();
        $this->assertSame(
            $this->expectedNormalPointsForSession($slow['sessionId']),
            QuizSessionAnswer::query()
                ->where('quiz_session_id', $slow['sessionId'])
                ->value('points_awarded'),
        );

        $this->freezeTime();
        $streak = $this->bootLiveQuestion(2);
        $this->withToken($this->token($streak['player']))
            ->postJson("/api/quiz-sessions/{$streak['sessionId']}/answer", ['option_id' => $streak['correctId']])
            ->assertOk();
        $this->withToken($this->token($streak['host']))->postJson("/api/quiz-sessions/{$streak['sessionId']}/reveal")->assertOk();
        $this->withToken($this->token($streak['host']))->postJson("/api/quiz-sessions/{$streak['sessionId']}/next")->assertOk();
        $this->withToken($this->token($streak['host']))->postJson("/api/quiz-sessions/{$streak['sessionId']}/next")->assertOk();
        $correctId = QuizSession::with('currentQuestion.options')->findOrFail($streak['sessionId'])
            ->currentQuestion->options->firstWhere('is_correct', true)->id;
        $this->withToken($this->token($streak['player']))
            ->postJson("/api/quiz-sessions/{$streak['sessionId']}/answer", ['option_id' => $correctId])
            ->assertOk();
        $this->withToken($this->token($streak['host']))->postJson("/api/quiz-sessions/{$streak['sessionId']}/reveal")->assertOk();
        $this->assertSame(
            $this->expectedNormalPointsForSession($streak['sessionId'], 1),
            QuizSessionAnswer::query()
                ->where('quiz_session_id', $streak['sessionId'])
                ->where('quiz_question_id', QuizSession::findOrFail($streak['sessionId'])->current_question_id)
                ->value('points_awarded'),
        );
    }

    public function test_double_and_bonus_wrap_existing_speed_scoring(): void
    {
        $this->freezeTime();
        $bonus = $this->bootLiveQuestion(1);
        $this->travel(10)->seconds();
        $this->withToken($this->token($bonus['player']))
            ->postJson("/api/quiz-sessions/{$bonus['sessionId']}/power-ups", ['type' => 'bonus'])
            ->assertOk();
        $this->withToken($this->token($bonus['player']))
            ->postJson("/api/quiz-sessions/{$bonus['sessionId']}/answer", ['option_id' => $bonus['correctId']])
            ->assertOk();
        $this->withToken($this->token($bonus['host']))->postJson("/api/quiz-sessions/{$bonus['sessionId']}/reveal")->assertOk();
        $slowNormal = $this->expectedNormalPointsForSession($bonus['sessionId']);
        $this->assertSame(
            $slowNormal + 500,
            QuizSessionAnswer::query()->where('quiz_session_id', $bonus['sessionId'])->value('points_awarded'),
        );

        $this->freezeTime();
        $doubleWrong = $this->bootLiveQuestion(1);
        $this->travel(10)->seconds();
        $this->withToken($this->token($doubleWrong['player']))
            ->postJson("/api/quiz-sessions/{$doubleWrong['sessionId']}/power-ups", ['type' => 'double'])
            ->assertOk();
        $this->withToken($this->token($doubleWrong['player']))
            ->postJson("/api/quiz-sessions/{$doubleWrong['sessionId']}/answer", ['option_id' => $doubleWrong['wrongId']])
            ->assertOk();
        $this->withToken($this->token($doubleWrong['host']))->postJson("/api/quiz-sessions/{$doubleWrong['sessionId']}/reveal")->assertOk();
        $doubleNormal = $this->expectedNormalPointsForSession($doubleWrong['sessionId']);
        $this->assertSame(-$doubleNormal, QuizSessionAnswer::query()->where('quiz_session_id', $doubleWrong['sessionId'])->value('points_awarded'));
        $this->assertNotSame(-$doubleNormal * 2, QuizSessionAnswer::query()->where('quiz_session_id', $doubleWrong['sessionId'])->value('points_awarded'));
    }

    public function test_ranking_uses_score_after_double_penalty(): void
    {
        $this->freezeTime();
        $ctx = $this->bootLiveLobby(1);
        $rival = User::factory()->create(['is_approved' => true, 'name' => 'Rival']);
        $this->withToken($this->token($rival))->postJson('/api/quiz-sessions/join', ['pin' => $ctx['pin']])->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")->assertOk();
        $session = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId']);
        $correctId = $session->currentQuestion->options->firstWhere('is_correct', true)->id;
        $wrongId = $session->currentQuestion->options->firstWhere('is_correct', false)->id;

        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/power-ups", ['type' => 'double'])
            ->assertOk();
        $this->withToken($this->token($ctx['player']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $wrongId])
            ->assertOk();
        $this->withToken($this->token($rival))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/answer", ['option_id' => $correctId])
            ->assertOk();
        $this->withToken($this->token($ctx['host']))->postJson("/api/quiz-sessions/{$ctx['sessionId']}/reveal")->assertOk();

        $players = collect($this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json('players'));
        $normal = $this->expectedNormalPointsForSession($ctx['sessionId']);
        $this->assertSame($rival->id, $players[0]['user_id']);
        $this->assertSame(1, $players[0]['rank']);
        $this->assertSame($normal, $players[0]['score']);
        $this->assertSame($ctx['player']->id, $players[1]['user_id']);
        $this->assertSame(2, $players[1]['rank']);
        $this->assertSame(-$normal, $players[1]['score']);
    }

    private function expectedNormalPointsForSession(int $sessionId, int $currentStreak = 0): int
    {
        $session = QuizSession::with('currentQuestion')->findOrFail($sessionId);
        $question = $session->currentQuestion;
        $limitMs = max(1, (int) $question->time_limit_seconds * 1000);
        $remainingMs = $session->question_ends_at
            ? (int) max(0, $session->question_ends_at->getTimestampMs() - now()->getTimestampMs())
            : $limitMs;
        $game = app(QuizGameService::class);

        return (int) round($game->basePoints((int) $question->points_base, $remainingMs, $limitMs) * $game->streakMultiplier($currentStreak + 1));
    }

    private function bootLiveQuestion(int $questionCount = 2): array
    {
        $ctx = $this->bootLiveLobby($questionCount);
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/start")
            ->assertOk();

        $session = QuizSession::with('currentQuestion.options')->findOrFail($ctx['sessionId']);
        $ctx['correctId'] = $session->currentQuestion->options->firstWhere('is_correct', true)->id;
        $ctx['wrongId'] = $session->currentQuestion->options->firstWhere('is_correct', false)->id;

        return $ctx;
    }
}
