<?php

namespace Tests\Unit;

use App\Models\CalendarEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AppTimezoneDateTimeCastTest extends TestCase
{
    use RefreshDatabase;

    public function test_utc_iso_payload_round_trips_to_local_wall_clock(): void
    {
        config(['app.timezone' => 'Asia/Kuala_Lumpur']);

        // 9:30 PM MYT === 13:30 UTC
        $event = CalendarEvent::create([
            'title' => 'Timezone check',
            'start_at' => '2026-07-16T13:30:00.000Z',
            'end_at' => '2026-07-16T14:30:00.000Z',
            'created_by' => 'organizer@example.com',
        ]);

        $this->assertDatabaseHas('calendar_events', [
            'id' => $event->id,
            'start_at' => '2026-07-16 21:30:00',
            'end_at' => '2026-07-16 22:30:00',
        ]);

        $fresh = $event->fresh();
        $payload = $fresh->toArray();

        $this->assertSame('2026-07-16T13:30:00.000000Z', $payload['start_at']);
        $this->assertSame('2026-07-16T14:30:00.000000Z', $payload['end_at']);
        $this->assertSame(21, $fresh->start_at->timezone('Asia/Kuala_Lumpur')->hour);
        $this->assertSame(30, $fresh->start_at->timezone('Asia/Kuala_Lumpur')->minute);
    }
}
