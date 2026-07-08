<?php

namespace Tests\Unit;

use App\Models\Application;
use App\Models\User;
use App\Services\CalendarEventMapperService;
use App\Support\CalendarEventMapping;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CalendarEventMapperServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_resolves_invitees_from_emails_and_user_ids(): void
    {
        $byEmail = User::factory()->create([
            'email' => 'alex@example.com',
            'is_approved' => true,
        ]);
        $byId = User::factory()->create([
            'email' => 'sam@example.com',
            'is_approved' => true,
        ]);

        $application = Application::factory()->create([
            'calendar_config' => CalendarEventMapping::defaults(),
        ]);

        $mapper = app(CalendarEventMapperService::class);
        $payload = $mapper->map($application, [
            'event' => 'calendar.created',
            'external_event_id' => 'meet-1',
            'title' => 'Planning',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
            'attendee_emails' => ['alex@example.com', ['user_id' => $byId->id]],
            'attendee_user_ids' => [$byEmail->id],
        ]);

        $this->assertSame(
            ['alex@example.com', 'sam@example.com'],
            $payload['attendee_emails']
        );
    }

    public function test_resolves_invitees_from_attendees_objects_with_user_id(): void
    {
        $invitee = User::factory()->create([
            'email' => 'invitee@example.com',
            'is_approved' => true,
        ]);

        $application = Application::factory()->create([
            'calendar_config' => CalendarEventMapping::defaults(),
        ]);

        $payload = app(CalendarEventMapperService::class)->map($application, [
            'event' => 'calendar.created',
            'external_event_id' => 'meet-2',
            'title' => 'Sync',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
            'attendees' => [
                ['user_id' => (string) $invitee->id],
            ],
        ]);

        $this->assertSame(['invitee@example.com'], $payload['attendee_emails']);
    }

    public function test_resolves_organizer_from_user_id(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);

        $application = Application::factory()->create([
            'calendar_config' => CalendarEventMapping::defaults(),
        ]);

        $payload = app(CalendarEventMapperService::class)->map($application, [
            'event' => 'calendar.created',
            'external_event_id' => 'meet-3',
            'title' => 'Sync',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
            'organizer_user_id' => $organizer->id,
        ]);

        $this->assertSame($organizer->id, $payload['created_by_user_id']);
        $this->assertArrayNotHasKey('created_by', $payload);
    }

    public function test_maps_nested_payload_with_default_field_mappings(): void
    {
        $application = Application::factory()->create([
            'calendar_config' => CalendarEventMapping::defaults(),
        ]);

        $payload = app(CalendarEventMapperService::class)->map($application, [
            'event' => 'calendar.rescheduled',
            'data' => [
                'id' => 'meet-1234',
                'title' => 'Quarterly planning',
                'start_at' => '2026-06-26T14:00:00+08:00',
                'end_at' => '2026-06-26T15:00:00+08:00',
            ],
        ]);

        $this->assertSame('Quarterly planning', $payload['title']);
        $this->assertSame('meet-1234', $payload['external_event_id']);
        $this->assertSame('rescheduled', $payload['action']);
        $this->assertArrayHasKey('start_at', $payload);
        $this->assertArrayHasKey('end_at', $payload);
    }

    public function test_parses_timezone_less_scheduled_start_in_configured_timezone(): void
    {
        config(['app.timezone' => 'Asia/Kuala_Lumpur']);

        $application = Application::factory()->create([
            'calendar_config' => CalendarEventMapping::defaults(),
        ]);

        $payload = app(CalendarEventMapperService::class)->map($application, [
            'event' => 'meeting.created',
            'data' => [
                'id' => '44',
                'title' => 'NEXUS DRIVE BIL 23/2026',
                'scheduled_start' => '2026-07-09 10:30:00',
                'scheduled_end' => '2026-07-09 13:00:00',
                'action' => 'created',
            ],
        ]);

        $this->assertSame('created', $payload['action']);
        $this->assertTrue($payload['start_at']->equalTo(
            \Illuminate\Support\Carbon::parse('2026-07-09 10:30:00', 'Asia/Kuala_Lumpur')
        ));
        $this->assertTrue($payload['end_at']->equalTo(
            \Illuminate\Support\Carbon::parse('2026-07-09 13:00:00', 'Asia/Kuala_Lumpur')
        ));
        $this->assertSame('2026-07-09T02:30:00.000000Z', $payload['start_at']->toISOString());
    }

    public function test_preserves_explicit_timezone_in_datetime_values(): void
    {
        $application = Application::factory()->create([
            'calendar_config' => CalendarEventMapping::defaults(),
        ]);

        $payload = app(CalendarEventMapperService::class)->map($application, [
            'event' => 'calendar.created',
            'title' => 'Planning',
            'external_event_id' => 'meet-tz',
            'start_at' => '2026-06-25T10:00:00Z',
            'end_at' => '2026-06-25T11:00:00Z',
        ]);

        $this->assertSame('2026-06-25T10:00:00.000000Z', $payload['start_at']->toISOString());
        $this->assertSame('2026-06-25T11:00:00.000000Z', $payload['end_at']->toISOString());
    }
}
