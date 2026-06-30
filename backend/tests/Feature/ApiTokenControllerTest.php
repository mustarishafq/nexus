<?php

namespace Tests\Feature;

use App\Models\AuthToken;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiTokenControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_list_and_revoke_labeled_api_tokens(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $member = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $adminToken = ApiTokenAuth::issueToken($admin);

        $createResponse = $this->withToken($adminToken)
            ->postJson('/api/admin/api-tokens', [
                'label' => 'MCP Integration',
                'user_id' => $member->id,
                'expires_in_days' => 30,
            ])
            ->assertCreated()
            ->assertJsonPath('item.label', 'MCP Integration')
            ->assertJsonPath('item.user.id', $member->id);

        $plainToken = $createResponse->json('token');
        $this->assertNotEmpty($plainToken);

        $this->withToken($plainToken)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('id', $member->id);

        $this->withToken($adminToken)
            ->getJson('/api/admin/api-tokens')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.label', 'MCP Integration');

        $authTokenId = AuthToken::query()->whereNotNull('label')->value('id');

        $this->withToken($adminToken)
            ->deleteJson("/api/admin/api-tokens/{$authTokenId}")
            ->assertNoContent();

        $this->withToken($plainToken)
            ->getJson('/api/me')
            ->assertUnauthorized();
    }

    public function test_api_token_list_dedupes_oauth_connections_per_user_and_client(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $member = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::READ,
        ]);
        $adminToken = ApiTokenAuth::issueToken($admin);
        $clientId = 'client-duplicate-test';

        AuthToken::create([
            'user_id' => $member->id,
            'oauth_client_id' => $clientId,
            'token_hash' => hash('sha256', 'older-token'),
            'label' => 'MCP: Claude',
            'last_used_at' => now()->subDay(),
            'expires_at' => now()->subHour(),
        ]);
        AuthToken::create([
            'user_id' => $member->id,
            'oauth_client_id' => $clientId,
            'token_hash' => hash('sha256', 'newer-token'),
            'label' => 'MCP: Claude',
            'last_used_at' => now(),
            'expires_at' => now()->addHour(),
        ]);

        $this->withToken($adminToken)
            ->getJson('/api/admin/api-tokens')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.label', 'MCP: Claude')
            ->assertJsonPath('items.0.user.id', $member->id);
    }

    public function test_api_token_list_includes_user_role_and_effective_mcp_access(): void
    {
        $admin = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'mcp_access' => McpUserAccess::NONE,
        ]);
        $member = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::READ,
        ]);
        $adminToken = ApiTokenAuth::issueToken($admin);

        ApiTokenAuth::issueToken($admin, ['label' => 'Admin MCP token']);
        ApiTokenAuth::issueToken($member, ['label' => 'Member MCP token']);

        $response = $this->withToken($adminToken)
            ->getJson('/api/admin/api-tokens')
            ->assertOk()
            ->assertJsonCount(2, 'items');

        $items = collect($response->json('items'))->keyBy('user.id');

        $this->assertSame('admin', $items[$admin->id]['user']['role']);
        $this->assertSame(McpUserAccess::NONE, $items[$admin->id]['user']['mcp_access']);
        $this->assertSame('user', $items[$member->id]['user']['role']);
        $this->assertSame(McpUserAccess::READ, $items[$member->id]['user']['mcp_access']);
    }

    public function test_non_admin_cannot_manage_api_tokens(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->getJson('/api/admin/api-tokens')
            ->assertForbidden();

        $this->withToken($token)
            ->postJson('/api/admin/api-tokens', ['label' => 'Blocked'])
            ->assertForbidden();
    }
}
