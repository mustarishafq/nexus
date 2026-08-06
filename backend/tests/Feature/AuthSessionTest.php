<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_does_not_invalidate_existing_token(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $existingToken = ApiTokenAuth::issueToken($user);

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        $this->assertNotNull($user->fresh()->last_login_at);

        $this->withToken($existingToken)
            ->getJson('/api/me')
            ->assertOk();
    }

    public function test_authenticated_session_activity_refreshes_stale_last_login(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'last_login_at' => now()->subDays(20),
        ]);
        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->getJson('/api/me')
            ->assertOk();

        $this->assertTrue(
            $user->fresh()->last_login_at->greaterThan(now()->subMinute())
        );
    }

    public function test_labeled_api_token_activity_does_not_refresh_last_login(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'last_login_at' => now()->subDays(20),
        ]);
        $staleLogin = $user->last_login_at->copy();
        $token = ApiTokenAuth::issueToken($user, ['label' => 'MCP token']);

        $this->withToken($token)
            ->getJson('/api/me')
            ->assertOk();

        $this->assertTrue($user->fresh()->last_login_at->equalTo($staleLogin));
    }

    public function test_logout_only_revokes_current_token(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $firstToken = ApiTokenAuth::issueToken($user);
        $secondToken = ApiTokenAuth::issueToken($user);

        $this->withToken($firstToken)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $this->withToken($firstToken)
            ->getJson('/api/me')
            ->assertUnauthorized();

        $this->withToken($secondToken)
            ->getJson('/api/me')
            ->assertOk();
    }
}
