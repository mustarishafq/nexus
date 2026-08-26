<?php

namespace Tests\Feature;

use App\Models\ExpReward;
use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\QuizSession;
use App\Models\QuizSessionPlayer;
use App\Models\User;
use App\Services\QuizGameService;
use App\Support\ApiTokenAuth;
use App\Support\GamificationCatalog;
use App\Support\QuizGameSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\GrantsUserRoleQuizPlayAccess;
use Tests\TestCase;

class QuizExpTest extends TestCase
{
    use RefreshDatabase;
    use GrantsUserRoleQuizPlayAccess;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    public function test_completion_exp_table_matches_rank(): void
    {
        $this->assertSame(20, QuizGameService::completionExpForRank(1));
        $this->assertSame(15, QuizGameService::completionExpForRank(2));
        $this->assertSame(10, QuizGameService::completionExpForRank(3));
        $this->assertSame(5, QuizGameService::completionExpForRank(4));
        $this->assertSame(5, QuizGameService::completionExpForRank(10));
        $this->assertSame(2, QuizGameService::completionExpForRank(11));
        $this->assertSame(2, QuizGameService::completionExpForRank(50));
        $this->assertSame(0, QuizGameService::completionExpForRank(0));
    }

    public function test_quiz_complete_is_not_listed_as_a_mission(): void
    {
        $keys = collect(GamificationCatalog::serializedActions())->pluck('action_key');
        $this->assertContains('clock_in', $keys);
        $this->assertNotContains('quiz_complete', $keys);
        $this->assertNotNull(GamificationCatalog::action('quiz_complete'));
    }

