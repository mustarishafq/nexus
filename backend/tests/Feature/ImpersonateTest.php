<?php

namespace Tests\Feature;

use App\Models\AuthToken;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ImpersonateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_start_preview_as_approved_user(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $target = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $adminToken = ApiTokenAuth::issueToken($admin);

        $response = $this->withToken($adminToken)
            ->postJson('/api/admin/impersonate/'.$target->id)
            ->assertOk()
            ->assertJsonPath('user.id', $target->id);

        $previewToken = $response->json('token');
        $this->assertNotEmpty($previewToken);

        $this->withToken($previewToken)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('id', $target->id);

        $this->assertNull($target->fresh()->last_login_at);

        $authToken = AuthToken::query()
            ->where('token_hash', hash('sha256', $previewToken))
            ->first();

        $this->assertNotNull($authToken);
        $this->assertSame('impersonation:'.$admin->id, $authToken->label);
        $this->assertNotNull($authToken->expires_at);
    }

    public function test_non_admin_cannot_start_preview(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $target = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->postJson('/api/admin/impersonate/'.$target->id)
            ->assertForbidden();
    }

    public function test_admin_cannot_preview_as_self(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $token = ApiTokenAuth::issueToken($admin);

        $this->withToken($token)
            ->postJson('/api/admin/impersonate/'.$admin->id)
            ->assertStatus(422);
    }

    public function test_admin_cannot_preview_as_unapproved_user(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $target = User::factory()->create(['is_approved' => false, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($admin);

        $this->withToken($token)
            ->postJson('/api/admin/impersonate/'.$target->id)
            ->assertStatus(422);
    }

    public function test_stop_revokes_preview_token(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $target = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $adminToken = ApiTokenAuth::issueToken($admin);

        $previewToken = $this->withToken($adminToken)
            ->postJson('/api/admin/impersonate/'.$target->id)
            ->assertOk()
            ->json('token');

        $this->withToken($previewToken)
            ->postJson('/api/admin/impersonate/stop')
            ->assertOk();

        $this->withToken($previewToken)
            ->getJson('/api/me')
            ->assertUnauthorized();

        $this->assertDatabaseMissing('auth_tokens', [
            'token_hash' => hash('sha256', $previewToken),
        ]);
    }

    public function test_stop_rejects_non_preview_token(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $token = ApiTokenAuth::issueToken($admin);

        $this->withToken($token)
            ->postJson('/api/admin/impersonate/stop')
            ->assertStatus(422);
    }
}
