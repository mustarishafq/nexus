<?php

namespace Tests\Feature;

use App\Models\OAuthAuthCode;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Behaviour strict connector clients (ChatGPT apps, Cursor, etc.) rely on
 * beyond what Claude's lenient connector flow needs.
 */
class McpConnectorCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_discovery_metadata_is_served_on_all_well_known_paths(): void
    {
        foreach ([
            '/.well-known/oauth-authorization-server',
            '/.well-known/oauth-authorization-server/mcp',
            '/.well-known/openid-configuration',
        ] as $path) {
            $this->getJson($path)
                ->assertOk()
                ->assertJsonPath('code_challenge_methods_supported', ['S256'])
                ->assertJsonStructure(['issuer', 'authorization_endpoint', 'token_endpoint', 'registration_endpoint']);
        }

        $this->getJson('/.well-known/oauth-protected-resource/mcp')
            ->assertOk()
            ->assertJsonStructure(['resource', 'authorization_servers']);
    }

    public function test_initialize_negotiates_protocol_version(): void
    {
        $token = $this->mcpUserToken();

        $this->withToken($token)
            ->postJson('/mcp', $this->rpc('initialize', ['protocolVersion' => '2025-06-18']))
            ->assertOk()
            ->assertJsonPath('result.protocolVersion', '2025-06-18');

        $this->withToken($token)
            ->postJson('/mcp', $this->rpc('initialize', ['protocolVersion' => '1999-01-01']))
            ->assertOk()
            ->assertJsonPath('result.protocolVersion', '2025-06-18');
    }

    public function test_notifications_are_accepted_without_error(): void
    {
        $this->withToken($this->mcpUserToken())
            ->postJson('/mcp', ['jsonrpc' => '2.0', 'method' => 'notifications/initialized'])
            ->assertStatus(202)
            ->assertJsonMissingPath('error');
    }

    public function test_ping_returns_empty_result(): void
    {
        $this->withToken($this->mcpUserToken())
            ->postJson('/mcp', $this->rpc('ping'))
            ->assertOk()
            ->assertJsonPath('result', []);
    }

    public function test_client_secret_basic_registration_and_token_exchange(): void
    {
        $registered = $this->postJson('/register', [
            'client_name' => 'ChatGPT',
            'redirect_uris' => ['https://chatgpt.com/connector_platform_oauth_redirect'],
            'token_endpoint_auth_method' => 'client_secret_basic',
        ])->assertCreated()->json();

        $this->assertNotEmpty($registered['client_secret']);

        $user = User::factory()->create(['is_approved' => true, 'mcp_access' => McpUserAccess::READ]);
        $verifier = Str::random(64);

        OAuthAuthCode::create([
            'code_hash' => hash('sha256', 'the-code'),
            'client_id' => $registered['client_id'],
            'user_id' => $user->id,
            'redirect_uri' => 'https://chatgpt.com/connector_platform_oauth_redirect',
            'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='),
            'code_challenge_method' => 'S256',
            'expires_at' => now()->addMinutes(5),
        ]);

        $payload = [
            'grant_type' => 'authorization_code',
            'code' => 'the-code',
            'redirect_uri' => 'https://chatgpt.com/connector_platform_oauth_redirect',
            'code_verifier' => $verifier,
        ];

        $this->withBasicAuth($registered['client_id'], 'wrong-secret')
            ->post('/token', $payload)
            ->assertStatus(401)
            ->assertJsonPath('error', 'invalid_client');

        $this->withBasicAuth($registered['client_id'], $registered['client_secret'])
            ->post('/token', $payload)
            ->assertOk()
            ->assertJsonStructure(['access_token', 'refresh_token', 'expires_in']);
    }

    public function test_token_endpoint_returns_oauth_error_for_missing_params(): void
    {
        $this->post('/token', ['grant_type' => 'authorization_code'])
            ->assertStatus(400)
            ->assertJsonPath('error', 'invalid_request');
    }

    private function mcpUserToken(): string
    {
        $user = User::factory()->create(['is_approved' => true, 'mcp_access' => McpUserAccess::READ]);

        return ApiTokenAuth::issueToken($user);
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function rpc(string $method, array $params = []): array
    {
        return ['jsonrpc' => '2.0', 'id' => 1, 'method' => $method, 'params' => $params];
    }
}
