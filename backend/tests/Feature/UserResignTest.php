<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class UserResignTest extends TestCase
{
    use RefreshDatabase;

    private string $apiKey = 'resource-test-api-key-32chars-min!!';

    private function issueToken(User $user): string
    {
        $token = str_repeat('r', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    private function authHeaders(string $audience): array
    {
        $now = time();
        $jwt = JWT::encode([
            'iss' => 'http://resource.test',
            'iat' => $now,
            'exp' => $now + 120,
            'sub' => 'system',
            'typ' => 'service',
            'aud' => $audience,
        ], $this->apiKey, 'HS256');

        return [
            'Authorization' => 'Bearer '.$jwt,
            'X-Nexus-Api-Key' => $this->apiKey,
            'Accept' => 'application/json',
        ];
    }

    public function test_admin_can_resign_user(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'email' => 'ada@example.com',
        ]);
        $token = $this->issueToken($admin);

        $response = $this->withToken($token)
            ->postJson("/api/users/{$user->id}/resign", [
                'resigned_at' => '2026-09-01',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'User marked as resigned.');

        $this->assertStringStartsWith('2026-09-01', (string) $response->json('user.resigned_at'));

        $user->refresh();
        $this->assertSame('2026-09-01', $user->resigned_at?->toDateString());
        $this->assertFalse((bool) $user->is_approved);
        $this->assertNull($user->deleted_at);
    }

    public function test_hr_can_resign_standard_user(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'email' => 'staff@example.com',
        ]);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->postJson("/api/users/{$user->id}/resign", [
                'resigned_at' => '2026-09-04',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'User marked as resigned.');

        $user->refresh();
        $this->assertSame('2026-09-04', $user->resigned_at?->toDateString());
        $this->assertFalse((bool) $user->is_approved);
    }

    public function test_hr_cannot_resign_admin(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->postJson("/api/users/{$admin->id}/resign")
            ->assertForbidden();
    }

    public function test_resign_pushes_resigned_flag_to_resource(): void
    {
        Application::factory()->create([
            'name' => 'EMZI Nexus Insan',
            'slug' => 'emzi-nexus-insan',
            'base_url' => 'http://resource.test',
            'api_key' => $this->apiKey,
            'auth_mode' => 'jwt',
            'is_enabled' => true,
        ]);
        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['employees.sync'],
                'endpoints' => [
                    'employees_sync' => '/api/nexus/v1/employees',
                ],
            ]),
            'http://resource.test/api/nexus/v1/employees' => Http::response([
                'message' => 'Employee sync applied',
                'stats' => ['synced' => 1, 'updated' => 1],
            ]),
        ]);

        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'email' => 'ada@example.com',
            'full_name' => 'Ada Lovelace',
        ]);
        $token = $this->issueToken($admin);

        $this->withToken($token)
            ->postJson("/api/users/{$user->id}/resign", [
                'resigned_at' => '2026-09-05',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'User resigned in Brain and Resource')
            ->assertJsonPath('insan.resigned', true);

        Http::assertSent(function ($request) use ($user) {
            if ($request->url() !== 'http://resource.test/api/nexus/v1/employees') {
                return false;
            }
            if ($request->method() !== 'PUT') {
                return false;
            }

            $row = $request['employees'][0] ?? null;

            return is_array($row)
                && ($row['email'] ?? null) === $user->email
                && ($row['nexus_user_id'] ?? null) === (string) $user->id
                && ($row['resigned'] ?? false) === true
                && ($row['resigned_at'] ?? null) === '2026-09-05'
                && ($row['deleted'] ?? true) === false;
        });
    }

    public function test_cannot_resign_own_account(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $token = $this->issueToken($admin);

        $this->withToken($token)
            ->postJson("/api/users/{$admin->id}/resign")
            ->assertStatus(422)
            ->assertJsonPath('message', 'You cannot resign your own account.');
    }

    public function test_resigned_user_cannot_login(): void
    {
        $user = User::factory()->create([
            'is_approved' => false,
            'resigned_at' => now()->toDateString(),
            'email' => 'resigned@example.com',
            'password' => 'password',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])
            ->assertStatus(403)
            ->assertJsonPath('code', 'account_resigned');
    }

    public function test_resigned_user_session_is_rejected(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($user);
        $user->forceFill([
            'resigned_at' => now()->toDateString(),
            'is_approved' => false,
        ])->save();

        $this->withToken($token)
            ->getJson('/api/me')
            ->assertStatus(403)
            ->assertJsonPath('code', 'account_resigned');
    }

    public function test_inbound_employee_sync_applies_resigned_flag(): void
    {
        Application::factory()->create([
            'name' => 'EMZI Nexus Resource',
            'slug' => 'emzi-nexus-resource',
            'base_url' => 'http://resource.test',
            'api_key' => $this->apiKey,
            'auth_mode' => 'jwt',
            'is_enabled' => true,
        ]);

        $user = User::factory()->create([
            'email' => 'ada@example.com',
            'is_approved' => true,
            'role' => 'user',
        ]);

        $this->putJson('/api/nexus/v1/employees', [
            'employees' => [
                [
                    'nexus_user_id' => (string) $user->id,
                    'email' => 'ada@example.com',
                    'name' => 'Ada',
                    'full_name' => 'Ada Lovelace',
                    'role' => 'user',
                    'is_approved' => false,
                    'resigned' => true,
                    'resigned_at' => '2026-09-02',
                    'deleted' => false,
                ],
            ],
        ], $this->authHeaders('brain-employees'))
            ->assertOk()
            ->assertJsonPath('stats.updated', 1);

        $user->refresh();
        $this->assertSame('2026-09-02', $user->resigned_at?->toDateString());
        $this->assertFalse((bool) $user->is_approved);
        $this->assertNull($user->deleted_at);
    }

    public function test_employee_export_includes_resigned_flags(): void
    {
        Application::factory()->create([
            'name' => 'EMZI Nexus Resource',
            'slug' => 'emzi-nexus-resource',
            'base_url' => 'http://resource.test',
            'api_key' => $this->apiKey,
            'auth_mode' => 'jwt',
            'is_enabled' => true,
        ]);

        $user = User::factory()->create([
            'email' => 'ada@example.com',
            'is_approved' => false,
            'resigned_at' => '2026-09-03',
            'role' => 'user',
        ]);

        $response = $this->getJson('/api/nexus/v1/employees', $this->authHeaders('brain-employees'))
            ->assertOk();

        $row = collect($response->json('employees'))->firstWhere('email', 'ada@example.com');
        $this->assertNotNull($row);
        $this->assertTrue($row['resigned']);
        $this->assertSame('2026-09-03', $row['resigned_at']);
        $this->assertFalse($row['deleted']);
        $this->assertFalse($row['inactive']);
        $this->assertSame((string) $user->id, $row['nexus_user_id']);
    }
}
