<?php

namespace Tests\Unit;

use App\Models\NetworkHealthLog;
use App\Models\User;
use App\Services\NetworkHealthAlertService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NetworkHealthAlertServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_no_alerts_when_metrics_are_healthy(): void
    {
        $user = User::factory()->create();
        $service = new NetworkHealthAlertService;

        $log = NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 100,
            'download_mbps' => 50,
            'upload_mbps' => 10,
            'tested_at' => now(),
        ]);

        $alerts = $service->evaluateAndCreate($log);

        $this->assertCount(0, $alerts);
    }

    public function test_creates_latency_alert_only_when_threshold_exceeded(): void
    {
        $user = User::factory()->create();
        $service = new NetworkHealthAlertService;

        $log = NetworkHealthLog::query()->create([
            'user_id' => $user->id,
            'latency_ms' => 301,
            'download_mbps' => 50,
            'upload_mbps' => 10,
            'tested_at' => now(),
        ]);

        $alerts = $service->evaluateAndCreate($log);

        $this->assertCount(1, $alerts);
        $this->assertSame('latency', $alerts[0]->alert_type);
    }
}
