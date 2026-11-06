<?php

namespace Tests\Feature;

use App\Models\CalendarEvent;
use App\Models\CalendarEventAttendance;
use App\Models\Department;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventAttendanceHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('e', 40).str_pad((string) $user->id, 40, '0');
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    private function makeEvent(string $title, string $startAt): CalendarEvent
    {
        return CalendarEvent::create([
            'title' => $title,
            'location' => 'Main hall',
            'start_at' => $startAt,
            'end_at' => $startAt,
        ]);
    }

    private function checkIn(CalendarEvent $event, string $email, ?int $userId, string $at, string $source = CalendarEventAttendance::SOURCE_IN_APP): CalendarEventAttendance
    {
        return CalendarEventAttendance::create([
            'calendar_event_id' => $event->id,
            'email' => $email,
            'user_id' => $userId,
            'display_name' => null,
            'source' => $source,
            'checked_in_at' => $at,
        ]);
    }

    private function userWithRole(string $role, array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'is_approved' => true,
            'role' => $role,
        ], $attributes));
    }

    private function userWithOnlyPermission(string $permissionKey): User
    {
        $role = Role::create([
            'slug' => 'custom-'.str_replace('.', '-', $permissionKey),
            'name' => 'Custom '.$permissionKey,
            'is_active' => true,
        ]);
        $role->permissions()->sync(Permission::query()->where('key', $permissionKey)->pluck('id'));

        return User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'role_id' => $role->id,
        ]);
    }

    public function test_my_history_requires_authentication(): void
    {
        $this->getJson('/api/event-attendance/my-history')->assertUnauthorized();
    }

    public function test_my_history_returns_own_check_ins_including_email_matches(): void
    {
        $me = $this->userWithRole('user', ['email' => 'me@example.com']);
        $other = $this->userWithRole('user', ['email' => 'other@example.com']);

        $townHall = $this->makeEvent('Town hall', '2026-10-01T10:00:00Z');
        $training = $this->makeEvent('Safety training', '2026-10-05T10:00:00Z');
        $party = $this->makeEvent('Year end party', '2026-10-10T10:00:00Z');

        $this->checkIn($townHall, 'me@example.com', $me->id, '2026-10-01T10:05:00Z');
        // Public form check-in before the account was linked, different casing.
        $this->checkIn($training, 'ME@Example.com', null, '2026-10-05T10:02:00Z', CalendarEventAttendance::SOURCE_PUBLIC_FORM);
        $this->checkIn($party, 'other@example.com', $other->id, '2026-10-10T10:01:00Z');

        $response = $this->withToken($this->issueToken($me))
            ->getJson('/api/event-attendance/my-history')
            ->assertOk()
            ->assertJsonPath('total', 2);

        $titles = collect($response->json('records'))->pluck('event.title')->all();
        $this->assertSame(['Safety training', 'Town hall'], $titles);
        $this->assertSame('Main hall', $response->json('records.0.event.location'));
    }

    public function test_my_history_filters_by_date_and_search(): void
    {
        $me = $this->userWithRole('user', ['email' => 'me@example.com']);
        $a = $this->makeEvent('Town hall', '2026-10-01T10:00:00Z');
        $b = $this->makeEvent('Safety training', '2026-10-20T10:00:00Z');
        $this->checkIn($a, 'me@example.com', $me->id, '2026-10-01T10:05:00Z');
        $this->checkIn($b, 'me@example.com', $me->id, '2026-10-20T10:05:00Z');

        $token = $this->issueToken($me);

        $this->withToken($token)
            ->getJson('/api/event-attendance/my-history?date_from=2026-10-10')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('records.0.event.title', 'Safety training');

        $this->withToken($token)
            ->getJson('/api/event-attendance/my-history?search=town')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('records.0.event.title', 'Town hall');
    }

    public function test_report_is_forbidden_without_permission(): void
    {
        $user = $this->userWithRole('user');

        $this->withToken($this->issueToken($user))
            ->getJson('/api/event-attendance/report')
            ->assertForbidden();

        $this->withToken($this->issueToken($user))
            ->get('/api/event-attendance/export')
            ->assertForbidden();
    }

    public function test_report_allowed_with_attendance_view_all_or_calendar_manage(): void
    {
        $viewer = $this->userWithOnlyPermission(PermissionCatalog::ATTENDANCE_VIEW_ALL);
        $this->withToken($this->issueToken($viewer))
            ->getJson('/api/event-attendance/report')
            ->assertOk();

        $calendarManager = $this->userWithOnlyPermission(PermissionCatalog::CALENDAR_MANAGE);
        $this->withToken($this->issueToken($calendarManager))
            ->getJson('/api/event-attendance/report')
            ->assertOk();

        $hr = $this->userWithRole('hr');
        $this->withToken($this->issueToken($hr))
            ->getJson('/api/event-attendance/report')
            ->assertOk();
    }

    public function test_report_filters_by_user_department_and_type_with_summary(): void
    {
        $hr = $this->userWithRole('hr');
        $sales = Department::create(['name' => 'Sales']);
        $alice = $this->userWithRole('user', ['email' => 'alice@example.com', 'department_id' => $sales->id]);
        $bob = $this->userWithRole('user', ['email' => 'bob@example.com']);

        $e1 = $this->makeEvent('Town hall', '2026-10-01T10:00:00Z');
        $e2 = $this->makeEvent('Training', '2026-10-02T10:00:00Z');

        $this->checkIn($e1, 'alice@example.com', $alice->id, '2026-10-01T10:00:00Z');
        $this->checkIn($e2, 'alice@example.com', null, '2026-10-02T10:00:00Z', CalendarEventAttendance::SOURCE_PUBLIC_FORM);
        $this->checkIn($e1, 'bob@example.com', $bob->id, '2026-10-01T10:01:00Z');
        $this->checkIn($e1, 'guest@outside.com', null, '2026-10-01T10:02:00Z', CalendarEventAttendance::SOURCE_PUBLIC_FORM);

        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->getJson('/api/event-attendance/report?date_from=2026-09-01&date_to=2026-10-31')
            ->assertOk()
            ->assertJsonPath('summary.total', 4)
            ->assertJsonPath('summary.unique_events', 2)
            ->assertJsonPath('summary.unique_attendees', 3)
            ->assertJsonPath('summary.staff', 2)
            ->assertJsonPath('summary.public', 2);

        $this->withToken($token)
            ->getJson('/api/event-attendance/report?user_id='.$alice->id)
            ->assertOk()
            ->assertJsonPath('summary.total', 2)
            ->assertJsonCount(2, 'records');

        $this->withToken($token)
            ->getJson('/api/event-attendance/report?department_id='.$sales->id)
            ->assertOk()
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('records.0.user.department', 'Sales');

        $this->withToken($token)
            ->getJson('/api/event-attendance/report?type=public')
            ->assertOk()
            ->assertJsonPath('summary.total', 2);
    }

    public function test_export_streams_csv(): void
    {
        $hr = $this->userWithRole('hr');
        $alice = $this->userWithRole('user', ['email' => 'alice@example.com', 'full_name' => 'Alice Tan']);
        $event = $this->makeEvent('Town hall', '2026-10-01T10:00:00Z');
        $this->checkIn($event, 'alice@example.com', $alice->id, '2026-10-01T10:00:00Z');

        $response = $this->withToken($this->issueToken($hr))
            ->get('/api/event-attendance/export?user_id='.$alice->id)
            ->assertOk();

        $csv = $response->streamedContent();
        $this->assertStringContainsString('Name,Email,Type,Department,Event,"Event start",Location,Source,"Checked in at"', $csv);
        $this->assertStringContainsString('"Alice Tan",alice@example.com,Staff', $csv);
        $this->assertStringContainsString('"Town hall"', $csv);
    }
}

