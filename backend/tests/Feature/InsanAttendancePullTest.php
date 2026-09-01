<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\AttendanceRecord;
use App\Models\ExpReward;
use App\Models\User;
use App\Services\InsanAttendancePullService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class InsanAttendancePullTest extends TestCase
{
    use RefreshDatabase;

    private string $apiKey = 'resource-test-api-key-32chars-min!!';

    private function createInsanApplication(): Application
    {
        return Application::factory()->create([
            'name' => 'EMZI Nexus Insan',
            'slug' => 'emzi-nexus-insan',
            'base_url' => 'http://insan.test',
            'api_key' => $this->apiKey,
            'auth_mode' => 'jwt',
            'is_enabled' => true,
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $records
     */
    private function fakeInsanExport(array $records): void
    {
        Http::fake(function ($request) use ($records) {
            if (str_contains($request->url(), '.well-known/nexus-integration.json')) {
                return Http::response([
                    'capabilities' => ['attendance.export', 'attendance.ingest'],
                    'endpoints' => [
                        'attendance_export' => '/api/nexus/v1/attendance',
                    ],
                ], 200);
            }

            if ($request->method() === 'GET' && str_contains($request->url(), '/api/nexus/v1/attendance')) {
                return Http::response([
                    'records' => $records,
                    'pagination' => [
                        'has_more' => false,
                        'after_id' => (int) ($records[count($records) - 1]['id'] ?? 0),
                    ],
                ], 200);
            }

            return Http::response('unexpected '.$request->url(), 500);
        });
    }

    public function test_pull_imports_insan_punch_without_offering_exp(): void
    {
        $this->createInsanApplication();
        $user = User::factory()->create([
            'email' => 'ain.azman@example.com',
            'is_approved' => true,
        ]);

        $capturedAt = Carbon::parse('2026-08-26 07:29:26', 'Asia/Kuala_Lumpur');
        $this->fakeInsanExport([[
            'id' => 9001,
            'source' => 'insan',
            'external_id' => '9001',
            'nexus_user_id' => (string) $user->id,
            'email' => $user->email,
            'type' => 'clock_in',
            'captured_at' => $capturedAt->toIso8601String(),
            'photo_url' => 'https://example.com/in.jpg',
            'location_label' => 'EMZI HQ (SP Plaza)',
            'timezone' => 'Asia/Kuala_Lumpur',
            'metadata' => [],
        ]]);

        $stats = app(InsanAttendancePullService::class)->pull(null, null, false, false);

        $this->assertSame(1, $stats['imported']);
        $this->assertDatabaseHas('attendance_records', [
            'user_id' => $user->id,
            'type' => 'clock_in',
            'source' => 'insan',
            'external_id' => '9001',
        ]);
        $this->assertSame(0, ExpReward::query()->count());
    }

    public function test_pull_skips_existing_brain_origin_record(): void
    {
        $this->createInsanApplication();
        $user = User::factory()->create([
            'email' => 'ain.azman@example.com',
            'is_approved' => true,
        ]);
        $existing = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/in.jpg',
            'captured_at' => Carbon::parse('2026-08-26 07:29:26', 'Asia/Kuala_Lumpur'),
        ]);

        $this->fakeInsanExport([[
            'id' => 42,
            'source' => 'brain',
            'external_id' => (string) $existing->id,
            'nexus_user_id' => (string) $user->id,
            'email' => $user->email,
            'type' => 'clock_in',
            'captured_at' => $existing->captured_at->toIso8601String(),
            'timezone' => 'Asia/Kuala_Lumpur',
        ]]);

        $stats = app(InsanAttendancePullService::class)->pull();

        $this->assertSame(0, $stats['imported']);
        $this->assertSame(1, $stats['skipped_existing']);
        $this->assertSame(1, AttendanceRecord::query()->count());
    }

    public function test_pull_is_idempotent_on_insan_external_id(): void
    {
        $this->createInsanApplication();
        $user = User::factory()->create([
            'email' => 'ain.azman@example.com',
            'is_approved' => true,
        ]);
        $capturedAt = Carbon::parse('2026-08-26 17:31:00', 'Asia/Kuala_Lumpur');
        $row = [
            'id' => 9002,
            'source' => 'insan',
            'external_id' => '9002',
            'email' => $user->email,
            'type' => 'clock_out',
            'captured_at' => $capturedAt->toIso8601String(),
            'timezone' => 'Asia/Kuala_Lumpur',
        ];
        $this->fakeInsanExport([$row]);

        app(InsanAttendancePullService::class)->pull();
        $stats = app(InsanAttendancePullService::class)->pull();

        $this->assertSame(1, $stats['skipped_existing']);
        $this->assertSame(1, AttendanceRecord::query()->where('external_id', '9002')->count());
    }

    public function test_artisan_dry_run_does_not_write(): void
    {
        $this->createInsanApplication();
        User::factory()->create(['email' => 'ain.azman@example.com', 'is_approved' => true]);
        $this->fakeInsanExport([[
            'id' => 11,
            'source' => 'insan',
            'external_id' => '11',
            'email' => 'ain.azman@example.com',
            'type' => 'clock_in',
            'captured_at' => '2026-08-26T07:29:26+08:00',
            'timezone' => 'Asia/Kuala_Lumpur',
        ]]);

        $this->artisan('attendance:pull-from-insan', ['--dry-run' => true])
            ->assertSuccessful();

        $this->assertSame(0, AttendanceRecord::query()->count());
    }

    public function test_offer_exp_on_grants_only_that_calendar_day(): void
    {
        $this->createInsanApplication();
        $user = User::factory()->create([
            'email' => 'ain.azman@example.com',
            'is_approved' => true,
        ]);

        $this->fakeInsanExport([
            [
                'id' => 100,
                'source' => 'insan',
                'external_id' => '100',
                'email' => $user->email,
                'type' => 'clock_in',
                'captured_at' => Carbon::parse('2026-08-26 07:29:26', 'Asia/Kuala_Lumpur')->toIso8601String(),
                'photo_url' => 'https://example.com/old.jpg',
                'timezone' => 'Asia/Kuala_Lumpur',
            ],
            [
                'id' => 101,
                'source' => 'insan',
                'external_id' => '101',
                'email' => $user->email,
                'type' => 'clock_in',
                'captured_at' => Carbon::parse('2026-09-01 08:14:20', 'Asia/Kuala_Lumpur')->toIso8601String(),
                'photo_url' => 'https://example.com/today.jpg',
                'timezone' => 'Asia/Kuala_Lumpur',
            ],
        ]);

        $this->artisan('attendance:pull-from-insan', ['--offer-exp-on' => '2026-09-01'])
            ->assertSuccessful();

        $this->assertSame(2, AttendanceRecord::query()->count());
        $today = AttendanceRecord::query()->where('external_id', '101')->first();
        $old = AttendanceRecord::query()->where('external_id', '100')->first();
        $this->assertNotNull($today);
        $this->assertNotNull($old);

        $this->assertDatabaseHas('exp_rewards', [
            'user_id' => $user->id,
            'action_key' => 'clock_in',
            'source_id' => (string) $today->id,
        ]);
        $this->assertDatabaseMissing('exp_rewards', [
            'user_id' => $user->id,
            'source_id' => (string) $old->id,
        ]);
    }
}
