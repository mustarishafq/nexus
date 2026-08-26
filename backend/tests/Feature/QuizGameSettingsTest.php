<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\QuizGameService;
use App\Support\ApiTokenAuth;
use App\Support\QuizGameSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\GrantsUserRoleQuizPlayAccess;
use Tests\TestCase;

class QuizGameSettingsTest extends TestCase
{
    use RefreshDatabase;
    use GrantsUserRoleQuizPlayAccess;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    public function test_user_without_manage_cannot_read_or_update_games_settings(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $this->withToken($this->token($user))
            ->getJson('/api/games/settings')
            ->assertForbidden();

        $this->withToken($this->token($user))
            ->putJson('/api/games/settings', QuizGameSettings::DEFAULTS)
            ->assertForbidden();
    }

    public function test_admin_can_read_defaults_and_update_games_settings(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $this->withToken($this->token($admin))
            ->getJson('/api/games/settings')
            ->assertOk()
            ->assertJsonPath('live_exp_enabled', true)
            ->assertJsonPath('rank_1', 20)
            ->assertJsonPath('rank_2', 15)
            ->assertJsonPath('rank_3', 10)
            ->assertJsonPath('rank_4_to_10', 5)
            ->assertJsonPath('rank_11_plus', 2)
            ->assertJsonPath('published_exp_enabled', false);

        $this->withToken($this->token($admin))
            ->putJson('/api/games/settings', [
                'live_exp_enabled' => false,
                'rank_1' => 40,
                'rank_2' => 12,
                'rank_3' => 8,
                'rank_4_to_10' => 3,
                'rank_11_plus' => 1,
            ])
            ->assertOk()
            ->assertJsonPath('live_exp_enabled', false)
            ->assertJsonPath('rank_1', 40)
            ->assertJsonPath('published_exp_enabled', false);

        $this->assertSame(0, QuizGameService::completionExpForRank(1));
        $this->assertFalse(QuizGameSettings::current()['live_exp_enabled']);
        $this->assertSame(40, QuizGameSettings::current()['rank_1']);

        $this->withToken($this->token($admin))
            ->getJson('/api/games/settings')
            ->assertOk()
            ->assertJsonPath('live_exp_enabled', false)
            ->assertJsonPath('rank_1', 40);
    }

    public function test_award_exp_toggle_accepts_integer_zero_and_stays_off(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $this->withToken($this->token($admin))
            ->putJson('/api/games/settings', [
                'live_exp_enabled' => 0,
                'rank_1' => 20,
                'rank_2' => 15,
                'rank_3' => 10,
                'rank_4_to_10' => 5,
                'rank_11_plus' => 2,
            ])
            ->assertOk()
            ->assertJsonPath('live_exp_enabled', false);

        $this->withToken($this->token($admin))
            ->getJson('/api/games/settings')
            ->assertOk()
            ->assertJsonPath('live_exp_enabled', false);

        $this->assertFalse(QuizGameSettings::current()['live_exp_enabled']);
        $this->assertSame(0, QuizGameService::completionExpForRank(1));
    }
}
