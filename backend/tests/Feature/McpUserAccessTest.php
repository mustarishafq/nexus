<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class McpUserAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_without_mcp_access_is_denied(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::NONE,
        ]);
        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->postJson('/api/mcp', [
                'jsonrpc' => '2.0',
                'id' => 1,
                'method' => 'initialize',
            ])
            ->assertForbidden()
            ->assertJsonPath('error.message', 'MCP access is disabled for this user.');
    }

    public function test_read_only_user_can_list_tools_but_not_mutating_api_calls(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::READ,
        ]);
        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->postJson('/api/mcp', [
                'jsonrpc' => '2.0',
                'id' => 1,
                'method' => 'tools/list',
            ])
            ->assertOk()
            ->assertJsonFragment(['name' => 'list_applications'])
            ->assertJsonFragment(['name' => 'call_application_api']);

        $this->withToken($token)
            ->postJson('/api/mcp', [
                'jsonrpc' => '2.0',
                'id' => 2,
                'method' => 'tools/call',
                'params' => [
                    'name' => 'call_application_api',
                    'arguments' => [
                        'slug' => 'missing',
                        'path' => '/api/items',
                        'method' => 'POST',
                    ],
                ],
            ])
            ->assertForbidden()
            ->assertJsonPath('error.message', 'This user only has MCP read access.');
    }

    public function test_write_only_user_can_mutate_but_not_read_tools(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::WRITE,
        ]);
        $token = ApiTokenAuth::issueToken($user);

        $response = $this->withToken($token)
            ->postJson('/api/mcp', [
                'jsonrpc' => '2.0',
                'id' => 1,
                'method' => 'tools/list',
            ])
            ->assertOk();

        $toolNames = collect($response->json('result.tools'))->pluck('name')->all();
        $this->assertNotContains('list_applications', $toolNames);
        $this->assertNotContains('describe_application_api', $toolNames);
        $this->assertContains('call_application_api', $toolNames);

        $this->withToken($token)
            ->postJson('/api/mcp', [
                'jsonrpc' => '2.0',
                'id' => 2,
                'method' => 'tools/call',
                'params' => [
                    'name' => 'call_application_api',
                    'arguments' => [
                        'slug' => 'missing',
                        'path' => '/api/items',
                        'method' => 'GET',
                    ],
                ],
            ])
            ->assertForbidden()
            ->assertJsonPath('error.message', 'This user only has MCP write access.');
    }

    public function test_admin_can_update_user_mcp_access(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $member = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::NONE,
        ]);
        $adminToken = ApiTokenAuth::issueToken($admin);

        $this->withToken($adminToken)
            ->patchJson("/api/users/{$member->id}", ['mcp_access' => McpUserAccess::READ])
            ->assertOk()
            ->assertJsonPath('mcp_access', McpUserAccess::READ);
    }
}
