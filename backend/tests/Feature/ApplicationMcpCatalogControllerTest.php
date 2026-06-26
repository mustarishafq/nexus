<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ApplicationMcpCatalogControllerTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('m', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_catalog_test_requires_authentication(): void
    {
        $application = Application::factory()->create();

        $this->postJson("/api/applications/{$application->id}/mcp-catalog/test")
            ->assertUnauthorized();
    }

    public function test_catalog_test_returns_error_when_base_url_missing(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'base_url' => null,
            'mcp_api_key' => 'secret-key',
        ]);

        $this->postJson("/api/applications/{$application->id}/mcp-catalog/test", [], [
            'Authorization' => "Bearer {$token}",
        ])
            ->assertOk()
            ->assertJson([
                'ok' => false,
                'message' => 'Base URL is required before Nexus can reach the MCP catalog.',
            ]);
    }

    public function test_catalog_test_fetches_live_catalog_with_draft_overrides(): void
    {
        Http::fake([
            'https://booking.test/api/mcp-catalog' => Http::response([
                [
                    'method' => 'GET',
                    'path' => '/api/leads/{id}',
                    'description' => 'Fetch a lead.',
                ],
            ], 200),
        ]);

        $user = User::factory()->create(['role' => 'admin']);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'base_url' => 'https://old.test',
            'mcp_api_key' => 'draft-secret',
        ]);

        $this->postJson("/api/applications/{$application->id}/mcp-catalog/test", [
            'base_url' => 'https://booking.test',
            'mcp_api_key' => 'draft-secret',
        ], [
            'Authorization' => "Bearer {$token}",
        ])
            ->assertOk()
            ->assertJson([
                'ok' => true,
                'catalog_url' => 'https://booking.test/api/mcp-catalog',
                'auth_source' => 'mcp_api_key',
                'endpoint_count' => 1,
            ]);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://booking.test/api/mcp-catalog'
                && $request->hasHeader('Authorization', 'Bearer draft-secret');
        });
    }

    public function test_catalog_test_sends_x_api_key_header_when_configured(): void
    {
        Http::fake([
            'https://management.test/api/mcp-catalog' => Http::response([
                [
                    'method' => 'GET',
                    'path' => '/api/nexus/schema',
                    'description' => 'Read API schema.',
                ],
            ], 200),
        ]);

        $user = User::factory()->create(['role' => 'admin']);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'base_url' => 'https://management.test',
            'mcp_api_key' => 'nxs_write_secret',
            'mcp_auth_mode' => 'x-api-key',
        ]);

        $this->postJson("/api/applications/{$application->id}/mcp-catalog/test", [], [
            'Authorization' => "Bearer {$token}",
        ])
            ->assertOk()
            ->assertJson([
                'ok' => true,
                'auth_source' => 'mcp_api_key',
            ]);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://management.test/api/mcp-catalog'
                && $request->hasHeader('X-API-Key', 'nxs_write_secret')
                && ! $request->hasHeader('Authorization');
        });
    }
}
