<?php

namespace Tests\Feature;

use App\Models\CalendarEvent;
use App\Models\CalendarEventAttendance;
use App\Models\User;
use App\Services\CalendarEventRecurrenceService;
use App\Support\CalendarEventCheckInForm;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
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
        $this->assertSame('Name', $response->json('check_in_form_fields.0.label'));
        $this->assertSame(CalendarEventCheckInForm::AUDIENCE_PUBLIC, $response->json('check_in_form_audience'));
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

    public function test_organizer_can_export_attendances_csv(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
            'role' => 'user',
        ]);
        $token = $this->issueToken($organizer);

        $event = CalendarEvent::create([
            'title' => 'Export day',
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
            'checked_in_at' => Carbon::parse('2026-07-20T10:05:00Z'),
        ]);

        $response = $this->withToken($token)
            ->get('/api/calendar-events/'.$event->id.'/attendances/export')
            ->assertOk();

        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
        $csv = $response->streamedContent();
        $this->assertStringContainsString('Name,Email,Type,Source,"Checked in at"', $csv);
        $this->assertStringContainsString('Guest,guest@example.com,Public,'.CalendarEventAttendance::SOURCE_PUBLIC_FORM, $csv);
    }

    public function test_non_organizer_cannot_export_attendances_csv(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
            'role' => 'user',
        ]);
        $outsider = User::factory()->create([
            'email' => 'outsider@example.com',
            'is_approved' => true,
            'role' => 'user',
        ]);
        $token = $this->issueToken($outsider);

        $event = CalendarEvent::create([
            'title' => 'Private export',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => $organizer->email,
        ]);

        $this->withToken($token)
            ->get('/api/calendar-events/'.$event->id.'/attendances/export')
            ->assertForbidden();
    }

    public function test_organizer_can_list_series_occurrences_for_attendance_filter(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
            'role' => 'user',
        ]);
        $token = $this->issueToken($organizer);
        $seriesId = '33333333-3333-3333-3333-333333333333';

        $first = CalendarEvent::create([
            'title' => 'Weekly series',
            'start_at' => '2026-07-31T01:30:00Z',
            'end_at' => '2026-07-31T02:30:00Z',
            'created_by' => $organizer->email,
            'series_id' => $seriesId,
            'series_index' => 0,
            'recurrence_frequency' => 'weekly',
        ]);

        $second = CalendarEvent::create([
            'title' => 'Weekly series',
            'start_at' => '2026-08-07T01:30:00Z',
            'end_at' => '2026-08-07T02:30:00Z',
            'created_by' => $organizer->email,
            'series_id' => $seriesId,
            'series_index' => 1,
            'recurrence_frequency' => 'weekly',
        ]);

        CalendarEventAttendance::create([
            'calendar_event_id' => $second->id,
            'email' => 'guest@example.com',
            'user_id' => null,
            'display_name' => 'Guest',
            'source' => CalendarEventAttendance::SOURCE_PUBLIC_FORM,
            'checked_in_at' => now(),
        ]);

        $this->withToken($token)
            ->getJson('/api/calendar-events/'.$first->id.'/series-occurrences')
            ->assertOk()
            ->assertJsonPath('series_id', $seriesId)
            ->assertJsonPath('occurrences.0.id', $first->id)
            ->assertJsonPath('occurrences.0.attendance_count', 0)
            ->assertJsonPath('occurrences.1.id', $second->id)
            ->assertJsonPath('occurrences.1.attendance_count', 1);
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

    public function test_organizer_can_save_custom_check_in_form_on_create_and_update(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $created = $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Form builder',
                'start_at' => '2026-07-20T10:00:00Z',
                'end_at' => '2026-07-20T11:00:00Z',
                'check_in_form_audience' => CalendarEventCheckInForm::AUDIENCE_EVERYONE,
                'check_in_form_fields' => [
                    ['label' => 'Name', 'key' => 'name', 'type' => 'text', 'required' => true],
                    ['label' => 'Phone', 'key' => 'phone', 'type' => 'phone', 'required' => true],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('check_in_form_audience', CalendarEventCheckInForm::AUDIENCE_EVERYONE)
            ->assertJsonPath('check_in_form_fields.0.key', 'name')
            ->assertJsonPath('check_in_form_fields.1.key', 'phone')
            ->assertJsonPath('check_in_form_fields.1.required', true);

        $this->withToken($token)
            ->patchJson('/api/calendar-events/'.$created->json('id'), [
                'check_in_form_audience' => CalendarEventCheckInForm::AUDIENCE_PUBLIC,
                'check_in_form_fields' => [
                    ['label' => 'Company', 'key' => 'company', 'type' => 'text', 'required' => false],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('check_in_form_audience', CalendarEventCheckInForm::AUDIENCE_PUBLIC)
            ->assertJsonPath('check_in_form_fields.0.key', 'company')
            ->assertJsonPath('check_in_form_fields.0.required', false);
    }

    public function test_public_show_includes_default_check_in_form(): void
    {
        $event = CalendarEvent::create([
            'title' => 'Form preview',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => 'organizer@example.com',
        ]);

        $this->getJson('/api/event-check-in/'.$event->check_in_token)
            ->assertOk()
            ->assertJsonPath('check_in_form.audience', CalendarEventCheckInForm::AUDIENCE_PUBLIC)
            ->assertJsonPath('check_in_form.fields.0.key', 'name')
            ->assertJsonPath('check_in_form.fields.0.required', false);
    }

    public function test_required_custom_field_is_rejected_when_missing(): void
    {
        $event = CalendarEvent::create([
            'title' => 'Required phone',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => 'organizer@example.com',
            'check_in_form_fields' => [
                ['id' => 'phone', 'key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
            ],
        ]);

        $this->postJson('/api/event-check-in/'.$event->check_in_token, [
            'email' => 'visitor@external.com',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['answers.phone']);
    }

    public function test_public_check_in_persists_custom_answers_and_list_and_csv_include_them(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
            'role' => 'user',
        ]);
        $token = $this->issueToken($organizer);

        $event = CalendarEvent::create([
            'title' => 'Custom form night',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => $organizer->email,
            'check_in_form_fields' => [
                ['id' => 'name', 'key' => 'name', 'label' => 'Name', 'type' => 'text', 'required' => true],
                ['id' => 'phone', 'key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
                ['id' => 'company', 'key' => 'company', 'label' => 'Company', 'type' => 'text', 'required' => false],
            ],
        ]);

        $this->postJson('/api/event-check-in/'.$event->check_in_token, [
            'email' => 'visitor@external.com',
            'answers' => [
                'name' => 'Visitor One',
                'phone' => '0123456789',
                'company' => 'Acme',
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('attendance.display_name', 'Visitor One')
            ->assertJsonPath('attendance.form_answers.phone', '+60123456789')
            ->assertJsonPath('attendance.form_answers.company', 'Acme');

        $this->withToken($token)
            ->getJson('/api/calendar-events/'.$event->id.'/attendances')
            ->assertOk()
            ->assertJsonPath('attendances.0.form_answers.company', 'Acme')
            ->assertJsonPath('check_in_form.fields.1.key', 'phone');

        $csv = $this->withToken($token)
            ->get('/api/calendar-events/'.$event->id.'/attendances/export')
            ->assertOk()
            ->streamedContent();

        $this->assertStringContainsString('Name,Email,Type,Source,"Checked in at",Phone,Company', $csv);
        $this->assertStringContainsString('"Visitor One",visitor@external.com,Public', $csv);
        $this->assertStringContainsString('+60123456789', $csv);
        $this->assertStringContainsString('Acme', $csv);
    }

    public function test_authenticated_check_in_skips_answers_when_audience_is_public(): void
    {
        $user = User::factory()->create([
            'email' => 'scanner@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($user);

        $event = CalendarEvent::create([
            'title' => 'Staff one tap',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => 'organizer@example.com',
            'check_in_form_audience' => CalendarEventCheckInForm::AUDIENCE_PUBLIC,
            'check_in_form_fields' => [
                ['id' => 'phone', 'key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
            ],
        ]);

        $this->withToken($token)
            ->postJson('/api/event-check-in/'.$event->check_in_token.'/me')
            ->assertCreated()
            ->assertJsonPath('attendance.form_answers', []);
    }

    public function test_authenticated_check_in_requires_answers_when_audience_is_everyone(): void
    {
        $user = User::factory()->create([
            'email' => 'scanner@example.com',
            'full_name' => 'Scanner User',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($user);

        $event = CalendarEvent::create([
            'title' => 'Staff must fill',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => 'organizer@example.com',
            'check_in_form_audience' => CalendarEventCheckInForm::AUDIENCE_EVERYONE,
            'check_in_form_fields' => [
                ['id' => 'phone', 'key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
            ],
        ]);

        $this->withToken($token)
            ->postJson('/api/event-check-in/'.$event->check_in_token.'/me')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['answers.phone']);

        $this->withToken($token)
            ->postJson('/api/event-check-in/'.$event->check_in_token.'/me', [
                'answers' => ['phone' => '0123456789'],
            ])
            ->assertCreated()
            ->assertJsonPath('attendance.form_answers.phone', '+60123456789')
            ->assertJsonPath('attendance.display_name', 'Scanner User');
    }

    public function test_recurring_spawn_copies_check_in_form_schema(): void
    {
        $fields = [
            ['id' => 'phone', 'key' => 'phone', 'label' => 'Phone', 'type' => 'phone', 'required' => true],
        ];

        $first = CalendarEvent::create([
            'title' => 'Weekly custom form',
            'start_at' => '2026-07-31T01:30:00Z',
            'end_at' => '2026-07-31T02:30:00Z',
            'created_by' => 'organizer@example.com',
            'series_id' => '44444444-4444-4444-4444-444444444444',
            'series_index' => 0,
            'recurrence_frequency' => 'weekly',
            'check_in_form_audience' => CalendarEventCheckInForm::AUDIENCE_EVERYONE,
            'check_in_form_fields' => $fields,
        ]);

        Carbon::setTestNow($first->end_at->copy()->addMinute());
        $second = app(CalendarEventRecurrenceService::class)->spawnNextIfDue($first);
        Carbon::setTestNow();

        $this->assertNotNull($second);
        $this->assertSame(CalendarEventCheckInForm::AUDIENCE_EVERYONE, $second->check_in_form_audience);
        $this->assertSame('phone', $second->check_in_form_fields[0]['key']);
        $this->assertTrue($second->check_in_form_fields[0]['required']);
    }

    public function test_poll_field_requires_at_least_two_options(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($organizer);

        $this->withToken($token)
            ->postJson('/api/calendar-events', [
                'title' => 'Bad poll',
                'start_at' => '2026-07-20T10:00:00Z',
                'end_at' => '2026-07-20T11:00:00Z',
                'check_in_form_fields' => [
                    [
                        'label' => 'Meal',
                        'type' => 'poll',
                        'required' => true,
                        'options' => [['label' => 'Chicken']],
                    ],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['check_in_form_fields.0.options']);
    }

    public function test_single_and_multiple_poll_answers_are_validated_and_exported(): void
    {
        $organizer = User::factory()->create([
            'email' => 'organizer@example.com',
            'is_approved' => true,
            'role' => 'user',
        ]);
        $token = $this->issueToken($organizer);

        $event = CalendarEvent::create([
            'title' => 'Poll night',
            'start_at' => '2026-07-20T10:00:00Z',
            'end_at' => '2026-07-20T11:00:00Z',
            'created_by' => $organizer->email,
            'check_in_form_fields' => [
                [
                    'id' => 'meal',
                    'key' => 'meal',
                    'label' => 'Meal',
                    'type' => 'poll',
                    'required' => true,
                    'multiple' => false,
                    'options' => [
                        ['id' => 'chicken', 'label' => 'Chicken'],
                        ['id' => 'fish', 'label' => 'Fish'],
                    ],
                ],
                [
                    'id' => 'topics',
                    'key' => 'topics',
                    'label' => 'Topics',
                    'type' => 'poll',
                    'required' => true,
                    'multiple' => true,
                    'options' => [
                        ['id' => 'hr', 'label' => 'HR'],
                        ['id' => 'it', 'label' => 'IT'],
                        ['id' => 'ops', 'label' => 'Ops'],
                    ],
                ],
            ],
        ]);

        $this->postJson('/api/event-check-in/'.$event->check_in_token, [
            'email' => 'visitor@external.com',
            'answers' => [
                'meal' => 'Pizza',
            ],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['answers.meal']);

        $this->postJson('/api/event-check-in/'.$event->check_in_token, [
            'email' => 'visitor@external.com',
            'answers' => [
                'meal' => 'Chicken',
            ],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['answers.topics']);

        $this->postJson('/api/event-check-in/'.$event->check_in_token, [
            'email' => 'visitor@external.com',
            'answers' => [
                'meal' => 'chicken',
                'topics' => ['HR', 'ops'],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('attendance.form_answers.meal', 'Chicken')
            ->assertJsonPath('attendance.form_answers.topics.0', 'HR')
            ->assertJsonPath('attendance.form_answers.topics.1', 'Ops');

        $csv = $this->withToken($token)
            ->get('/api/calendar-events/'.$event->id.'/attendances/export')
            ->assertOk()
            ->streamedContent();

        $this->assertStringContainsString('Meal,Topics', $csv);
        $this->assertStringContainsString('Chicken', $csv);
        $this->assertStringContainsString('HR, Ops', $csv);
    }
}
