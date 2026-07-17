<?php

namespace Tests\Unit;

use App\Models\AttendanceRecord;
use App\Models\CalendarEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class AppTimezoneDatetimeRoundTripTest extends TestCase
{
    use RefreshDatabase;

    public function test_calendar_utc_iso_payload_stores_app_timezone_wall_clock(): void
    {
        $timezone = (string) config('app.timezone');

        $event = CalendarEvent::create([
            'title' => 'Timezone check',
            'start_at' => '2026-07-16T13:30:00.000Z',
            'end_at' => '2026-07-16T14:30:00.000Z',
            'created_by' => 'organizer@example.com',
        ]);

        $expectedStart = Carbon::parse('2026-07-16T13:30:00.000Z')->timezone($timezone);
        $expectedEnd = Carbon::parse('2026-07-16T14:30:00.000Z')->timezone($timezone);

        $this->assertDatabaseHas('calendar_events', [
            'id' => $event->id,
            'start_at' => $expectedStart->format('Y-m-d H:i:s'),
            'end_at' => $expectedEnd->format('Y-m-d H:i:s'),
        ]);

        $fresh = $event->fresh();
        $payload = $fresh->toArray();

        $this->assertSame($expectedStart->format('Y-m-d\TH:i:s.uP'), $payload['start_at']);
        $this->assertSame($expectedStart->hour, $fresh->start_at->hour);
        $this->assertSame($expectedStart->minute, $fresh->start_at->minute);
    }

    public function test_attendance_captured_at_stores_app_timezone_wall_clock(): void
    {
        $timezone = (string) config('app.timezone');
        $user = User::factory()->create(['is_approved' => true]);

        $record = AttendanceRecord::create([
            'user_id' => $user->id,
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/photo.jpg',
            'captured_at' => '2026-07-16T01:30:00.000Z',
        ]);

        $expected = Carbon::parse('2026-07-16T01:30:00.000Z')->timezone($timezone);

        $this->assertDatabaseHas('attendance_records', [
            'id' => $record->id,
            'captured_at' => $expected->format('Y-m-d H:i:s'),
        ]);

        $fresh = $record->fresh();

        $this->assertSame($expected->format('Y-m-d\TH:i:s.uP'), $fresh->toArray()['captured_at']);
        $this->assertSame($expected->hour, $fresh->captured_at->hour);
        $this->assertSame($expected->minute, $fresh->captured_at->minute);
    }
}
