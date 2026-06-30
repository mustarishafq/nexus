<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DescribeApplicationApiToolTest extends TestCase
{
    use RefreshDatabase;

    public function test_describe_application_api_handles_wrapped_catalog_response(): void
    {
        Http::fake([
            'https://fms.test/api/mcp-catalog' => Http::response([
                'version' => '1.0',
                'endpoints' => [
                    ['method' => 'GET', 'path' => '/api/orders', 'description' => 'List orders.'],
                    ['method' => 'POST', 'path' => '/api/orders', 'description' => 'Create order.'],
                ],
            ], 200),
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'mcp_access' => McpUserAccess::READ,
        ]);
        Application::factory()->create([
            'name' => 'EMZI Nexus Fulfilment',
            'slug' => 'fms',
            'base_url' => 'https://fms.test',
            'mcp_enabled' => true,
            'mcp_api_key' => 'secret',
            'visibility' => 'public',
            'is_enabled' => true,
        ]);
        $token = ApiTokenAuth::issueToken($user);

        $response = $this->withToken($token)
            ->postJson('/api/mcp', [
                'jsonrpc' => '2.0',
                'id' => 1,
                'method' => 'tools/call',
                'params' => [
                    'name' => 'describe_application_api',
                    'arguments' => ['slug' => 'fms'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('result.isError', false);

        $payload = json_decode($response->json('result.content.0.text'), true);

        $this->assertSame('fms', $payload['slug']);
        $this->assertCount(1, $payload['endpoints']);
        $this->assertSame('GET', $payload['endpoints'][0]['method']);
        $this->assertSame('/api/orders', $payload['endpoints'][0]['path']);
    }
}
