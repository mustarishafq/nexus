<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Broadcast;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NexusV1BroadcastTest extends TestCase
{
    use RefreshDatabase;

    private string $apiKey = 'insan-test-api-key-32chars-minimum!!';

    private function insan(bool $broadcastEnabled = true): Application
    {
        return Application::factory()->create([
            'name' => 'Nexus Insan',
            'slug' => 'nexus-insan',
            'base_url' => 'http://insan.test',
            'api_key' => $this->apiKey,
            'auth_mode' => 'jwt',
            'is_enabled' => true,
            'notification_config' => ['broadcast_enabled' => $broadcastEnabled, 'webhook_secret' => 'top-secret'],
        ]);
    }

    private function headers(): array
    {
        $now = time();

        return [
            'Authorization' => 'Bearer '.JWT::encode([
                'iss' => 'http://insan.test',
                'iat' => $now,
                'exp' => $now + 120,
                'sub' => 'system',
                'typ' => 'service',
                'aud' => 'brain-broadcasts',
            ], $this->apiKey, 'HS256'),
            'X-Nexus-Api-Key' => $this->apiKey,
            'Accept' => 'application/json',
        ];
    }

    private function letterPayload(User $employee, array $overrides = []): array
    {
        return array_merge([
            'ref' => 'letter:12',
            'nexus_user_id' => (string) $employee->id,
            'title' => 'Warning letter (HR/WL/2026/0001)',
            'message' => 'Please read, sign and return it.',
            'priority' => 'high',
            'action_url' => 'http://insan.test/my-letters?open=12',
            'action_label' => 'Open letter',
        ], $overrides);
    }

    private function activeFor(User $user): array
    {
        return $this->withToken(ApiTokenAuth::issueToken($user))
            ->getJson('/api/broadcasts?active_only=1')
            ->assertOk()
            ->json();
    }

    public function test_requires_service_auth(): void
    {
        $this->insan();

        $this->putJson('/api/nexus/v1/broadcasts', ['ref' => 'letter:1'])->assertUnauthorized();
        $this->postJson('/api/nexus/v1/broadcasts/resolve', ['ref' => 'letter:1'])->assertUnauthorized();
    }

    public function test_refused_when_application_may_not_broadcast(): void
    {
        $this->insan(broadcastEnabled: false);
        $employee = User::factory()->create(['is_approved' => true]);

        $this->withHeaders($this->headers())
            ->putJson('/api/nexus/v1/broadcasts', $this->letterPayload($employee))
            ->assertForbidden()
            ->assertJsonPath('code', 'broadcasts_disabled');

        $this->assertDatabaseCount('broadcasts', 0);
    }

    public function test_only_the_employee_sees_it_until_it_is_resolved(): void
    {
        $app = $this->insan();
        $employee = User::factory()->create(['is_approved' => true]);
        $colleague = User::factory()->create(['is_approved' => true]);

        $this->withHeaders($this->headers())
            ->putJson('/api/nexus/v1/broadcasts', $this->letterPayload($employee))
            ->assertCreated();

        $mine = $this->activeFor($employee);
        $this->assertCount(1, $mine);
        $this->assertSame('http://insan.test/my-letters?open=12', $mine[0]['action_url']);
        $this->assertSame('Open letter', $mine[0]['action_label']);
        $this->assertSame('high', $mine[0]['priority']);
        $this->assertSame(['id' => $app->id, 'name' => 'Nexus Insan', 'slug' => 'nexus-insan'], $mine[0]['application']);
        $this->assertCount(0, $this->activeFor($colleague));

        $this->withHeaders($this->headers())
            ->postJson('/api/nexus/v1/broadcasts/resolve', ['ref' => 'letter:12'])
            ->assertOk()
            ->assertJsonPath('resolved', true);

        $this->assertCount(0, $this->activeFor($employee));
        $this->assertNotNull(Broadcast::query()->first()->resolved_at);
    }

    public function test_sending_the_same_ref_again_updates_one_broadcast(): void
    {
        $this->insan();
        $employee = User::factory()->create(['is_approved' => true]);

        $this->withHeaders($this->headers())
            ->putJson('/api/nexus/v1/broadcasts', $this->letterPayload($employee))
            ->assertCreated();
        $this->withHeaders($this->headers())
            ->putJson('/api/nexus/v1/broadcasts', $this->letterPayload($employee, ['priority' => 'critical']))
            ->assertOk();

        $this->assertDatabaseCount('broadcasts', 1);
        $this->assertSame('critical', Broadcast::query()->first()->priority);
    }

    public function test_falls_back_to_email_and_rejects_unknown_people(): void
    {
        $this->insan();
        $employee = User::factory()->create(['is_approved' => true, 'email' => 'Aina@Emzi.test']);

        $this->withHeaders($this->headers())
            ->putJson('/api/nexus/v1/broadcasts', $this->letterPayload($employee, ['nexus_user_id' => null, 'email' => 'aina@emzi.test']))
            ->assertCreated();
        $this->assertCount(1, $this->activeFor($employee));

        $this->withHeaders($this->headers())
            ->putJson('/api/nexus/v1/broadcasts', $this->letterPayload($employee, ['ref' => 'letter:13', 'nexus_user_id' => '999999', 'email' => null]))
            ->assertStatus(422)
            ->assertJsonPath('code', 'user_not_found');
    }

    public function test_turning_broadcasts_off_hides_open_ones(): void
    {
        $app = $this->insan();
        $employee = User::factory()->create(['is_approved' => true]);

        $this->withHeaders($this->headers())
            ->putJson('/api/nexus/v1/broadcasts', $this->letterPayload($employee))
            ->assertCreated();

        $app->update(['notification_config' => ['broadcast_enabled' => false]]);

        $this->assertCount(0, $this->activeFor($employee));
    }
}
