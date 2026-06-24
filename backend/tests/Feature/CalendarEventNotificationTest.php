<?php

namespace Tests\Feature;

use App\Models\CalendarEvent;
use App\Models\Notification;
use App\Models\User;
use App\Support\SyncAssignmentRecords;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CalendarEventNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('c', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_creating_event_notifies_invitees(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $invitee = User::factory()->create([
            'email' => 'invitee@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Weekly sync',
                'start_at' => '2026-06-25T10:00:00Z',
                'end_at' => '2026-06-25T11:00:00Z',
                'attendee_emails' => ['invitee@example.com'],
            ])
            ->assertCreated();

        $notification = Notification::query()
            ->where('user_id', (string) $invitee->id)
            ->first();

        $this->assertNotNull($notification);
        $this->assertSame('Meeting invitation: Weekly sync', $notification->title);
        $this->assertSame('calendar', $notification->category);
        $this->assertNull($notification->system_id);
        $this->assertSame('calendar_event_created', $notification->data['kind']);
        $this->assertSame('created', $notification->data['action']);
    }

    public function test_rescheduling_event_notifies_invitees(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $invitee = User::factory()->create([
            'email' => 'invitee@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $event = CalendarEvent::create([
            'title' => 'Planning session',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
            'created_by' => $organizer->email,
        ]);
        SyncAssignmentRecords::syncCalendarEventAttendees($event, ['invitee@example.com']);

        $this->withToken($token)
            ->putJson("/api/calendar-events/{$event->id}", [
                'start_at' => '2026-06-25T14:00:00Z',
                'end_at' => '2026-06-25T15:00:00Z',
            ])
            ->assertOk();

        $notification = Notification::query()
            ->where('user_id', (string) $invitee->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($notification);
        $this->assertSame('Meeting rescheduled: Planning session', $notification->title);
        $this->assertSame('calendar_event_rescheduled', $notification->data['kind']);
        $this->assertSame('rescheduled', $notification->data['action']);
    }

    public function test_updating_title_without_datetime_does_not_notify_invitees(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $invitee = User::factory()->create([
            'email' => 'invitee@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $event = CalendarEvent::create([
            'title' => 'Planning session',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
            'created_by' => $organizer->email,
        ]);
        SyncAssignmentRecords::syncCalendarEventAttendees($event, ['invitee@example.com']);

        $this->withToken($token)
            ->putJson("/api/calendar-events/{$event->id}", [
                'title' => 'Planning session (updated agenda)',
            ])
            ->assertOk();

        $this->assertDatabaseMissing('notifications', [
            'user_id' => (string) $invitee->id,
        ]);
    }

    public function test_deleting_event_notifies_invitees_of_cancellation(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $invitee = User::factory()->create([
            'email' => 'invitee@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $event = CalendarEvent::create([
            'title' => 'Town hall',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
            'created_by' => $organizer->email,
        ]);
        SyncAssignmentRecords::syncCalendarEventAttendees($event, ['invitee@example.com']);

        $this->withToken($token)
            ->deleteJson("/api/calendar-events/{$event->id}")
            ->assertNoContent();

        $notification = Notification::query()
            ->where('user_id', (string) $invitee->id)
            ->first();

        $this->assertNotNull($notification);
        $this->assertSame('Meeting cancelled: Town hall', $notification->title);
        $this->assertSame('calendar_event_cancelled', $notification->data['kind']);
        $this->assertSame('cancelled', $notification->data['action']);
    }

    public function test_organizer_is_not_notified_when_listed_as_invitee(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Solo planning',
                'start_at' => '2026-06-25T10:00:00Z',
                'end_at' => '2026-06-25T11:00:00Z',
                'attendee_emails' => ['organizer@example.com'],
            ])
            ->assertCreated();

        $this->assertDatabaseMissing('notifications', [
            'user_id' => (string) $organizer->id,
        ]);
    }
}