    /**
     * @return array{host: User, players: list<User>, sessionId: int}
     */
    private function finishLiveWithPlayers(int $playerCount): array
    {
        $host = User::factory()->create(['is_approved' => true, 'name' => 'Host', 'exp_total' => 0]);
        $quiz = Quiz::create([
            'user_id' => $host->id,
            'title' => 'EXP',
            'status' => Quiz::STATUS_PUBLISHED,
        ]);
        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'prompt' => 'Q0',
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        $correct = QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Yes', 'is_correct' => true, 'sort_order' => 0]);
        QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'No', 'is_correct' => false, 'sort_order' => 1]);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;

        $players = [];
        for ($i = 0; $i < $playerCount; $i++) {
            $player = User::factory()->create(['is_approved' => true, 'name' => 'P'.$i, 'exp_total' => 100]);
            $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
            $players[] = $player;
        }

        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();
        $session = QuizSession::with('players')->findOrFail($sessionId);
        foreach ($session->players as $index => $row) {
            $row->update(['joined_at' => now()->subSeconds(100 - $index)]);
        }

        foreach ($players as $index => $player) {
            if ($index === $playerCount - 1 && $playerCount > 1) {
                continue;
            }
            $this->withToken($this->token($player))
                ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
                ->assertOk();
        }

        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();
        $this->assertSame(QuizSession::STATUS_FINISHED, QuizSession::findOrFail($sessionId)->status);

        return compact('host', 'players', 'sessionId');
    }

    public function test_first_second_and_third_receive_rank_exp(): void
    {
        $ctx = $this->finishLiveWithPlayers(3);
        $ranked = $this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json('players');

        $byRank = collect($ranked)->keyBy('rank');
        $this->assertSame(20, $this->expFor($byRank[1]['user_id'], $ctx['sessionId']));
        $this->assertSame(15, $this->expFor($byRank[2]['user_id'], $ctx['sessionId']));
        $this->assertSame(10, $this->expFor($byRank[3]['user_id'], $ctx['sessionId']));

        $first = User::find($byRank[1]['user_id']);
        $this->assertSame(100, $first->exp_total);
        $this->assertSame(ExpReward::STATUS_PENDING, $this->expStatus($byRank[1]['user_id'], $ctx['sessionId']));
        $podium = $this->withToken($this->token($first))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json();
        $this->assertSame(20, $podium['exp_earned']);
        $this->assertSame(ExpReward::STATUS_PENDING, $podium['exp_status']);
    }

    public function test_fourth_through_tenth_and_eleventh_receive_table_amounts(): void
    {
        $ctx = $this->finishLiveWithPlayers(11);
        $ranked = $this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json('players');

        $byRank = collect($ranked)->keyBy('rank');
        $this->assertSame(5, $this->expFor($byRank[4]['user_id'], $ctx['sessionId']));
        $this->assertSame(5, $this->expFor($byRank[10]['user_id'], $ctx['sessionId']));
        $this->assertSame(2, $this->expFor($byRank[11]['user_id'], $ctx['sessionId']));
    }

    public function test_disabled_live_exp_awards_zero(): void
    {
        QuizGameSettings::save([
            'live_exp_enabled' => false,
            'rank_1' => 20,
            'rank_2' => 15,
            'rank_3' => 10,
            'rank_4_to_10' => 5,
            'rank_11_plus' => 2,
        ]);

        $this->assertSame(0, QuizGameService::completionExpForRank(1));
        $ctx = $this->finishLiveWithPlayers(1);
        $this->assertSame(0, $this->expFor($ctx['players'][0]->id, $ctx['sessionId']));
    }

    public function test_custom_live_exp_amounts_are_awarded(): void
    {
        QuizGameSettings::save([
            'live_exp_enabled' => true,
            'rank_1' => 50,
            'rank_2' => 15,
            'rank_3' => 10,
            'rank_4_to_10' => 5,
            'rank_11_plus' => 2,
        ]);

        $this->assertSame(50, QuizGameService::completionExpForRank(1));
        $ctx = $this->finishLiveWithPlayers(1);
        $this->assertSame(50, $this->expFor($ctx['players'][0]->id, $ctx['sessionId']));
    }

    public function test_host_who_is_not_a_player_does_not_receive_exp(): void
    {
        $ctx = $this->finishLiveWithPlayers(1);
        $this->assertSame(0, ExpReward::query()->where('user_id', $ctx['host']->id)->count());
        $payload = $this->withToken($this->token($ctx['host']))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json();
        $this->assertNull($payload['exp_earned']);
        $this->assertFalse($payload['is_player']);
    }

    public function test_player_who_does_not_finish_async_receives_zero(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true, 'exp_total' => 40]);
        $quiz = Quiz::create(['user_id' => $owner->id, 'title' => 'Async', 'status' => Quiz::STATUS_PUBLISHED]);
        for ($i = 0; $i < 2; $i++) {
            $question = QuizQuestion::create([
                'quiz_id' => $quiz->id,
                'prompt' => "Q{$i}",
                'time_limit_seconds' => 20,
                'points_base' => 1000,
                'sort_order' => $i,
            ]);
            QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Yes', 'is_correct' => true, 'sort_order' => 0]);
            QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'No', 'is_correct' => false, 'sort_order' => 1]);
        }

        $session = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();
        $optionId = $session['quiz']['questions'][0]['options'][0]['id'];
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $optionId])
            ->assertOk()
            ->assertJsonPath('session.status', 'question');

        $this->assertSame(0, ExpReward::query()->where('user_id', $player->id)->count());
        $player->refresh();
        $this->assertSame(40, $player->exp_total);
    }

    public function test_async_completion_does_not_award_quiz_exp(): void
    {
        $owner = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true, 'exp_total' => 40]);
        $quiz = Quiz::create(['user_id' => $owner->id, 'title' => 'Async', 'status' => Quiz::STATUS_PUBLISHED]);
        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'prompt' => 'Q0',
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        $correct = QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Yes', 'is_correct' => true, 'sort_order' => 0]);
        QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'No', 'is_correct' => false, 'sort_order' => 1]);

        $session = $this->withToken($this->token($player))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'async'])
            ->assertCreated()
            ->json();
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$session['id']}/answer", ['option_id' => $correct->id])
            ->assertOk()
            ->assertJsonPath('session.status', 'finished');

        $this->assertSame(0, ExpReward::query()->where('user_id', $player->id)->count());
        $this->assertSame(40, (int) $player->fresh()->exp_total);
        $payload = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$session['id']}")
            ->json();
        $this->assertNull($payload['exp_earned']);
        $analytics = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$session['id']}/analytics")
            ->json();
        $this->assertNull($analytics['me']['exp_earned'] ?? null);
    }

    public function test_claiming_pending_live_quiz_exp_adds_to_overall_total(): void
    {
        $ctx = $this->finishLiveWithPlayers(1);
        $player = $ctx['players'][0];
        $this->assertSame(100, (int) $player->fresh()->exp_total);

        $reward = ExpReward::query()
            ->where('user_id', $player->id)
            ->where('action_key', QuizGameService::COMPLETION_EXP_ACTION)
            ->where('source_id', (string) $ctx['sessionId'])
            ->first();
        $this->assertNotNull($reward);
        $this->assertSame(ExpReward::STATUS_PENDING, $reward->status);
        $this->assertSame(20, (int) $reward->amount);

        $me = $this->withToken($this->token($player))
            ->getJson('/api/gamification/me')
            ->assertOk()
            ->json();
        $this->assertSame(1, $me['pending_count']);
        $this->assertSame(20, $me['pending_amount']);

        $this->withToken($this->token($player))
            ->postJson("/api/gamification/rewards/{$reward->id}/claim")
            ->assertOk()
            ->assertJsonPath('reward.status', 'claimed')
            ->assertJsonPath('exp_total', 120);

        $this->assertSame(120, (int) $player->fresh()->exp_total);
        $this->assertSame(ExpReward::STATUS_CLAIMED, $reward->fresh()->status);
        $this->withToken($this->token($player))
            ->postJson("/api/gamification/rewards/{$reward->id}/claim")
            ->assertStatus(422);
    }

    public function test_leaving_lobby_before_start_receives_zero(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true, 'exp_total' => 10]);
        $leaver = User::factory()->create(['is_approved' => true, 'exp_total' => 10]);
        $quiz = Quiz::create(['user_id' => $host->id, 'title' => 'Leave', 'status' => Quiz::STATUS_PUBLISHED]);
        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'prompt' => 'Q',
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        $correct = QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Yes', 'is_correct' => true, 'sort_order' => 0]);
        QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'No', 'is_correct' => false, 'sort_order' => 1]);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($leaver))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($leaver))->postJson("/api/quiz-sessions/{$sessionId}/leave")->assertOk();

        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
            ->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();

        $this->assertSame(0, ExpReward::query()->where('user_id', $leaver->id)->count());
        $this->assertSame(20, $this->expFor($player->id, $sessionId));
        $this->assertSame(10, (int) $player->fresh()->exp_total);
        $this->assertSame(ExpReward::STATUS_PENDING, $this->expStatus($player->id, $sessionId));
    }

    public function test_disconnected_player_who_never_reconnects_receives_zero_exp(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $stayer = User::factory()->create(['is_approved' => true, 'exp_total' => 10]);
        $gone = User::factory()->create(['is_approved' => true, 'exp_total' => 10]);
        $quiz = Quiz::create(['user_id' => $host->id, 'title' => 'Drop', 'status' => Quiz::STATUS_PUBLISHED]);
        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'prompt' => 'Q',
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        $correct = QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Yes', 'is_correct' => true, 'sort_order' => 0]);
        QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'No', 'is_correct' => false, 'sort_order' => 1]);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($stayer))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($gone))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();

        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();
        $this->withToken($this->token($stayer))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
            ->assertOk();

        $goneRow = QuizSessionPlayer::query()
            ->where('quiz_session_id', $sessionId)
            ->where('user_id', $gone->id)
            ->firstOrFail();
        $this->assertDatabaseHas('quiz_session_players', ['id' => $goneRow->id]);
        $goneRow->update(['last_seen_at' => now()->subMinutes(5)]);

        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();

        $this->assertSame(0, ExpReward::query()->where('user_id', $gone->id)->count());
        $this->assertSame(10, (int) $gone->fresh()->exp_total);
        $this->assertSame(20, $this->expFor($stayer->id, $sessionId));
        $this->assertSame(ExpReward::STATUS_PENDING, $this->expStatus($stayer->id, $sessionId));
    }

    public function test_disconnected_player_who_reconnects_before_finish_receives_exp(): void
    {
        $host = User::factory()->create(['is_approved' => true]);
        $player = User::factory()->create(['is_approved' => true, 'exp_total' => 10]);
        $quiz = Quiz::create(['user_id' => $host->id, 'title' => 'Rejoin', 'status' => Quiz::STATUS_PUBLISHED]);
        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'prompt' => 'Q',
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        $correct = QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Yes', 'is_correct' => true, 'sort_order' => 0]);
        QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'No', 'is_correct' => false, 'sort_order' => 1]);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();

        QuizSessionPlayer::query()
            ->where('quiz_session_id', $sessionId)
            ->where('user_id', $player->id)
            ->update(['last_seen_at' => now()->subMinutes(5)]);

        $this->withToken($this->token($player))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$sessionId}")
            ->assertOk();
        $this->withToken($this->token($player))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
            ->assertOk();

        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();

        $this->assertSame(20, $this->expFor($player->id, $sessionId));
        $this->assertSame(10, (int) $player->fresh()->exp_total);
        $this->assertSame(ExpReward::STATUS_PENDING, $this->expStatus($player->id, $sessionId));
    }

    public function test_refresh_analytics_and_repeated_finish_do_not_award_twice(): void
    {
        $ctx = $this->finishLiveWithPlayers(1);
        $player = $ctx['players'][0];
        $before = (int) $player->fresh()->exp_total;
        $this->assertSame(20, $this->expFor($player->id, $ctx['sessionId']));

        $this->withToken($this->token($player))->getJson("/api/quiz-sessions/{$ctx['sessionId']}")->assertOk();
        $this->withToken($this->token($player))->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")->assertOk();
        $this->withToken($this->token($player))->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")->assertOk();
        $this->withToken($this->token($ctx['host']))
            ->postJson("/api/quiz-sessions/{$ctx['sessionId']}/next")
            ->assertStatus(422);

        $this->assertSame(1, ExpReward::query()->where('user_id', $player->id)->where('action_key', 'quiz_complete')->count());
        $this->assertSame($before, (int) $player->fresh()->exp_total);

        $podium = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}")
            ->json();
        $this->assertSame(20, $podium['exp_earned']);
        $this->assertSame(ExpReward::STATUS_PENDING, $podium['exp_status']);
        $analytics = $this->withToken($this->token($player))
            ->getJson("/api/quiz-sessions/{$ctx['sessionId']}/analytics")
            ->json();
        $this->assertSame(20, $analytics['me']['exp_earned']);
        $this->assertSame(ExpReward::STATUS_PENDING, $analytics['me']['exp_status']);
        $this->assertSame('quiz_complete', ExpReward::query()->where('user_id', $player->id)->value('action_key'));
        $this->assertSame('quiz_session', ExpReward::query()->where('user_id', $player->id)->value('source_type'));
        $this->assertSame(ExpReward::STATUS_PENDING, ExpReward::query()->where('user_id', $player->id)->value('status'));
    }

    public function test_double_penalty_changes_rank_but_not_exp_amounts(): void
    {
        $this->freezeTime();
        $host = User::factory()->create(['is_approved' => true, 'name' => 'Host']);
        $penalty = User::factory()->create(['is_approved' => true, 'name' => 'Penalty', 'exp_total' => 100]);
        $safe = User::factory()->create(['is_approved' => true, 'name' => 'Safe', 'exp_total' => 100]);
        $quiz = Quiz::create(['user_id' => $host->id, 'title' => 'EXP Double', 'status' => Quiz::STATUS_PUBLISHED]);
        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'prompt' => 'Q0',
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        $correct = QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'Yes', 'is_correct' => true, 'sort_order' => 0]);
        $wrong = QuizOption::create(['quiz_question_id' => $question->id, 'label' => 'No', 'is_correct' => false, 'sort_order' => 1]);

        $sessionId = $this->withToken($this->token($host))
            ->postJson("/api/quizzes/{$quiz->id}/sessions", ['mode' => 'live'])
            ->assertCreated()
            ->json('id');
        $pin = QuizSession::findOrFail($sessionId)->pin;
        $this->withToken($this->token($penalty))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($safe))->postJson('/api/quiz-sessions/join', ['pin' => $pin])->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/start")->assertOk();

        $this->withToken($this->token($penalty))
            ->postJson("/api/quiz-sessions/{$sessionId}/power-ups", ['type' => 'double'])
            ->assertOk();
        $this->withToken($this->token($penalty))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $wrong->id])
            ->assertOk();
        $this->withToken($this->token($safe))
            ->postJson("/api/quiz-sessions/{$sessionId}/answer", ['option_id' => $correct->id])
            ->assertOk();

        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/reveal")->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();
        $this->withToken($this->token($host))->postJson("/api/quiz-sessions/{$sessionId}/next")->assertOk();

        $ranked = collect($this->withToken($this->token($host))
            ->getJson("/api/quiz-sessions/{$sessionId}")
            ->json('players'))
            ->keyBy('user_id');
        $this->assertSame(1, $ranked[$safe->id]['rank']);
        $this->assertSame(2, $ranked[$penalty->id]['rank']);
        $this->assertGreaterThan($ranked[$penalty->id]['score'], $ranked[$safe->id]['score']);

        $this->assertSame(20, $this->expFor($safe->id, $sessionId));
        $this->assertSame(15, $this->expFor($penalty->id, $sessionId));
        $this->assertSame(ExpReward::STATUS_PENDING, $this->expStatus($safe->id, $sessionId));
        $this->assertSame(ExpReward::STATUS_PENDING, $this->expStatus($penalty->id, $sessionId));
        $this->assertSame(100, (int) $safe->fresh()->exp_total);
        $this->assertSame(100, (int) $penalty->fresh()->exp_total);

        $reward = ExpReward::query()
            ->where('user_id', $safe->id)
            ->where('source_id', (string) $sessionId)
            ->firstOrFail();
        $this->withToken($this->token($safe))
            ->postJson("/api/gamification/rewards/{$reward->id}/claim")
            ->assertOk()
            ->assertJsonPath('exp_total', 120);
        $this->assertSame(120, (int) $safe->fresh()->exp_total);
        $this->assertSame(ExpReward::STATUS_CLAIMED, $reward->fresh()->status);
    }

    private function expFor(int $userId, int $sessionId): int
    {
        return (int) ExpReward::query()
            ->where('user_id', $userId)
            ->where('action_key', QuizGameService::COMPLETION_EXP_ACTION)
            ->where('source_type', QuizGameService::COMPLETION_EXP_SOURCE)
            ->where('source_id', (string) $sessionId)
            ->value('amount');
    }

    private function expStatus(int $userId, int $sessionId): ?string
    {
        return ExpReward::query()
            ->where('user_id', $userId)
            ->where('action_key', QuizGameService::COMPLETION_EXP_ACTION)
            ->where('source_type', QuizGameService::COMPLETION_EXP_SOURCE)
            ->where('source_id', (string) $sessionId)
            ->value('status');
    }
}
