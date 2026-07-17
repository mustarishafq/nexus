<?php

namespace Tests\Feature;

use App\Models\CalendarEvent;
use App\Models\CalendarEventAttendance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CalendarEventCheckInTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('q', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_creating_event_returns_check_in_url_for_organizer(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $response = $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Town hall',
                'start_at' => '2026-07-20T10:00:00Z',
                'end_at' => '2026-07-20T11:00:00Z',
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'Town hall');

        $this->assertNotEmpty($response->json('check_in_token'));
        $this->assertStringContainsString('/event-check-in/', (string) $response->json('check_in_url'));
    }

    public function test_public_check_in_links_existing_user_by_email(): void
    {
        $staff = User::factory()->create([
            'email' => 'staff@example.com',
            'full_name' => 'Staff Member',
            'is_approved' => true,
        ]);

        $event = CalendarEvent::create([
            'title' => 'All hands',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => 'organizer@example.com',
        ]);

        $this->postJson('/api/event-check-in/'.$event->check_in_token, [
            'email' => 'Staff@example.com',
            'name' => 'Guest Name',
        ])
            ->assertCreated()
            ->assertJsonPath('attendance.email', 'staff@example.com')
            ->assertJsonPath('attendance.user_id', $staff->id)
            ->assertJsonPath('attendance.is_staff', true)
            ->assertJsonPath('attendance.source', CalendarEventAttendance::SOURCE_PUBLIC_FORM);

        $this->assertDatabaseHas('calendar_event_attendances', [
            'calendar_event_id' => $event->id,
            'email' => 'staff@example.com',
            'user_id' => $staff->id,
        ]);
    }

    public function test_public_check_in_records_unknown_email_as_public(): void
    {
        $event = CalendarEvent::create([
            'title' => 'Open house',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => 'organizer@example.com',
        ]);

        $this->postJson('/api/event-check-in/'.$event->check_in_token, [
            'email' => 'visitor@external.com',
            'name' => 'Visitor',
        ])
            ->assertCreated()
            ->assertJsonPath('attendance.email', 'visitor@external.com')
            ->assertJsonPath('attendance.user_id', null)
            ->assertJsonPath('attendance.is_staff', false)
            ->assertJsonPath('attendance.display_name', 'Visitor');
    }

    public function test_authenticated_scan_check_in_and_duplicate_is_rejected(): void
    {
        $user = User::factory()->create([
            'email' => 'scanner@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($user);

        $event = CalendarEvent::create([
            'title' => 'Workshop',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => 'organizer@example.com',
        ]);

        $this->withToken($token)
            ->postJson('/api/event-check-in/'.$event->check_in_token.'/me')
            ->assertCreated()
            ->assertJsonPath('attendance.source', CalendarEventAttendance::SOURCE_IN_APP)
            ->assertJsonPath('attendance.user_id', $user->id);

        $this->withToken($token)
            ->postJson('/api/event-check-in/'.$event->check_in_token.'/me')
            ->assertStatus(409)
            ->assertJsonPath('message', 'Already checked in for this event.');
    }

    public function test_organizer_can_list_attendances(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
            'role' => 'user',
        ]);
        $token = $this->issueToken($organizer);

        $event = CalendarEvent::create([
            'title' => 'Demo day',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => $organizer->email,
        ]);

        CalendarEventAttendance::create([
            'calendar_event_id' => $event->id,
            'email' => 'guest@example.com',
            'user_id' => null,
            'display_name' => 'Guest',
            'source' => CalendarEventAttendance::SOURCE_PUBLIC_FORM,
            'checked_in_at' => now(),
        ]);

        $this->withToken($token)
            ->getJson('/api/calendar-events/'.$event->id.'/attendances')
            ->assertOk()
            ->assertJsonPath('count', 1)
            ->assertJsonPath('attendances.0.email', 'guest@example.com');
    }

    public function test_checked_in_user_can_see_event_in_calendar_list(): void
    {
        $attendee = User::factory()->create([
            'email' => 'attendee@example.com',
            'is_approved' => true,
            'role' => 'user',
        ]);
        $token = $this->issueToken($attendee);

        $event = CalendarEvent::create([
            'title' => 'Hidden until check-in',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => 'someone-else@example.com',
        ]);

        $this->withToken($token)
            ->getJson('/api/calendar-events')
            ->assertOk()
            ->assertJsonMissing(['id' => $event->id]);

        $this->withToken($token)
            ->postJson('/api/event-check-in/'.$event->check_in_token.'/me')
            ->assertCreated();

        $this->withToken($token)
            ->getJson('/api/calendar-events')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $event->id,
                'title' => 'Hidden until check-in',
                'attended_by_me' => true,
            ]);
    }

    public function test_check_in_blocked_before_opens_at(): void
    {
        $user = User::factory()->create([
            'email' => 'scanner@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($user);

        $event = CalendarEvent::create([
            'title' => 'Later open',
            'start_at' => now()->addDay(),
            'end_at' => now()->addDay()->addHour(),
            'check_in_opens_at' => now()->addHours(2),
            'created_by' => 'organizer@example.com',
        ]);

        $this->withToken($token)
            ->postJson('/api/event-check-in/'.$event->check_in_token.'/me')
            ->assertForbidden()
            ->assertJsonPath('code', 'attendance_not_open');

        $this->getJson('/api/event-check-in/'.$event->check_in_token)
            ->assertOk()
            ->assertJsonPath('attendance_open', false);
    }
}
