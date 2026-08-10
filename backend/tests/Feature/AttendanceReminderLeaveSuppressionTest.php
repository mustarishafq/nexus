<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Department;
use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AttendanceReminderLeaveSuppressionTest extends TestCase
{
    use RefreshDatabase;

    private string $apiKey = 'resource-test-api-key-32chars-min!!';

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeUserWithShift(): User
    {
        $department = Department::query()->create(['name' => 'Ops']);

        DepartmentAttendanceSetting::query()->create([
            'department_id' => $department->id,
            'enabled' => true,
            'timezone' => 'Asia/Kuala_Lumpur',
            'grace_period_minutes' => 0,
            'require_early_clock_out_reason' => false,
            'require_late_clock_in_reason' => false,
            'allow_outside_shift_hours' => true,
            'overtime_enabled' => false,
            'standard_hours_per_day' => 8,
            'overtime_threshold_minutes' => 0,
            'shifts' => [[
                'name' => 'Day Shift',
                'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
                'start_time' => '09:00',
                'end_time' => '18:00',
                'crosses_midnight' => false,
            ]],
        ]);

        return User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'department_id' => $department->id,
            'email' => 'leave-reminder@example.com',
        ]);
    }

    private function createInsanApplication(): Application
    {
        return Application::factory()->create([
            'name' => 'EMZI Nexus Insan',
            'slug' => 'emzi-nexus-insan',
            'base_url' => 'http://resource.test',
            'api_key' => $this->apiKey,
            'auth_mode' => 'jwt',
            'is_enabled' => true,
        ]);
    }

    public function test_status_suppresses_clock_in_reminder_when_on_leave(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-28 09:23:00', 'Asia/Kuala_Lumpur'));

        $user = $this->makeUserWithShift();
        $this->createInsanApplication();

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['time_offs.covering', 'attendance.ingest'],
                'endpoints' => [
                    'time_offs_covering' => '/api/nexus/v1/time-offs/covering',
                ],
            ], 200),
            'http://resource.test/api/nexus/v1/time-offs/covering*' => Http::response([
                'date' => '2026-07-28',
                'on_leave' => [[
                    'nexus_user_id' => (string) $user->id,
                    'type' => 'annual',
                    'date' => '2026-07-28',
                    'end_date' => null,
                ]],
            ], 200),
        ]);

        $token = ApiTokenAuth::issueToken($user);
        $response = $this->withToken($token)->getJson('/api/attendance/status');

        $response->assertOk()
            ->assertJsonPath('reminder', null);
    }

    public function test_status_returns_clock_in_reminder_when_not_on_leave(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-28 09:23:00', 'Asia/Kuala_Lumpur'));

        $user = $this->makeUserWithShift();
        $this->createInsanApplication();

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['time_offs.covering', 'attendance.ingest'],
                'endpoints' => [
                    'time_offs_covering' => '/api/nexus/v1/time-offs/covering',
                ],
            ], 200),
            'http://resource.test/api/nexus/v1/time-offs/covering*' => Http::response([
                'date' => '2026-07-28',
                'on_leave' => [],
            ], 200),
        ]);

        $token = ApiTokenAuth::issueToken($user);
        $response = $this->withToken($token)->getJson('/api/attendance/status');

        $response->assertOk()
            ->assertJsonPath('reminder.type', 'clock_in');
    }

    public function test_status_still_returns_reminder_when_insan_not_linked(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-28 09:23:00', 'Asia/Kuala_Lumpur'));

        $user = $this->makeUserWithShift();

        Http::fake();

        $token = ApiTokenAuth::issueToken($user);
        $response = $this->withToken($token)->getJson('/api/attendance/status');

        $response->assertOk()
            ->assertJsonPath('reminder.type', 'clock_in');

        Http::assertNothingSent();
    }

    public function test_status_fails_open_when_insan_leave_lookup_errors(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-28 09:23:00', 'Asia/Kuala_Lumpur'));

        $user = $this->makeUserWithShift();
        $this->createInsanApplication();

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['time_offs.covering'],
                'endpoints' => [
                    'time_offs_covering' => '/api/nexus/v1/time-offs/covering',
                ],
            ], 200),
            'http://resource.test/api/nexus/v1/time-offs/covering*' => Http::response('error', 500),
        ]);

        $token = ApiTokenAuth::issueToken($user);
        $response = $this->withToken($token)->getJson('/api/attendance/status');

        $response->assertOk()
            ->assertJsonPath('reminder.type', 'clock_in');
    }

    public function test_reminder_uses_special_release_overwrite_shift_instead_of_department_shift(): void
    {
        // Department Night Shift started at 18:00; overwrite is 22:00–06:00.
        Carbon::setTestNow(Carbon::parse('2026-08-10 21:56:00', 'Asia/Kuala_Lumpur'));

        $department = Department::query()->create(['name' => 'Ops Night']);
        DepartmentAttendanceSetting::query()->create([
            'department_id' => $department->id,
            'enabled' => true,
            'timezone' => 'Asia/Kuala_Lumpur',
            'grace_period_minutes' => 0,
            'require_early_clock_out_reason' => false,
            'require_late_clock_in_reason' => false,
            'allow_outside_shift_hours' => true,
            'overtime_enabled' => false,
            'standard_hours_per_day' => 8,
            'overtime_threshold_minutes' => 0,
            'shifts' => [[
                'name' => 'Night Shift',
                'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
                'start_time' => '18:00',
                'end_time' => '06:00',
                'crosses_midnight' => true,
            ]],
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'department_id' => $department->id,
            'email' => 'overwrite-reminder@example.com',
        ]);

        $this->createInsanApplication();

        Http::fake([
            'http://resource.test/.well-known/nexus-integration.json' => Http::response([
                'name' => 'EMZI Nexus Insan',
                'capabilities' => ['time_offs.covering', 'special_releases.covering'],
                'endpoints' => [
                    'time_offs_covering' => '/api/nexus/v1/time-offs/covering',
                    'special_releases_covering' => '/api/nexus/v1/special-releases/covering',
                ],
            ], 200),
            'http://resource.test/api/nexus/v1/time-offs/covering*' => Http::response([
                'date' => '2026-08-10',
                'on_leave' => [],
            ], 200),
            'http://resource.test/api/nexus/v1/special-releases/covering*' => Http::response([
                'date' => '2026-08-10',
                'releases' => [[
                    'nexus_user_id' => (string) $user->id,
                    'id' => 77,
                    'type' => 'wfh',
                    'date' => '2026-08-10',
                    'end_date' => null,
                    'center_latitude' => 3.139,
                    'center_longitude' => 101.6869,
                    'radius_meters' => 100,
                    'overwrite_shift' => true,
                    'shift_start_time' => '22:00',
                    'shift_end_time' => '06:00',
                    'shift_crosses_midnight' => true,
                ]],
            ], 200),
        ]);

        $token = ApiTokenAuth::issueToken($user);

        // Before overwrite start — should not nag about department Night Shift.
        $this->withToken($token)->getJson('/api/attendance/status')
            ->assertOk()
            ->assertJsonPath('reminder', null);

        Carbon::setTestNow(Carbon::parse('2026-08-10 22:20:00', 'Asia/Kuala_Lumpur'));

        $this->withToken($token)->getJson('/api/attendance/status')
            ->assertOk()
            ->assertJsonPath('reminder.type', 'clock_in')
            ->assertJsonPath('reminder.shift_name', 'Special release (WFH)')
            ->assertJsonPath('reminder.special_release_shift', true)
            ->assertJsonPath('reminder.minutes_late', 20);
    }
}
