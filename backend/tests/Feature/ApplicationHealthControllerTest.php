<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ApplicationHealthControllerTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('h', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_platform_health_endpoint_is_public(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJson(['ok' => true]);
    }

    public function test_health_test_requires_authentication(): void
    {
        $application = Application::factory()->create();

        $this->postJson("/api/applications/{$application->id}/health-check/test")
            ->assertUnauthorized();
    }

    public function test_health_test_probes_with_draft_overrides(): void
    {
        Http::fake([
            'https://booking.test/up' => Http::response('OK', 200),
        ]);

        $user = User::factory()->create(['role' => 'admin']);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'base_url' => 'https://old.test',
        ]);

        $this->postJson("/api/applications/{$application->id}/health-check/test", [
            'base_url' => 'https://booking.test',
            'health_check_path' => '/up',
            'health_check_mode' => 'http_status',
        ], [
            'Authorization' => "Bearer {$token}",
        ])
            ->assertOk()
            ->assertJson([
                'ok' => true,
                'health_url' => 'https://booking.test/up',
                'health_mode' => 'http_status',
            ]);
    }

    public function test_admin_can_run_all_health_checks(): void
    {
        Http::fake([
            'https://booking.test/api/health' => Http::response(['ok' => true], 200),
        ]);

        $user = User::factory()->create(['role' => 'admin']);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'base_url' => 'https://booking.test',
            'is_enabled' => true,
        ]);

        $this->postJson('/api/applications/health-check/run', [], [
            'Authorization' => "Bearer {$token}",
        ])
            ->assertAccepted()
            ->assertJson([
                'status' => 'running',
            ]);

        $this->assertNotNull($application->fresh()->last_heartbeat);
    }
}
