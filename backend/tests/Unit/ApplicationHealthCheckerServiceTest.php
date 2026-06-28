<?php

namespace Tests\Unit;

use App\Models\Application;
use App\Models\SystemEvent;
use App\Services\ApplicationHealthCheckerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ApplicationHealthCheckerServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_json_ok_mode_passes_when_response_ok_true(): void
    {
        Http::fake([
            'https://booking.test/api/health' => Http::response(['ok' => true], 200),
        ]);

        $application = Application::factory()->create([
            'base_url' => 'https://booking.test',
            'health_check_mode' => 'json_ok',
        ]);

        $service = app(ApplicationHealthCheckerService::class);
        $result = $service->check($application);

        $this->assertTrue($result['ok']);
        $this->assertFalse($result['skipped']);
        $this->assertSame('online', $application->fresh()->status);
        $this->assertNotNull($application->fresh()->last_heartbeat);
    }

    public function test_json_ok_mode_fails_when_ok_is_false(): void
    {
        Http::fake([
            'https://booking.test/api/health' => Http::response(['ok' => false], 200),
        ]);

        $application = Application::factory()->create([
            'base_url' => 'https://booking.test',
            'status' => 'online',
        ]);

        $service = app(ApplicationHealthCheckerService::class);
        $result = $service->check($application);

        $this->assertFalse($result['ok']);
        $this->assertSame('offline', $application->fresh()->status);
        $this->assertDatabaseHas('system_events', [
            'system_id' => $application->slug,
            'event_type' => 'health_check',
        ]);
    }

    public function test_http_status_mode_accepts_any_successful_response(): void
    {
        Http::fake([
            'https://legacy.test/' => Http::response('OK', 200),
        ]);

        $application = Application::factory()->create([
            'base_url' => 'https://legacy.test',
            'health_check_path' => '/',
            'health_check_mode' => 'http_status',
        ]);

        $service = app(ApplicationHealthCheckerService::class);
        $result = $service->check($application);

        $this->assertTrue($result['ok']);
    }

    public function test_disabled_health_check_is_skipped(): void
    {
        Http::fake();

        $application = Application::factory()->create([
            'base_url' => 'https://booking.test',
            'health_check_enabled' => false,
            'status' => 'online',
        ]);

        $service = app(ApplicationHealthCheckerService::class);
        $result = $service->check($application);

        $this->assertTrue($result['skipped']);
        Http::assertNothingSent();
        $this->assertDatabaseCount('system_events', 0);
    }

    public function test_maintenance_mode_is_skipped(): void
    {
        Http::fake();

        $application = Application::factory()->create([
            'base_url' => 'https://booking.test',
            'status' => 'maintenance',
        ]);

        $service = app(ApplicationHealthCheckerService::class);
        $result = $service->check($application);

        $this->assertTrue($result['skipped']);
        $this->assertSame('maintenance', $application->fresh()->status);
    }

    public function test_recovery_creates_system_event(): void
    {
        Http::fake([
            'https://booking.test/api/health' => Http::response(['ok' => true], 200),
        ]);

        $application = Application::factory()->create([
            'base_url' => 'https://booking.test',
            'status' => 'offline',
        ]);

        $service = app(ApplicationHealthCheckerService::class);
        $service->check($application);

        $this->assertSame('online', $application->fresh()->status);
        $this->assertSame(1, SystemEvent::query()->count());
        $this->assertDatabaseHas('system_events', [
            'system_id' => $application->slug,
            'title' => "{$application->name} recovered",
        ]);
    }

    public function test_self_referential_application_is_skipped(): void
    {
        Http::fake();

        config(['app.url' => 'http://nexus.test']);

        $application = Application::factory()->create([
            'base_url' => 'http://nexus.test',
            'is_enabled' => true,
        ]);

        $service = app(ApplicationHealthCheckerService::class);
        $result = $service->check($application);

        $this->assertTrue($result['skipped']);
        Http::assertNothingSent();
        $this->assertNull($application->fresh()->last_heartbeat);
    }
}
