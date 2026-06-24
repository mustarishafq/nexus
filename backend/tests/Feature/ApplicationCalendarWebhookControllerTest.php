<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\CalendarEvent;
use App\Models\Notification;
use App\Models\SystemEvent;
use App\Models\User;
use App\Support\CalendarEventMapping;
use App\Support\SyncAssignmentRecords;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApplicationCalendarWebhookControllerTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('c', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_webhook_skips_calendar_sync_when_auto_sync_disabled(): void
    {
        $application = Application::factory()->create([
            'calendar_config' => CalendarEventMapping::normalize([
                'auto_sync' => false,
                'webhook_secret' => 'calendar-secret',
            ]),
        ]);

        $this->postJson("/api/applications/{$application->id}/calendar-webhook", [
            'event' => 'calendar.created',
            'external_event_id' => 'meet-1',
            'title' => 'Planning session',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
        ], ['X-Webhook-Secret' => 'calendar-secret'])
            ->assertAccepted()
            ->assertJson([
                'ok' => true,
                'calendar_event' => null,
            ]);

        $this->assertSame(0, CalendarEvent::query()->count());
        $this->assertSame(1, SystemEvent::query()->count());
    }

    public function test_webhook_creates_calendar_event_when_auto_sync_enabled(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $invitee = User::factory()->create([
            'email' => 'invitee@example.com',
            'is_approved' => true,
        ]);

        $application = Application::factory()->create([
            'slug' => 'booking-app',
            'created_by_user_id' => $organizer->id,
            'calendar_config' => CalendarEventMapping::normalize([
                'auto_sync' => true,
                'webhook_secret' => 'calendar-secret',
            ]),
        ]);

        $this->postJson("/api/applications/{$application->id}/calendar-webhook", [
            'event' => 'calendar.created',
            'external_event_id' => 'meet-1',
            'title' => 'Planning session',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
            'attendee_user_ids' => [$invitee->id],
        ], ['X-Webhook-Secret' => 'calendar-secret'])
            ->assertCreated()
            ->assertJsonPath('action', 'created')
            ->assertJsonPath('calendar_event.title', 'Planning session');

        $this->assertDatabaseHas('calendar_event_attendees', [
            'email' => 'invitee@example.com',
        ]);

        $this->assertSame(1, Notification::query()->where('user_id', (string) $invitee->id)->count());
    }

    public function test_webhook_creates_calendar_event_with_email_invitees(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $invitee = User::factory()->create([
            'email' => 'invitee@example.com',
            'is_approved' => true,
        ]);

        $application = Application::factory()->create([
            'slug' => 'booking-app',
            'created_by_user_id' => $organizer->id,
            'calendar_config' => CalendarEventMapping::normalize([
                'auto_sync' => true,
                'webhook_secret' => 'calendar-secret',
            ]),
        ]);

        $this->postJson("/api/applications/{$application->id}/calendar-webhook", [
            'event' => 'calendar.created',
            'external_event_id' => 'meet-1',
            'title' => 'Planning session',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
            'attendee_emails' => ['invitee@example.com'],
        ], ['X-Webhook-Secret' => 'calendar-secret'])
            ->assertCreated();

        $this->assertSame(1, Notification::query()->where('user_id', (string) $invitee->id)->count());
    }

    public function test_webhook_reschedules_existing_event_and_notifies_invitees(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $invitee = User::factory()->create([
            'email' => 'invitee@example.com',
            'is_approved' => true,
        ]);

        $application = Application::factory()->create([
            'slug' => 'booking-app',
            'created_by_user_id' => $organizer->id,
            'calendar_config' => CalendarEventMapping::normalize([
                'auto_sync' => true,
                'webhook_secret' => 'calendar-secret',
            ]),
        ]);

        $event = CalendarEvent::create([
            'title' => 'Planning session',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
            'created_by' => 'organizer@example.com',
            'source_system_id' => 'booking-app',
            'external_event_id' => 'meet-1',
        ]);
        SyncAssignmentRecords::syncCalendarEventAttendees($event, ['invitee@example.com']);

        $this->postJson("/api/applications/{$application->id}/calendar-webhook", [
            'event' => 'calendar.rescheduled',
            'external_event_id' => 'meet-1',
            'title' => 'Planning session',
            'start_at' => '2026-06-25T14:00:00Z',
            'end_at' => '2026-06-25T15:00:00Z',
            'attendee_emails' => ['invitee@example.com'],
        ], ['X-Webhook-Secret' => 'calendar-secret'])
            ->assertOk()
            ->assertJsonPath('action', 'rescheduled');

        $this->assertDatabaseHas('calendar_events', [
            'id' => $event->id,
            'external_event_id' => 'meet-1',
        ]);

        $notification = Notification::query()
            ->where('user_id', (string) $invitee->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($notification);
        $this->assertSame('calendar_event_rescheduled', $notification->data['kind']);
    }

    public function test_webhook_cancels_existing_event_and_notifies_invitees(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $invitee = User::factory()->create([
            'email' => 'invitee@example.com',
            'is_approved' => true,
        ]);

        $application = Application::factory()->create([
            'slug' => 'booking-app',
            'created_by_user_id' => $organizer->id,
            'calendar_config' => CalendarEventMapping::normalize([
                'auto_sync' => true,
                'webhook_secret' => 'calendar-secret',
            ]),
        ]);

        $event = CalendarEvent::create([
            'title' => 'Planning session',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
            'created_by' => 'organizer@example.com',
            'source_system_id' => 'booking-app',
            'external_event_id' => 'meet-1',
        ]);
        SyncAssignmentRecords::syncCalendarEventAttendees($event, ['invitee@example.com']);

        $this->postJson("/api/applications/{$application->id}/calendar-webhook", [
            'event' => 'calendar.cancelled',
            'external_event_id' => 'meet-1',
        ], ['X-Webhook-Secret' => 'calendar-secret'])
            ->assertOk()
            ->assertJsonPath('action', 'cancelled');

        $this->assertDatabaseMissing('calendar_events', ['id' => $event->id]);

        $notification = Notification::query()
            ->where('user_id', (string) $invitee->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($notification);
        $this->assertSame('calendar_event_cancelled', $notification->data['kind']);
    }

    public function test_preview_accepts_inline_calendar_config(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'calendar_config' => CalendarEventMapping::normalize([
                'field_mappings' => [
                    'title' => ['title'],
                    'action' => ['event'],
                ],
            ]),
        ]);

        $this->postJson("/api/applications/{$application->id}/calendar-webhook/preview", [
            'event' => [
                'event' => 'calendar.created',
                'title' => 'Planning session',
                'external_event_id' => 'meet-1',
                'start_at' => '2026-06-25T10:00:00Z',
                'end_at' => '2026-06-25T11:00:00Z',
            ],
            'calendar_config' => CalendarEventMapping::normalize([
                'field_mappings' => [
                    'title' => ['title'],
                    'action' => ['event'],
                ],
            ]),
        ], ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonPath('payload.title', 'Planning session')
            ->assertJsonPath('payload.action', 'created');
    }

    public function test_preview_maps_nested_preset_sample_payload(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'calendar_config' => CalendarEventMapping::defaults(),
        ]);

        $nestedMappings = [
            'title' => ['data.title'],
            'description' => ['data.description'],
            'location' => ['data.location'],
            'start_at' => ['data.start_at', 'data.starts_at'],
            'end_at' => ['data.end_at', 'data.ends_at'],
            'is_all_day' => ['data.is_all_day'],
            'attendee_emails' => ['data.attendee_emails', 'data.attendees'],
            'attendee_user_ids' => ['data.attendee_user_ids', 'data.user_ids'],
            'action' => ['event', 'data.action', 'data.type'],
            'external_event_id' => ['data.id', 'data.event_id', 'data.external_event_id'],
            'created_by' => ['data.organizer_email', 'data.created_by'],
        ];

        $this->postJson("/api/applications/{$application->id}/calendar-webhook/preview", [
            'event' => [
                'event' => 'calendar.rescheduled',
                'fired_at' => '2026-06-11T23:45:01.907473+08:00',
                'data' => [
                    'id' => 'meet-1234',
                    'action' => 'rescheduled',
                    'title' => 'Quarterly planning',
                    'description' => 'Review Q3 goals and blockers',
                    'location' => 'HQ Meeting Room A',
                    'start_at' => '2026-06-26T14:00:00+08:00',
                    'end_at' => '2026-06-26T15:00:00+08:00',
                    'attendee_emails' => ['alex@example.com', 'sam@example.com'],
                    'organizer_email' => 'organizer@example.com',
                ],
            ],
            'calendar_config' => CalendarEventMapping::normalize([
                'field_mappings' => $nestedMappings,
            ]),
        ], ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonPath('payload.title', 'Quarterly planning')
            ->assertJsonPath('payload.external_event_id', 'meet-1234')
            ->assertJsonPath('payload.action', 'rescheduled')
            ->assertJsonPath('payload.created_by', 'organizer@example.com')
            ->assertJsonPath('payload.attendee_emails', ['alex@example.com', 'sam@example.com']);
    }
}
