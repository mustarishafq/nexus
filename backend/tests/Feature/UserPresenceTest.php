<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\UserPresenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserPresenceTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('a', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_heartbeat_requires_authentication(): void
    {
        $this->postJson('/api/presence/heartbeat')
            ->assertUnauthorized();
    }

    public function test_heartbeat_marks_user_online(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->postJson('/api/presence/heartbeat')
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertTrue(app(UserPresenceService::class)->isOnline($user->id));
    }

    public function test_online_endpoint_returns_active_user_ids(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $onlineUser = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($viewer);

        app(UserPresenceService::class)->touch($onlineUser->id);

        $response = $this->withToken($token)
            ->getJson('/api/presence/online')
            ->assertOk();

        $this->assertContains($onlineUser->id, $response->json('user_ids'));
    }

    public function test_search_includes_online_status(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $target = User::factory()->create([
            'name' => 'Online Alice',
            'email' => 'online-alice@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($viewer);

        app(UserPresenceService::class)->touch($target->id);

        $this->withToken($token)
            ->getJson('/api/users/search?q=Online')
            ->assertOk()
            ->assertJsonPath('0.is_online', true);
    }

    public function test_profile_includes_offline_status_when_not_active(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $target = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($viewer);

        $this->withToken($token)
            ->getJson("/api/users/{$target->id}/profile")
            ->assertOk()
            ->assertJsonPath('user.is_online', false);
    }

    public function test_roster_returns_all_approved_users_with_online_status(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $onlineUser = User::factory()->create([
            'name' => 'Online Bob',
            'is_approved' => true,
        ]);
        User::factory()->create(['is_approved' => false]);
        $token = $this->issueToken($viewer);

        app(UserPresenceService::class)->touch($onlineUser->id);

        $this->withToken($token)
            ->getJson('/api/users/roster')
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonFragment(['name' => 'Online Bob', 'is_online' => true]);
    }
}
