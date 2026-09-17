<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationSsoCredential;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CallApplicationApiActingUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_call_application_api_uses_user_bearer_from_sso_verify(): void
    {
        Http::fake([
            'https://management.test/api/sso/nexus/verify' => Http::response([
                'success' => true,
                'data' => ['token' => 'user-sanctum-token'],
            ], 200),
            'https://management.test/api/delay-tasks*' => Http::response([
                'success' => true,
                'data' => [['id' => 1, 'title' => 'Mine']],
            ], 200),
        ]);

        $user = User::factory()->create([
            'email' => 'alex@example.com',
            'name' => 'Alex',
            'is_approved' => true,
            'role' => 'admin',
            'mcp_access' => McpUserAccess::READ,
        ]);
        Application::factory()->create([
            'slug' => 'nxsmn',
            'base_url' => 'https://management.test',
            'mcp_enabled' => true,
            'mcp_api_key' => 'shared-mcp-secret',
            'mcp_auth_mode' => 'x-api-key',
            'api_key' => 'sso-signing-secret-at-least-32-characters',
            'visibility' => 'public',
            'is_enabled' => true,
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
                        'path' => '/api/delay-tasks',
                        'method' => 'GET',
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('result.isError', false);

        Http::assertSent(function ($request) {
            $url = $request->url();

            return str_starts_with($url, 'https://management.test/api/delay-tasks')
                && $request->hasHeader('Authorization', 'Bearer user-sanctum-token')
                && $request->hasHeader('X-Nexus-Acting-Email', 'alex@example.com')
                && $request->hasHeader('X-Nexus-Acting-Mode', 'assistant')
                && $request->hasHeader('X-API-Key', 'shared-mcp-secret');
        });
    }

    public function test_call_application_api_falls_back_to_shared_auth_with_acting_headers(): void
    {
        Http::fake([
            'https://management.test/api/sso/nexus/verify' => Http::response(['message' => 'Not Found'], 404),
            'https://management.test/api/delay-tasks*' => Http::response(['data' => []], 200),
        ]);

        $user = User::factory()->create([
            'email' => 'alex@example.com',
            'is_approved' => true,
            'role' => 'admin',
            'mcp_access' => McpUserAccess::READ,
        ]);
        Application::factory()->create([
            'slug' => 'nxsmn',
            'base_url' => 'https://management.test',
            'mcp_enabled' => true,
            'mcp_api_key' => 'shared-mcp-secret',
            'mcp_auth_mode' => 'x-api-key',
            'api_key' => 'sso-signing-secret-at-least-32-characters',
            'visibility' => 'public',
            'is_enabled' => true,
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
                        'path' => '/api/delay-tasks',
                        'method' => 'GET',
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
                        'slug' => 'nxsmn',
                        'path' => '/api/delay-tasks',
                        'method' => 'GET',
                    ],
                ],
            ])
            ->assertOk();

        $dataCalls = collect(Http::recorded())
            ->map(fn ($pair) => $pair[0])
            ->filter(fn ($request) => str_starts_with($request->url(), 'https://management.test/api/delay-tasks'));

        $this->assertCount(2, $dataCalls);
        $dataCalls->each(function ($request) {
            $this->assertTrue($request->hasHeader('X-API-Key', 'shared-mcp-secret'));
            $this->assertTrue($request->hasHeader('X-Nexus-Acting-Email', 'alex@example.com'));
            $this->assertTrue($request->hasHeader('X-Nexus-Sso-Token'));
        });
    }

    public function test_call_application_api_defaults_to_primary_nexus_email_when_additional_sso_emails_exist(): void
    {
        Http::fake([
            'https://care.test/api/sso/nexus/verify' => Http::response(['token' => 'care-user-token'], 200),
            'https://care.test/api/tickets*' => Http::response(['data' => []], 200),
        ]);

        $user = User::factory()->create([
            'email' => 'primary@example.com',
            'is_approved' => true,
            'role' => 'admin',
            'mcp_access' => McpUserAccess::READ,
        ]);
        $application = Application::factory()->create([
            'slug' => 'nxscare',
            'base_url' => 'https://care.test',
            'mcp_enabled' => true,
            'mcp_api_key' => 'shared-mcp-secret',
            'api_key' => 'sso-signing-secret-at-least-32-characters',
            'visibility' => 'public',
            'is_enabled' => true,
        ]);
        ApplicationSsoCredential::create([
            'user_id' => $user->id,
            'application_id' => $application->id,
            'email' => 'care-account@example.com',
            'label' => 'Care',
            'status' => ApplicationSsoCredential::STATUS_APPROVED,
        ]);

        $this->withToken(ApiTokenAuth::issueToken($user))
            ->postJson('/api/mcp', [
                'jsonrpc' => '2.0',
                'id' => 1,
                'method' => 'tools/call',
                'params' => [
                    'name' => 'call_application_api',
                    'arguments' => [
                        'slug' => 'nxscare',
                        'path' => '/api/tickets',
                        'method' => 'GET',
                    ],
                ],
            ])
            ->assertOk();

        Http::assertSent(function ($request) {
            return str_starts_with($request->url(), 'https://care.test/api/tickets')
                && $request->hasHeader('X-Nexus-Acting-Email', 'primary@example.com')
                && $request->hasHeader('Authorization', 'Bearer care-user-token');
        });
    }

    public function test_call_application_api_uses_management_sso_verify_path_and_keeps_only_own_tasks(): void
    {
        Http::fake(function ($request) {
            $url = $request->url();
            if (str_contains($url, '/api/auth/sso/nexus')) {
                return Http::response([
                    'token' => 'mgmt-user-jwt',
                    'user' => ['id' => 42, 'email' => 'alex@example.com'],
                ], 200);
            }
            if (str_contains($url, '/api/tasks')) {
                return Http::response([
                    'items' => [
                        ['id' => 1, 'title' => 'Mine', 'assigned_to_id' => 42],
                        ['id' => 2, 'title' => 'Someone else', 'assigned_to_id' => 99],
                    ],
                    'total' => 2,
                ], 200);
            }

            return Http::response(['message' => 'Not Found'], 404);
        });

        $user = User::factory()->create([
            'email' => 'alex@example.com',
            'is_approved' => true,
            'role' => 'admin',
            'mcp_access' => McpUserAccess::READ,
        ]);
        Application::factory()->create([
            'slug' => 'nxsmn',
            'base_url' => 'https://management.test',
            'mcp_enabled' => true,
            'mcp_api_key' => 'shared-mcp-secret',
            'mcp_auth_mode' => 'x-api-key',
            'api_key' => 'sso-signing-secret-at-least-32-characters',
            'visibility' => 'public',
            'is_enabled' => true,
        ]);

        $response = $this->withToken(ApiTokenAuth::issueToken($user))
            ->postJson('/api/mcp', [
                'jsonrpc' => '2.0',
                'id' => 1,
                'method' => 'tools/call',
                'params' => [
                    'name' => 'call_application_api',
                    'arguments' => [
                        'slug' => 'nxsmn',
                        'path' => '/api/tasks',
                        'method' => 'GET',
                        'query' => ['status' => 'Delayed'],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('result.isError', false);

        $payload = json_decode($response->json('result.content.0.text'), true);
        $this->assertSame('42', (string) $payload['acting_as']['user_id']);
        $this->assertCount(1, $payload['body']['items']);
        $this->assertSame('Mine', $payload['body']['items'][0]['title']);
        $this->assertSame(1, $payload['body']['total']);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/api/tasks')
                && $request->hasHeader('Authorization', 'Bearer mgmt-user-jwt')
                && str_contains($request->url(), 'assigned_to=42')
                && str_contains($request->url(), 'scope=mine')
                && str_contains($request->url(), 'status=Delayed');
        });
    }
}
