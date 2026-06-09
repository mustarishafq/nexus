<?php

namespace Tests\Feature;

use App\Models\NetworkHealthAlert;
use App\Models\NetworkHealthLog;
use App\Models\User;
use App\Services\NetworkHealthAlertService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NetworkHealthControllerTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('a', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_ping_requires_authentication(): void
    {
        $this->getJson('/api/network-health/ping')
            ->assertUnauthorized();
    }

    public function test_ping_returns_timestamp_for_authenticated_user(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->getJson('/api/network-health/ping')
            ->assertOk()
            ->assertJsonStructure(['timestamp', 'server_time_ms']);
    }

    public function test_store_log_creates_record_and_alerts(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->postJson('/api/network-health/logs', [
                'latency_ms' => 450,
                'download_mbps' => 3.5,
                'upload_mbps' => 0.5,
                'browser' => 'Chrome',
                'browser_version' => '120.0',
                'operating_system' => 'macOS',
                'device_type' => 'desktop',
                'screen_resolution' => '1920x1080',
                'timezone' => 'America/New_York',
                'ip_address' => '127.0.0.1',
                'tested_at' => now()->toISOString(),
            ])
            ->assertCreated()
            ->assertJsonPath('alerts_created', 3);

        $this->assertDatabaseCount('network_health_logs', 1);
        $this->assertDatabaseCount('network_health_alerts', 3);

        $log = NetworkHealthLog::query()->first();
        $this->assertSame(450, $log->latency_ms);
        $this->assertSame('Chrome', $log->browser);
    }

    public function test_store_log_prevents_duplicate_within_hour(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 100,
            'tested_at' => now()->subMinutes(30),
        ]);

        $this->withToken($token)
            ->postJson('/api/network-health/logs', [
                'latency_ms' => 200,
                'tested_at' => now()->toISOString(),
            ])
            ->assertStatus(409);

        $this->assertDatabaseCount('network_health_logs', 1);
    }

    public function test_dashboard_returns_own_data_for_regular_user(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $otherUser = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 80,
            'download_mbps' => 40,
            'upload_mbps' => 8,
            'tested_at' => now(),
        ]);

        NetworkHealthLog::query()->create([
            'user_id' => $otherUser->id,
            'latency_ms' => 500,
            'download_mbps' => 1,
            'upload_mbps' => 0.2,
            'tested_at' => now(),
        ]);

        $this->withToken($token)
            ->getJson('/api/network-health/dashboard')
            ->assertOk()
            ->assertJsonPath('scope', 'self')
            ->assertJsonPath('summary.avg_latency_ms', 80)
            ->assertJsonCount(1, 'latest_results')
            ->assertJsonCount(0, 'slowest_users');
    }

    public function test_user_cannot_view_other_user_history(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $otherUser = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->getJson("/api/network-health/users/{$otherUser->id}/history")
            ->assertForbidden();
    }

    public function test_user_can_view_own_history(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($user);

        NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 120,
            'tested_at' => now(),
        ]);

        $this->withToken($token)
            ->getJson("/api/network-health/users/{$user->id}/history")
            ->assertOk()
            ->assertJsonCount(1, 'history');
    }

    public function test_dashboard_returns_summary_for_admin(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($admin);

        NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 120,
            'download_mbps' => 50.5,
            'upload_mbps' => 10.2,
            'browser' => 'Chrome',
            'operating_system' => 'Windows',
            'tested_at' => now(),
        ]);

        $this->withToken($token)
            ->getJson('/api/network-health/dashboard')
            ->assertOk()
            ->assertJsonPath('scope', 'admin')
            ->assertJsonStructure([
                'summary' => ['avg_latency_ms', 'avg_download_mbps', 'avg_upload_mbps', 'users_tested_today'],
                'hourly_trends',
                'latest_results',
                'slowest_users',
                'lowest_download_users',
                'active_alerts',
                'averages' => ['daily', 'weekly', 'monthly'],
            ]);
    }

    public function test_dashboard_hourly_trends_use_utc_iso_timestamps(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($admin);
        $testedAt = now()->startOfHour();

        NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 120,
            'tested_at' => $testedAt,
        ]);

        $response = $this->withToken($token)
            ->getJson('/api/network-health/dashboard')
            ->assertOk();

        $hourBucket = $response->json('hourly_trends.0.hour_bucket');

        $this->assertNotNull($hourBucket);
        $this->assertMatchesRegularExpression('/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $hourBucket);
        $this->assertSame(
            $testedAt->copy()->startOfHour()->toIso8601String(),
            $hourBucket
        );
    }

    public function test_alert_service_thresholds(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $service = new NetworkHealthAlertService;

        $log = NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => NetworkHealthAlertService::LATENCY_THRESHOLD_MS + 1,
            'download_mbps' => NetworkHealthAlertService::DOWNLOAD_THRESHOLD_MBPS - 0.1,
            'upload_mbps' => NetworkHealthAlertService::UPLOAD_THRESHOLD_MBPS - 0.1,
            'tested_at' => now(),
        ]);

        $alerts = $service->evaluateAndCreate($log);

        $this->assertCount(3, $alerts);
        $this->assertDatabaseHas('network_health_alerts', [
            'alert_type' => 'latency',
            'status' => 'active',
        ]);
    }

    public function test_acknowledge_alert(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($admin);

        $log = NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 500,
            'tested_at' => now(),
        ]);

        $alert = NetworkHealthAlert::query()->create([
            'network_health_log_id' => $log->id,
            'user_id' => $user->id,
            'alert_type' => 'latency',
            'metric_value' => 500,
            'threshold_value' => 300,
            'status' => 'active',
        ]);

        $this->withToken($token)
            ->patchJson("/api/network-health/alerts/{$alert->id}/acknowledge")
            ->assertOk()
            ->assertJsonPath('status', 'acknowledged');

        $this->assertDatabaseHas('network_health_alerts', [
            'id' => $alert->id,
            'status' => 'acknowledged',
            'acknowledged_by' => $admin->id,
        ]);
    }
}
