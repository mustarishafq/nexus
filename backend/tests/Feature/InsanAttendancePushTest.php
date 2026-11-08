<?php

namespace Tests\Feature;

use App\Jobs\ForwardAttendanceRecordToResourceJob;
use App\Models\Application;
use App\Models\AttendanceRecord;
use App\Models\SystemEvent;
use App\Models\User;
use App\Services\ResourceAttendanceForwarder;
use App\Support\ApiTokenAuth;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class InsanAttendancePushTest extends TestCase
{
    use RefreshDatabase;

    private string $apiKey = 'resource-test-api-key-32chars-min!!';

    private function createInsanApplication(): Application
    {
        return Application::factory()->create([
            'name' => 'EMZI Nexus Insan',
            'slug' => 'emzi-nexus-insan',
            'base_url' => 'http://resource.test',
            'api_key' => $this->apiKey,
            'auth_mode' => 'jwt',
            'is_enabled' => true,
        ]);
    }

    public function test_forwarder_sends_user_early_clock_out_reason_to_insan(): void
    {
        $this->createInsanApplication();
        $user = User::factory()->create(['email' => 'early-out@example.com']);
        $record = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_out',
            'photo_url' => 'https://example.com/out.jpg',
            'captured_at' => Carbon::parse('2026-10-30 09:57:00', 'Asia/Kuala_Lumpur'),
            'timezone' => 'Asia/Kuala_Lumpur',
            'metadata' => [
                'policy' => [
                    'is_early_leave' => true,
                    'early_leave_minutes' => 483,
                    'early_clock_out_reason' => 'Forgot to clock out yesterday',
                ],
            ],
        ]);

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['attendance.ingest'],
            ]),
            'http://resource.test/api/nexus/v1/attendance/ingest' => Http::response(['ok' => true], 201),
        ]);

        $result = app(ResourceAttendanceForwarder::class)->forwardWithResult($record, $user);

        $this->assertSame('pushed', $result['status']);
        $this->assertSame('synced', data_get($record->fresh()->metadata, 'insan_sync.status'));
        $this->assertDatabaseHas('system_events', [
            'system_id' => 'emzi-nexus-insan',
            'event_type' => 'webhook',
            'status' => 'processed',
        ]);
        Http::assertSent(fn ($req) => $req->url() === 'http://resource.test/api/nexus/v1/attendance/ingest'
            && $req['early_clock_out_reason'] === 'Forgot to clock out yesterday');
    }

    public function test_forwarder_does_not_fabricate_reasons_when_insan_returns_422(): void
    {
        $this->createInsanApplication();
        $user = User::factory()->create(['email' => 'nursyafiqah@emzi.com.my']);
        $record = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_out',
            'photo_url' => 'https://example.com/out.jpg',
            'captured_at' => Carbon::parse('2026-10-30 09:57:00', 'Asia/Kuala_Lumpur'),
            'timezone' => 'Asia/Kuala_Lumpur',
        ]);

        $attempts = 0;
        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['attendance.ingest'],
            ]),
            'http://resource.test/api/nexus/v1/attendance/ingest' => function () use (&$attempts) {
                $attempts++;

                return Http::response([
                    'message' => 'An early clock-out reason is required when leaving before your shift end.',
                ], 422);
            },
        ]);

        $result = app(ResourceAttendanceForwarder::class)->forwardWithResult($record, $user);

        $this->assertSame('failed', $result['status']);
        $this->assertSame(422, $result['http_status']);
        $this->assertFalse($result['retryable']);
        $this->assertSame(1, $attempts);
        $this->assertSame('failed', data_get($record->fresh()->metadata, 'insan_sync.status'));
        $this->assertSame(
            'An early clock-out reason is required when leaving before your shift end.',
            data_get($record->fresh()->metadata, 'insan_sync.error'),
        );
        $this->assertDatabaseHas('system_events', [
            'system_id' => 'emzi-nexus-insan',
            'event_type' => 'error',
            'status' => 'failed',
        ]);
    }

    public function test_admin_can_resync_single_attendance_record_from_dashboard(): void
    {
        $this->createInsanApplication();
        $admin = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'email' => 'admin@emzi.com.my',
        ]);
        $user = User::factory()->create(['email' => 'staff@emzi.com.my']);
        $record = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/in.jpg',
            'captured_at' => now(),
            'source' => 'brain',
            'metadata' => [
                'insan_sync' => [
                    'status' => 'failed',
                    'error' => 'Timeout',
                ],
            ],
        ]);

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['attendance.ingest'],
            ]),
            'http://resource.test/api/nexus/v1/attendance/ingest' => Http::response(['ok' => true], 201),
        ]);

        $token = ApiTokenAuth::issueToken($admin);
        $this->withToken($token)
            ->postJson("/api/attendance/records/{$record->id}/resync")
            ->assertOk()
            ->assertJsonPath('result.status', 'pushed')
            ->assertJsonPath('record.metadata.insan_sync.status', 'synced');
    }

    public function test_push_to_insan_command_pushes_brain_records_and_skips_insan_origin(): void
    {
        $this->createInsanApplication();
        $user = User::factory()->create(['email' => 'nursyafiqah@emzi.com.my']);

        $brainRecord = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/in.jpg',
            'captured_at' => Carbon::parse('2026-10-29 10:08:00', 'Asia/Kuala_Lumpur'),
            'source' => 'brain',
        ]);

        AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_out',
            'photo_url' => 'https://example.com/out.jpg',
            'captured_at' => Carbon::parse('2026-10-29 18:00:00', 'Asia/Kuala_Lumpur'),
            'source' => 'insan',
            'external_id' => 'insan-999',
        ]);

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['attendance.ingest'],
            ]),
            'http://resource.test/api/nexus/v1/attendance/ingest' => Http::response(['ok' => true], 201),
        ]);

        $this->artisan('attendance:push-to-insan', [
            '--from' => '2026-10-29',
            '--to' => '2026-10-29',
            '--user' => 'nursyafiqah@emzi.com.my',
        ])->assertExitCode(0);

        Http::assertSentCount(2); // 1 well-known + 1 ingest for brainRecord only
        Http::assertSent(fn ($req) => $req->url() === 'http://resource.test/api/nexus/v1/attendance/ingest'
            && $req['external_id'] === (string) $brainRecord->id);
    }

    public function test_push_to_insan_command_with_legacy_fallback_retries_422_with_legacy_reason(): void
    {
        $this->createInsanApplication();
        $user = User::factory()->create(['email' => 'nursyafiqah@emzi.com.my']);

        $legacyOut = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_out',
            'photo_url' => 'https://example.com/out.jpg',
            'captured_at' => Carbon::parse('2026-10-30 09:57:00', 'Asia/Kuala_Lumpur'),
            'timezone' => 'Asia/Kuala_Lumpur',
            'source' => 'brain',
        ]);

        $attempts = 0;
        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['attendance.ingest'],
            ]),
            'http://resource.test/api/nexus/v1/attendance/ingest' => function ($request) use (&$attempts) {
                $attempts++;
                if (empty($request['early_clock_out_reason'])) {
                    return Http::response([
                        'message' => 'An early clock-out reason is required when leaving before your shift end.',
                    ], 422);
                }

                return Http::response(['ok' => true], 201);
            },
        ]);

        $this->artisan('attendance:push-to-insan', [
            '--from' => '2026-10-30',
            '--to' => '2026-10-30',
            '--user' => 'nursyafiqah@emzi.com.my',
            '--legacy-fallback' => true,
            '--legacy-reason' => 'Backfill rekod lama Okt 2026',
        ])->assertExitCode(0);

        $this->assertSame(2, $attempts);
        $this->assertSame('synced', data_get($legacyOut->fresh()->metadata, 'insan_sync.status'));
        $this->assertSame(
            ['early_clock_out_reason'],
            data_get($legacyOut->fresh()->metadata, 'insan_sync.fallbacks_applied'),
        );
        Http::assertSent(fn ($req) => $req->url() === 'http://resource.test/api/nexus/v1/attendance/ingest'
            && ($req['early_clock_out_reason'] ?? null) === 'Backfill rekod lama Okt 2026');

        // Running dry-run or push again skips records that are already marked as synced
        $stats = app(\App\Services\InsanAttendancePushService::class)->push(
            from: Carbon::parse('2026-10-30')->startOfDay(),
            to: Carbon::parse('2026-10-30')->endOfDay(),
            userFilter: 'nursyafiqah@emzi.com.my',
            dryRun: true,
        );
        $this->assertSame(1, $stats['total']);
        $this->assertSame(1, $stats['already_synced']);
        $this->assertSame(0, $stats['pushed']);
    }

    public function test_queued_job_throws_on_retryable_server_error(): void
    {
        $this->createInsanApplication();
        $user = User::factory()->create(['email' => 'retry@example.com']);
        $record = AttendanceRecord::query()->create([
            'user_id' => $user->id,
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/in.jpg',
            'captured_at' => now(),
        ]);

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['attendance.ingest'],
            ]),
            'http://resource.test/api/nexus/v1/attendance/ingest' => Http::response('Bad Gateway', 502),
        ]);

        $job = new ForwardAttendanceRecordToResourceJob($record->id, $user->id);

        $this->expectException(RuntimeException::class);
        $job->handle(app(ResourceAttendanceForwarder::class));
    }
}
