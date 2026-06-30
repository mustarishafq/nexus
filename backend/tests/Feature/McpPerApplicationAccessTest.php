<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use App\Models\UserApplicationMcpAccess;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class McpPerApplicationAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_set_per_application_mcp_overrides(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $member = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::READ,
        ]);
        $management = Application::factory()->create([
            'slug' => 'nxsmn',
            'name' => 'EMZI Nexus Management',
            'mcp_enabled' => true,
            'visibility' => 'public',
            'is_enabled' => true,
        ]);
        $fulfilment = Application::factory()->create([
            'slug' => 'fms',
            'name' => 'EMZI Nexus Fulfilment',
            'mcp_enabled' => true,
            'visibility' => 'public',
            'is_enabled' => true,
        ]);
        $adminToken = ApiTokenAuth::issueToken($admin);

        $this->withToken($adminToken)
            ->patchJson("/api/admin/api-tokens/users/{$member->id}/mcp-access", [
                'mcp_access' => McpUserAccess::READ,
                'application_overrides' => [
                    ['application_id' => $management->id, 'mcp_access' => McpUserAccess::BOTH],
                    ['application_id' => $fulfilment->id, 'mcp_access' => 'inherit'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('mcp_access', McpUserAccess::READ)
            ->assertJsonPath('has_application_overrides', true);

        $this->assertDatabaseHas('user_application_mcp_access', [
            'user_id' => $member->id,
            'application_id' => $management->id,
            'mcp_access' => McpUserAccess::BOTH,
        ]);
        $this->assertDatabaseMissing('user_application_mcp_access', [
            'user_id' => $member->id,
            'application_id' => $fulfilment->id,
        ]);

        $this->assertSame(McpUserAccess::BOTH, McpUserAccess::effectiveLevelForApplication($member->fresh(), $management));
        $this->assertSame(McpUserAccess::READ, McpUserAccess::effectiveLevelForApplication($member->fresh(), $fulfilment));
    }

    public function test_call_application_api_enforces_per_application_write_access(): void
    {
        Http::fake([
            'https://management.test/*' => Http::response(['ok' => true], 200),
            'https://fms.test/*' => Http::response(['ok' => true], 200),
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'mcp_access' => McpUserAccess::READ,
        ]);
        $management = Application::factory()->create([
            'slug' => 'nxsmn',
            'base_url' => 'https://management.test',
            'mcp_enabled' => true,
            'mcp_api_key' => 'secret',
            'visibility' => 'public',
            'is_enabled' => true,
        ]);
        $fulfilment = Application::factory()->create([
            'slug' => 'fms',
            'base_url' => 'https://fms.test',
            'mcp_enabled' => true,
            'mcp_api_key' => 'secret',
            'visibility' => 'public',
            'is_enabled' => true,
        ]);

        UserApplicationMcpAccess::create([
            'user_id' => $user->id,
            'application_id' => $management->id,
            'mcp_access' => McpUserAccess::BOTH,
        ]);

        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->postJson('/api/mcp', [
                'jsonrpc' => '2.0',
                'id' => 1,
                'method' => 'tools/call',
                'params' => [
                    'name' => 'call_application_api',
                    'arguments' => [
                        'slug' => 'nxsmn',
                        'path' => '/api/items',
                        'method' => 'POST',
                        'body' => ['name' => 'Test'],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('result.isError', false);

        $this->withToken($token)
            ->postJson('/api/mcp', [
                'jsonrpc' => '2.0',
                'id' => 2,
                'method' => 'tools/call',
                'params' => [
                    'name' => 'call_application_api',
                    'arguments' => [
                        'slug' => 'fms',
                        'path' => '/api/items',
                        'method' => 'POST',
                        'body' => ['name' => 'Test'],
                    ],
                ],
            ])
            ->assertForbidden()
            ->assertJsonPath('error.message', 'This user only has MCP read access for fms.');
    }

    public function test_describe_application_api_filters_catalog_per_application(): void
    {
        Http::fake([
            'https://management.test/api/mcp-catalog' => Http::response([
                'endpoints' => [
                    ['method' => 'GET', 'path' => '/api/items'],
                    ['method' => 'POST', 'path' => '/api/items'],
                ],
            ], 200),
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'mcp_access' => McpUserAccess::READ,
        ]);
        Application::factory()->create([
            'slug' => 'nxsmn',
            'base_url' => 'https://management.test',
            'mcp_enabled' => true,
            'mcp_api_key' => 'secret',
            'visibility' => 'public',
            'is_enabled' => true,
        ]);

        UserApplicationMcpAccess::create([
            'user_id' => $user->id,
            'application_id' => Application::query()->where('slug', 'nxsmn')->value('id'),
            'mcp_access' => McpUserAccess::BOTH,
        ]);

        $token = ApiTokenAuth::issueToken($user);

        $response = $this->withToken($token)
            ->postJson('/api/mcp', [
                'jsonrpc' => '2.0',
                'id' => 1,
                'method' => 'tools/call',
                'params' => [
                    'name' => 'describe_application_api',
                    'arguments' => ['slug' => 'nxsmn'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('result.isError', false);

        $payload = json_decode($response->json('result.content.0.text'), true);
        $methods = collect($payload['endpoints'])->pluck('method')->all();

        $this->assertContains('GET', $methods);
        $this->assertContains('POST', $methods);
    }
}
