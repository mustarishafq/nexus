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

        $this->withToken($existingToken)
            ->getJson('/api/me')
            ->assertOk();
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
