<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CorrectUtcWallClockDatetimesMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_migration_shifts_spa_datetimes_from_utc_wall_clock_to_app_timezone(): void
    {
        config(['app.timezone' => 'Asia/Kuala_Lumpur']);

        if (! Schema::hasTable('attendance_records') || ! Schema::hasTable('calendar_events')) {
            $this->markTestSkipped('Required tables are missing.');
        }

        $userId = DB::table('users')->insertGetId([
            'name' => 'Timezone Fix',
            'email' => 'timezone-fix@example.com',
            'password' => bcrypt('password'),
            'is_approved' => true,
            'created_at' => '2026-07-01 00:00:00',
            'updated_at' => '2026-07-01 00:00:00',
        ]);

        $attendanceId = DB::table('attendance_records')->insertGetId([
            'user_id' => $userId,
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/photo.jpg',
            'captured_at' => '2026-07-16 01:30:00',
            'created_at' => '2026-07-16 01:30:00',
            'updated_at' => '2026-07-16 01:30:00',
        ]);

        $eventId = DB::table('calendar_events')->insertGetId([
            'title' => 'Wrong clock',
            'start_at' => '2026-07-16 13:30:00',
            'end_at' => '2026-07-16 14:30:00',
            'created_by' => 'timezone-fix@example.com',
            'external_event_id' => null,
            'created_at' => '2026-07-16 13:30:00',
            'updated_at' => '2026-07-16 13:30:00',
        ]);

        // Webhook/local event should be left alone.
        $webhookEventId = DB::table('calendar_events')->insertGetId([
            'title' => 'Webhook local',
            'start_at' => '2026-07-16 10:30:00',
            'end_at' => '2026-07-16 11:30:00',
            'created_by' => 'timezone-fix@example.com',
            'source_system_id' => 'sys-1',
            'external_event_id' => 'ext-1',
            'created_at' => '2026-07-16 10:30:00',
            'updated_at' => '2026-07-16 10:30:00',
        ]);

        $migration = require database_path('migrations/2026_07_17_000100_correct_utc_wall_clock_datetimes_to_app_timezone.php');
        $migration->up();

        $this->assertSame(
            '2026-07-16 09:30:00',
            DB::table('attendance_records')->where('id', $attendanceId)->value('captured_at')
        );
        $this->assertSame(
            '2026-07-16 21:30:00',
            DB::table('calendar_events')->where('id', $eventId)->value('start_at')
        );
        $this->assertSame(
            '2026-07-16 22:30:00',
            DB::table('calendar_events')->where('id', $eventId)->value('end_at')
        );
        $this->assertSame(
            '2026-07-16 10:30:00',
            DB::table('calendar_events')->where('id', $webhookEventId)->value('start_at')
        );

        $migration->down();

        $this->assertSame(
            '2026-07-16 01:30:00',
            DB::table('attendance_records')->where('id', $attendanceId)->value('captured_at')
        );
        $this->assertSame(
            '2026-07-16 13:30:00',
            DB::table('calendar_events')->where('id', $eventId)->value('start_at')
        );
    }
}
