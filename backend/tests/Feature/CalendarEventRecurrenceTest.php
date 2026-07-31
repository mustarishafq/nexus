<?php

namespace Tests\Feature;

use App\Models\CalendarEvent;
use App\Models\User;
use App\Services\CalendarEventRecurrenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CalendarEventRecurrenceTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('r', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_weekly_recurrence_creates_only_first_occurrence(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $response = $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Liqa Ilmi',
                'start_at' => '2026-07-31T01:30:00Z',
                'end_at' => '2026-07-31T02:30:00Z',
                'check_in_opens_at' => '2026-07-31T01:00:00Z',
                'recurrence_frequency' => 'weekly',
                'recurrence_weekday' => 5,
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'Liqa Ilmi')
            ->assertJsonPath('series_index', 0)
            ->assertJsonPath('recurrence_weekday', 5);

        $seriesId = $response->json('series_id');
        $this->assertNotEmpty($seriesId);
        $this->assertDatabaseCount('calendar_events', 1);
        $this->assertTrue(
            Carbon::parse($response->json('start_at'))->equalTo(Carbon::parse('2026-07-31T01:30:00Z'))
        );
    }

    public function test_weekly_weekday_aligns_first_occurrence(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $response = $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Friday series',
                'start_at' => '2026-07-28T01:00:00Z', // Tuesday
                'end_at' => '2026-07-28T02:00:00Z',
                'recurrence_frequency' => 'weekly',
                'recurrence_weekday' => 5, // Friday
            ])
            ->assertCreated();

        $this->assertTrue(
            Carbon::parse($response->json('start_at'))->equalTo(Carbon::parse('2026-07-31T01:00:00Z'))
        );
        $this->assertSame(5, (int) $response->json('recurrence_weekday'));
    }

    public function test_spawns_next_occurrence_after_event_ends(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $response = $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Rolling weekly',
                'start_at' => '2026-07-31T01:30:00Z',
                'end_at' => '2026-07-31T02:30:00Z',
                'check_in_opens_at' => '2026-07-31T01:00:00Z',
                'recurrence_frequency' => 'weekly',
                'recurrence_weekday' => 5,
                'series_share_qr' => true,
            ])
            ->assertCreated();

        $firstId = $response->json('id');
        $sharedToken = $response->json('check_in_token');
        $this->assertDatabaseCount('calendar_events', 1);

        $first = CalendarEvent::query()->findOrFail($firstId);
        Carbon::setTestNow($first->end_at->copy()->addMinute());

        $this->artisan('calendar:spawn-next-recurring')
            ->assertSuccessful();

        $this->assertDatabaseCount('calendar_events', 2);

        $next = CalendarEvent::query()
            ->where('series_id', $response->json('series_id'))
            ->where('series_index', 1)
            ->firstOrFail();

        $this->assertTrue($next->start_at->equalTo($first->start_at->copy()->addWeek()));
        $this->assertNotNull($first->check_in_opens_at);
        $this->assertTrue(
            $next->check_in_opens_at->equalTo($first->check_in_opens_at->copy()->addWeek())
        );
        $this->assertSame($sharedToken, $next->check_in_token);
        $this->assertSame('Rolling weekly', $next->title);

        // Running again before the next event ends should not create another.
        $this->artisan('calendar:spawn-next-recurring')->assertSuccessful();
        $this->assertDatabaseCount('calendar_events', 2);

        $this->assertDatabaseHas('calendar_events', ['id' => $firstId]);

        Carbon::setTestNow();
    }

    public function test_does_not_spawn_before_event_ends(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $response = $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Not yet',
                'start_at' => '2026-07-31T01:30:00Z',
                'end_at' => '2026-07-31T02:30:00Z',
                'recurrence_frequency' => 'weekly',
            ])
            ->assertCreated();

        $first = CalendarEvent::query()->findOrFail($response->json('id'));
        Carbon::setTestNow($first->end_at->copy()->subMinute());

        $this->artisan('calendar:spawn-next-recurring')->assertSuccessful();
        $this->assertDatabaseCount('calendar_events', 1);

        Carbon::setTestNow();
    }

    public function test_update_and_delete_affect_single_occurrence_only(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $response = $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Series',
                'start_at' => '2026-07-01T10:00:00Z',
                'end_at' => '2026-07-01T11:00:00Z',
                'recurrence_frequency' => 'weekly',
            ])
            ->assertCreated();

        $first = CalendarEvent::query()->findOrFail($response->json('id'));
        Carbon::setTestNow($first->end_at->copy()->addMinute());
        $second = app(CalendarEventRecurrenceService::class)->spawnNextIfDue($first);
        $this->assertNotNull($second);

        $this->withToken($token)
            ->patchJson('/api/calendar-events/'.$second->id, [
                'title' => 'Only second',
            ])
            ->assertOk()
            ->assertJsonPath('title', 'Only second');

        $this->assertDatabaseHas('calendar_events', [
            'id' => $first->id,
            'title' => 'Series',
        ]);

        $this->withToken($token)
            ->deleteJson('/api/calendar-events/'.$second->id)
            ->assertNoContent();

        $this->assertDatabaseMissing('calendar_events', ['id' => $second->id]);
        $this->assertDatabaseCount('calendar_events', 1);

        Carbon::setTestNow();
    }

    public function test_shared_qr_flag_is_stored_on_first_occurrence(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Shared QR series',
                'start_at' => '2026-07-31T01:30:00Z',
                'end_at' => '2026-07-31T02:30:00Z',
                'recurrence_frequency' => 'weekly',
                'series_share_qr' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('series_share_qr', true);

        $this->assertDatabaseCount('calendar_events', 1);
    }

    public function test_shared_qr_check_in_targets_open_occurrence(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-07T02:00:00Z'));

        $user = User::factory()->create([
            'email' => 'scanner@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($user);
        $sharedToken = (string) \Illuminate\Support\Str::uuid();

        $past = CalendarEvent::create([
            'title' => 'Shared past',
            'start_at' => '2026-07-31T01:30:00Z',
            'end_at' => '2026-07-31T02:30:00Z',
            'created_by' => 'organizer@example.com',
            'check_in_token' => $sharedToken,
            'series_id' => '11111111-1111-1111-1111-111111111111',
            'series_index' => 0,
            'series_share_qr' => true,
            'recurrence_frequency' => 'weekly',
        ]);

        $current = CalendarEvent::create([
            'title' => 'Shared current',
            'start_at' => '2026-08-07T01:30:00Z',
            'end_at' => '2026-08-07T02:30:00Z',
            'created_by' => 'organizer@example.com',
            'check_in_token' => $sharedToken,
            'series_id' => '11111111-1111-1111-1111-111111111111',
            'series_index' => 1,
            'series_share_qr' => true,
            'recurrence_frequency' => 'weekly',
        ]);

        $this->withToken($token)
            ->postJson('/api/event-check-in/'.$sharedToken.'/me')
            ->assertCreated()
            ->assertJsonPath('event.title', 'Shared current');

        $this->assertDatabaseHas('calendar_event_attendances', [
            'calendar_event_id' => $current->id,
            'email' => 'scanner@example.com',
        ]);
        $this->assertDatabaseMissing('calendar_event_attendances', [
            'calendar_event_id' => $past->id,
        ]);

        Carbon::setTestNow();
    }

    public function test_monthly_first_day_mode_aligns_first_occurrence(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $response = $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Month start',
                'start_at' => '2026-07-15T01:00:00Z',
                'end_at' => '2026-07-15T02:00:00Z',
                'recurrence_frequency' => 'monthly',
                'recurrence_month_mode' => 'first_day',
            ])
            ->assertCreated();

        $this->assertDatabaseCount('calendar_events', 1);
        $this->assertTrue(
            Carbon::parse($response->json('start_at'))->equalTo(Carbon::parse('2026-08-01T01:00:00Z'))
        );

        $first = CalendarEvent::query()->findOrFail($response->json('id'));
        Carbon::setTestNow($first->end_at->copy()->addMinute());
        $next = app(CalendarEventRecurrenceService::class)->spawnNextIfDue($first);

        $this->assertNotNull($next);
        $this->assertTrue($next->start_at->equalTo($first->start_at->copy()->addMonthNoOverflow()->startOfMonth()->setTimeFrom($first->start_at)));

        Carbon::setTestNow();
    }

    public function test_monthly_last_day_and_specific_day_modes(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $lastDay = $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Month end',
                'start_at' => '2026-01-10T03:00:00Z',
                'end_at' => '2026-01-10T04:00:00Z',
                'recurrence_frequency' => 'monthly',
                'recurrence_month_mode' => 'last_day',
            ])
            ->assertCreated();

        $first = CalendarEvent::query()->findOrFail($lastDay->json('id'));
        $this->assertSame(31, (int) $first->start_at->day);

        Carbon::setTestNow($first->end_at->copy()->addMinute());
        $next = app(CalendarEventRecurrenceService::class)->spawnNextIfDue($first);
        $this->assertNotNull($next);
        $this->assertSame(28, (int) $next->start_at->day);
        $this->assertSame(2, (int) $next->start_at->month);

        Carbon::setTestNow();

        $specific = $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Month day 15',
                'start_at' => '2026-01-01T05:00:00Z',
                'end_at' => '2026-01-01T06:00:00Z',
                'recurrence_frequency' => 'monthly',
                'recurrence_month_mode' => 'day_of_month',
                'recurrence_month_day' => 15,
            ])
            ->assertCreated();

        $specificFirst = CalendarEvent::query()->findOrFail($specific->json('id'));
        $this->assertSame(15, (int) $specificFirst->start_at->day);
    }
}
