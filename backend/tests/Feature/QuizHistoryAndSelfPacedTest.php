<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\QuizSessionAnswer;
use App\Models\QuizSessionPowerUp;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuizHistoryAndSelfPacedTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    private function makeQuiz(User $owner, int $questionCount = 2, array $attrs = []): Quiz
    {
        $quiz = Quiz::create(array_merge([
            'user_id' => $owner->id,
            'title' => 'Marvel',
            'description' => 'Heroes',
            'status' => Quiz::STATUS_PUBLISHED,
        ], $attrs));

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
                'label' => 'Wrong',
                'is_correct' => false,
                'sort_order' => 1,
            ]);
        }

        return $quiz->fresh(['questions.options']);
    }

    private function completeAsync(User $player, Quiz $quiz): array
    {
        $session = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertSuccessful()
            ->json();

        foreach ($quiz->questions as $question) {
            $correctId = $question->options->firstWhere('is_correct', true)->id;
            $session = $this->withToken($this->token($player))
                ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $correctId])
                ->assertOk()
                ->json('session');
        }

        $this->assertSame('finished', $session['status']);

        return $session;
    }

    private function finishLive(User $host, User $player, Quiz $quiz): int
    {
        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();

        $questionCount = $quiz->questions->count();
        for ($i = 0; $i < $questionCount; $i++) {
            $session = QuizSession::with('currentQuestion.options')->findOrFail($sessionId);
            $correct = $session->currentQuestion->options->firstWhere('is_correct', true);
            $this->withToken($this->token($player))
                ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id]);
            $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();
            $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();
            $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();
        }

        $this->assertSame(QuizSession::STATUS_FINISHED, QuizSession::findOrFail($sessionId)->status);
        $this->assertNotNull(QuizSession::findOrFail($sessionId)->finished_at);

        return $sessionId;
    }

    public function test_live_history_keeps_separate_finished_sessions(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($host, 1);

        $first = $this->finishLive($host, $player, $quiz);
        $this->travel(1)->hours();
        $second = $this->finishLive($host, $player, $quiz);

        $this->assertNotSame($first, $second);

        $history = $this->withToken($this->token($host))
            ->getJson("/api/quizzes/{$quiz->id}/history")
            ->assertOk()
            ->json();

        $this->assertCount(2, $history['live_sessions']);
        $ids = collect($history['live_sessions'])->pluck('id')->all();
        $this->assertEqualsCanonicalizing([$first, $second], $ids);
        $this->assertSame(1, $history['live_sessions'][0]['player_count']);

        $this->withToken($this->token($host))
            ->getJson("/api/quiz-sessions/{$first}/analytics")
            ->assertOk()
            ->assertJsonPath('session.id', $first);
        $this->withToken($this->token($host))
            ->getJson("/api/quiz-sessions/{$second}/analytics")
            ->assertOk()
            ->assertJsonPath('session.id', $second);

        $mine = $this->withToken($this->token($host))
            ->getJson('/api/quizzes?scope=mine')
            ->assertOk()
            ->json();
        $card = collect($mine)->firstWhere('id', $quiz->id);
        $this->assertSame(2, $card['live_session_count']);
        $this->assertNotEmpty($card['created_at']);
        $this->assertNotEmpty($card['updated_at']);
        $this->assertCount(2, $card['recent_live_sessions']);
    }

    public function test_stranger_cannot_view_history_or_self_paced_analytics(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $stranger = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1);

        $this->withToken($this->token($stranger))
            ->getJson("/api/quizzes/{$quiz->id}/history")
            ->assertForbidden();
        $this->withToken($this->token($stranger))
            ->getJson("/api/quizzes/{$quiz->id}/self-paced-analytics")
            ->assertForbidden();
    }

    public function test_self_paced_can_only_be_completed_once_and_refresh_resumes(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 2);

        $first = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();

        $resume = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertOk()
            ->json();
        $this->assertSame($first['id'], $resume['id']);

        $this->completeAsync($player, $quiz);

        $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['quiz']);

        $this->assertSame(1, QuizSession::query()->where('quiz_id', $quiz->id)->where('mode', 'async')->count());

        $published = $this->withToken($this->token($player))
            ->getJson('/api/quizzes?scope=published')
            ->assertOk()
            ->json();
        $card = collect($published)->firstWhere('id', $quiz->id);
        $this->assertSame('completed', $card['viewer_attempt']['status']);
        $this->assertSame($first['id'], $card['viewer_attempt']['session_id']);
    }

    public function test_self_paced_analytics_are_owner_only_and_hide_ranking_from_players(): void
    {
        $company = Company::create(['name' => 'Marvel Corp']);
        $owner = User::factory()->create(['is_approved' => true, 'company_id' => $company->id]);
        $alice = User::factory()->create(['is_approved' => true, 'company_id' => $company->id, 'name' => 'Alice']);
        $bob = User::factory()->create(['is_approved' => true, 'company_id' => $company->id, 'name' => 'Bob']);
        $quiz = $this->makeQuiz($owner, 1);

        $aliceSession = $this->completeAsync($alice, $quiz);
        $bobSession = $this->completeAsync($bob, $quiz);

        $report = $this->withToken($this->token($owner))
            ->getJson("/api/quizzes/{$quiz->id}/self-paced-analytics")
            ->assertOk()
            ->json();

        $this->assertSame(2, $report['summary']['completed_count']);
        $this->assertSame(3, $report['summary']['eligible_count']);
        $this->assertArrayHasKey('average_response_ms', $report['summary']);
        $this->assertNotEmpty($report['summary']['winner']['display_name'] ?? null);
        $this->assertCount(2, $report['participants']);
        $this->assertTrue(collect($report['participants'])->every(fn ($row) => isset($row['rank'], $row['questions'], $row['best_streak'], $row['power_ups_used'])));
        $this->assertNotEmpty($report['question_quality']);

        $this->withToken($this->token($alice))
            ->getJson("/api/quizzes/{$quiz->id}/self-paced-analytics")
            ->assertForbidden();

        $aliceView = $this->withToken($this->token($alice))
            ->getJson("/api/quiz-sessions/{$aliceSession['id']}/analytics")
            ->assertOk()
            ->json();
        $this->assertTrue($aliceView['viewer']['is_player']);
        $this->assertSame([], $aliceView['players']);
        $this->assertNotEmpty($aliceView['me']);

        $this->withToken($this->token($alice))
            ->getJson("/api/quiz-sessions/{$bobSession['id']}/analytics")
            ->assertForbidden();
    }

    public function test_admin_sees_own_self_paced_results_not_overall_analytics(): void
    {
        $owner = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $quiz = $this->makeQuiz($owner, 1);

        $adminSession = $this->completeAsync($admin, $quiz);

        $this->withToken($this->token($admin))
            ->getJson("/api/quizzes/{$quiz->id}/self-paced-analytics")
            ->assertForbidden();
        $this->withToken($this->token($admin))
            ->getJson("/api/quizzes/{$quiz->id}/history")
            ->assertForbidden();

        $adminView = $this->withToken($this->token($admin))
            ->getJson("/api/quiz-sessions/{$adminSession['id']}/analytics")
            ->assertOk()
            ->json();

        $this->assertTrue($adminView['viewer']['is_player']);
        $this->assertFalse($adminView['viewer']['is_host']);
        $this->assertSame($admin->id, $adminView['me']['user_id']);
        $this->assertSame([], $adminView['players']);
        $this->assertSame([], $adminView['question_quality']);

        $this->withToken($this->token($owner))
            ->getJson("/api/quizzes/{$quiz->id}/self-paced-analytics")
            ->assertOk();
    }

    public function test_self_paced_power_ups_default_off_and_can_be_enabled(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1);

        $off = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();
        $this->assertEmpty($off['my_power_ups'] ?? []);
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$off['id']}/power-ups", ['type' => 'double'])
            ->assertStatus(422);

        $enabled = $this->makeQuiz($owner, 1, ['title' => 'Powered', 'async_power_ups_enabled' => true]);
        $on = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$enabled->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();
        $this->assertNotEmpty($on['my_power_ups']);
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$on['id']}/power-ups", ['type' => 'double'])
            ->assertOk();

        $correctId = $enabled->questions->first()->options->firstWhere('is_correct', true)->id;
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$on['id']}/answer", ['option_id' => $correctId])
            ->assertOk();
        $row = QuizSessionAnswer::query()
            ->where('quiz_session_id', $on['id'])
            ->where('user_id', $player->id)
            ->first();
        $this->assertNotNull($row);
        $this->assertSame(QuizSessionPowerUp::TYPE_DOUBLE, $row->power_up_used);
    }

    public function test_draft_quiz_can_still_be_hosted_live_after_publish_and_self_paced(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1, ['status' => Quiz::STATUS_DRAFT]);

        $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertStatus(422);

        $liveId = $this->withToken($this->token($owner))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $this->assertNotNull($liveId);

        $quiz->update(['status' => Quiz::STATUS_PUBLISHED]);
        $this->completeAsync($player, $quiz->fresh(['questions.options']));
        $this->finishLive($owner, $player, $quiz->fresh(['questions.options']));

        $history = $this->withToken($this->token($owner))
            ->getJson("/api/quizzes/{$quiz->id}/history")
            ->assertOk()
            ->json();
        $this->assertGreaterThanOrEqual(1, count($history['live_sessions']));
        $this->assertSame(1, $history['self_paced']['completed_count']);
    }

    public function test_async_still_awards_no_quiz_exp(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1);
        $session = $this->completeAsync($player, $quiz);

        $analytics = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$session['id']}/analytics")
            ->assertOk()
            ->json();
        $this->assertNull($analytics['me']['exp_earned']);
    }

    public function test_owner_can_delete_finished_live_session(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($host, 1);
        $sessionId = $this->finishLive($host, $player, $quiz);

        $this->withToken($this->token($host))
            ->deleteJson("/api/quiz-sessions/{$sessionId}")
            ->assertOk();

        $this->assertDatabaseMissing('quiz_sessions', ['id' => $sessionId]);
        $this->assertDatabaseMissing('quiz_session_players', ['quiz_session_id' => $sessionId]);

        $history = $this->withToken($this->token($host))
            ->getJson("/api/quizzes/{$quiz->id}/history")
            ->assertOk()
            ->json();
        $this->assertCount(0, $history['live_sessions']);
    }

    public function test_owner_can_delete_async_attempt_and_player_can_retry(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1);
        $session = $this->completeAsync($player, $quiz);

        $this->withToken($this->token($player))
            ->deleteJson("/api/quiz-sessions/{$session['id']}")
            ->assertForbidden();

        $this->withToken($this->token($owner))
            ->deleteJson("/api/quiz-sessions/{$session['id']}")
            ->assertOk();

        $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated();
    }

    public function test_stranger_cannot_delete_session(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $stranger = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1);
        $session = $this->completeAsync($player, $quiz);

        $this->withToken($this->token($stranger))
            ->deleteJson("/api/quiz-sessions/{$session['id']}")
            ->assertForbidden();
        $this->assertDatabaseHas('quiz_sessions', ['id' => $session['id']]);
    }

    public function test_active_live_session_cannot_be_deleted(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($host, 1);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();

        $this->withToken($this->token($host))
            ->deleteJson("/api/quiz-sessions/{$sessionId}")
            ->assertStatus(422);

        $this->assertDatabaseHas('quiz_sessions', ['id' => $sessionId]);
    }

    public function test_lobby_and_in_progress_async_sessions_can_be_deleted(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1);

        $lobbyId = $this->withToken($this->token($owner))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $this->withToken($this->token($owner))
            ->deleteJson("/api/quiz-sessions/{$lobbyId}")
            ->assertOk();
        $this->assertDatabaseMissing('quiz_sessions', ['id' => $lobbyId]);

        $asyncId = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json('id');

        $report = $this->withToken($this->token($owner))
            ->getJson("/api/quizzes/{$quiz->id}/self-paced-analytics")
            ->assertOk()
            ->json();
        $this->assertSame(1, $report['summary']['in_progress_count']);
        $this->assertCount(1, $report['in_progress']);
        $this->assertSame($asyncId, $report['in_progress'][0]['session_id']);

        $this->withToken($this->token($owner))
            ->deleteJson("/api/quiz-sessions/{$asyncId}")
            ->assertOk();
        $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated();
    }

    public function test_draft_does_not_store_self_paced_settings(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);

        $created = $this->withToken($this->token($owner))
            ->postJson('/api/quizzes', [
                'title' => 'Draft settings',
                'status' => Quiz::STATUS_DRAFT,
                'async_power_ups_enabled' => true,
                'async_deadline_at' => now()->addDay()->toIso8601String(),
                'questions' => [[
                    'prompt' => 'Question 0',
                    'time_limit_seconds' => 20,
                    'points_base' => 1000,
                    'options' => [
                        ['label' => 'Correct', 'is_correct' => true],
                        ['label' => 'Wrong', 'is_correct' => false],
                    ],
                ]],
            ])
            ->assertCreated()
            ->json();

        $this->assertFalse($created['async_power_ups_enabled']);
        $this->assertNull($created['async_deadline_at']);

        $published = $this->withToken($this->token($owner))
            ->putJson("/api/quizzes/{$created['id']}", [
                'status' => Quiz::STATUS_PUBLISHED,
                'async_power_ups_enabled' => true,
                'async_deadline_at' => now()->addDays(2)->toIso8601String(),
            ])
            ->assertOk()
            ->json();
        $this->assertTrue($published['async_power_ups_enabled']);
        $this->assertNotNull($published['async_deadline_at']);

        $draftAgain = $this->withToken($this->token($owner))
            ->putJson("/api/quizzes/{$created['id']}", [
                'status' => Quiz::STATUS_DRAFT,
            ])
            ->assertOk()
            ->json();
        $this->assertFalse($draftAgain['async_power_ups_enabled']);
        $this->assertNull($draftAgain['async_deadline_at']);
    }

    public function test_published_quiz_can_have_optional_or_no_deadline(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $open = $this->makeQuiz($owner, 1, ['title' => 'Open']);
        $this->assertNull($open->async_deadline_at);

        $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$open->id}/sessions", ['mode' => 'async'])
            ->assertCreated();

        $deadline = now()->addDay();
        $timed = $this->makeQuiz($owner, 1, [
            'title' => 'Timed',
            'async_deadline_at' => $deadline,
        ]);
        $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$timed->id}/sessions", ['mode' => 'async'])
            ->assertCreated();
    }

    public function test_expired_deadline_blocks_new_self_paced_attempts_and_completions(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $alice = User::factory()->create(['is_approved' => true]);
        $bob = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1, [
            'async_deadline_at' => now()->addHour(),
        ]);

        $session = $this->withToken($this->token($alice))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();

        $this->travel(2)->hours();

        $this->withToken($this->token($bob))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['quiz']);

        $this->withToken($this->token($alice))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertStatus(422);

        $correctId = $quiz->questions->first()->options->firstWhere('is_correct', true)->id;
        $this->withToken($this->token($alice))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $correctId])
            ->assertStatus(422);

        $this->assertSame(QuizSession::STATUS_QUESTION, QuizSession::findOrFail($session['id'])->status);

        $this->withToken($this->token($owner))
            ->getJson("/api/quizzes/{$quiz->id}/self-paced-analytics")
            ->assertOk()
            ->assertJsonPath('summary.in_progress_count', 1);
    }

    public function test_unpublish_hides_catalog_but_keeps_history_and_republish_restores_play(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $alice = User::factory()->create(['is_approved' => true]);
        $bob = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1);

        $async = $this->completeAsync($alice, $quiz);
        $liveId = $this->finishLive($owner, $alice, $quiz);

        $this->withToken($this->token($owner))
            ->putJson("/api/quizzes/{$quiz->id}", ['status' => Quiz::STATUS_DRAFT])
            ->assertOk()
            ->assertJsonPath('status', Quiz::STATUS_DRAFT);

        $this->assertDatabaseHas('quiz_sessions', ['id' => $async['id'], 'mode' => 'async']);
        $this->assertDatabaseHas('quiz_sessions', ['id' => $liveId, 'mode' => 'live']);

        $published = $this->withToken($this->token($bob))
            ->getJson('/api/quizzes?scope=published')
            ->assertOk()
            ->json();
        $this->assertNull(collect($published)->firstWhere('id', $quiz->id));

        $mine = $this->withToken($this->token($owner))
            ->getJson('/api/quizzes?scope=mine')
            ->assertOk()
            ->json();
        $this->assertNotNull(collect($mine)->firstWhere('id', $quiz->id));

        $this->withToken($this->token($bob))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertStatus(422);

        $history = $this->withToken($this->token($owner))
            ->getJson("/api/quizzes/{$quiz->id}/history")
            ->assertOk()
            ->json();
        $this->assertSame(1, $history['self_paced']['completed_count']);
        $this->assertCount(1, $history['live_sessions']);

        $this->withToken($this->token($owner))
            ->getJson("/api/quizzes/{$quiz->id}/self-paced-analytics")
            ->assertOk()
            ->assertJsonPath('summary.completed_count', 1);
        $this->withToken($this->token($owner))
            ->getJson("/api/quiz-sessions/{$liveId}/analytics")
            ->assertOk();
        $this->withToken($this->token($alice))
            ->getJson("/api/quiz-sessions/{$async['id']}/analytics")
            ->assertOk()
            ->assertJsonPath('me.exp_earned', null);

        $this->withToken($this->token($owner))
            ->putJson("/api/quizzes/{$quiz->id}", ['status' => Quiz::STATUS_PUBLISHED])
            ->assertOk();

        $this->withToken($this->token($bob))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated();

        $liveAgain = $this->withToken($this->token($owner))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated();
        $this->assertNotNull($liveAgain->json('id'));
    }

    public function test_creator_cannot_start_self_paced_attempt(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1);

        $this->withToken($this->token($owner))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['quiz']);

        $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated();
    }

    public function test_creator_self_paced_preview_uses_power_ups_and_skips_analytics(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true]);
        $quiz = $this->makeQuiz($owner, 1, ['async_power_ups_enabled' => true]);

        $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async', 'preview' => true])
            ->assertStatus(422);

        $preview = $this->withToken($this->token($owner))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async', 'preview' => true])
            ->assertCreated()
            ->json();
        $this->assertTrue($preview['is_preview']);
        $this->assertNotEmpty($preview['my_power_ups']);

        $correctId = $quiz->questions->first()->options->firstWhere('is_correct', true)->id;
        $this->withToken($this->token($owner))
            ->postJson("/api/quiz-sessions/{$preview['id']}/answer", ['option_id' => $correctId])
            ->assertOk()
            ->assertJsonPath('session.status', 'finished');

        $this->withToken($this->token($owner))
            ->getJson("/api/quiz-sessions/{$preview['id']}/analytics")
            ->assertStatus(422);

        $report = $this->withToken($this->token($owner))
            ->getJson("/api/quizzes/{$quiz->id}/self-paced-analytics")
            ->assertOk()
            ->json();
        $this->assertSame(0, $report['summary']['completed_count']);
        $this->assertCount(0, $report['participants']);

        $again = $this->withToken($this->token($owner))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async', 'preview' => true])
            ->assertCreated()
            ->json();
        $this->assertNotSame($preview['id'], $again['id']);
        $this->assertTrue($again['is_preview']);

        $this->withToken($this->token($owner))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertStatus(422);
    }
}
