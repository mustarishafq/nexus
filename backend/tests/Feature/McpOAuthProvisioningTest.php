<?php

namespace Tests\Feature;

use App\Models\AuthToken;
use App\Models\Notification;
use App\Models\OAuthAuthCode;
use App\Models\OAuthClient;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class McpOAuthProvisioningTest extends TestCase
{
    use RefreshDatabase;

    public function test_oauth_decide_grants_read_only_mcp_access_for_admin(): void
    {
        $admin = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'mcp_access' => McpUserAccess::NONE,
        ]);
        $client = $this->createOAuthClient();
        $token = ApiTokenAuth::issueToken($admin);

        $this->withToken($token)
            ->postJson('/api/oauth/authorize/decide', $this->decidePayload($client))
            ->assertOk();

        $this->assertSame(McpUserAccess::READ, $admin->fresh()->mcp_access);
    }

    public function test_admin_can_change_admin_mcp_access_from_api_tokens_endpoint(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $otherAdmin = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'mcp_access' => McpUserAccess::READ,
        ]);
        $adminToken = ApiTokenAuth::issueToken($admin);

        $this->withToken($adminToken)
            ->patchJson("/api/admin/api-tokens/users/{$otherAdmin->id}/mcp-access", [
                'mcp_access' => McpUserAccess::BOTH,
            ])
            ->assertOk()
            ->assertJsonPath('mcp_access', McpUserAccess::BOTH);

        $this->assertSame(McpUserAccess::BOTH, $otherAdmin->fresh()->mcp_access);
    }

    public function test_oauth_decide_grants_read_only_mcp_access(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::NONE,
        ]);
        $client = $this->createOAuthClient();
        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->postJson('/api/oauth/authorize/decide', $this->decidePayload($client))
            ->assertOk();

        $this->assertSame(McpUserAccess::READ, $user->fresh()->mcp_access);
    }

    public function test_oauth_token_exchange_creates_labeled_token_and_notifies_admins(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::NONE,
        ]);
        $client = $this->createOAuthClient(['name' => 'Claude Desktop']);
        $verifier = Str::random(64);
        $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
        $plainCode = Str::random(64);

        OAuthAuthCode::create([
            'code_hash' => hash('sha256', $plainCode),
            'client_id' => $client->client_id,
            'user_id' => $user->id,
            'redirect_uri' => $client->redirect_uris[0],
            'code_challenge' => $challenge,
            'code_challenge_method' => 'S256',
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->postJson('/api/oauth/token', [
            'grant_type' => 'authorization_code',
            'code' => $plainCode,
            'redirect_uri' => $client->redirect_uris[0],
            'client_id' => $client->client_id,
            'code_verifier' => $verifier,
        ])->assertOk();

        $authToken = AuthToken::query()->where('user_id', $user->id)->first();
        $this->assertNotNull($authToken);
        $this->assertSame('MCP: Claude Desktop', $authToken->label);
        $this->assertSame($client->client_id, $authToken->oauth_client_id);

        $notification = Notification::query()
            ->where('user_id', (string) $admin->id)
            ->where('title', 'New MCP connection')
            ->first();

        $this->assertNotNull($notification);
        $this->assertStringContainsString($user->displayName(), $notification->message);
        $this->assertStringContainsString('Claude Desktop', $notification->message);
        $this->assertSame('/admin/users?section=api-tokens', $notification->action_url);
    }

    public function test_admin_api_tokens_list_includes_oauth_mcp_tokens(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::READ,
        ]);
        $client = $this->createOAuthClient();
        $adminToken = ApiTokenAuth::issueToken($admin);

        AuthToken::create([
            'user_id' => $user->id,
            'oauth_client_id' => $client->client_id,
            'token_hash' => hash('sha256', Str::random(80)),
            'label' => 'MCP: Test Client',
            'last_used_at' => now(),
            'expires_at' => now()->addHour(),
        ]);

        $this->withToken($adminToken)
            ->getJson('/api/admin/api-tokens')
            ->assertOk()
            ->assertJsonPath('items.0.source', 'oauth')
            ->assertJsonPath('items.0.label', 'MCP: Test Client');
    }

    public function test_admin_can_change_user_mcp_access_from_api_tokens_endpoint(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::READ,
        ]);
        $adminToken = ApiTokenAuth::issueToken($admin);

        $this->withToken($adminToken)
            ->patchJson("/api/admin/api-tokens/users/{$user->id}/mcp-access", [
                'mcp_access' => McpUserAccess::BOTH,
            ])
            ->assertOk()
            ->assertJsonPath('mcp_access', McpUserAccess::BOTH);

        $this->assertSame(McpUserAccess::BOTH, $user->fresh()->mcp_access);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createOAuthClient(array $overrides = []): OAuthClient
    {
        return OAuthClient::create([
            'client_id' => (string) Str::uuid(),
            'name' => $overrides['name'] ?? 'Test MCP Client',
            'redirect_uris' => ['http://localhost/callback'],
            'token_endpoint_auth_method' => 'none',
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function decidePayload(OAuthClient $client): array
    {
        return [
            'client_id' => $client->client_id,
            'redirect_uri' => $client->redirect_uris[0],
            'state' => 'xyz',
            'scope' => 'mcp',
            'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', Str::random(64), true)), '+/', '-_'), '='),
            'code_challenge_method' => 'S256',
        ];
    }
}
