<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceLateClockInReasonTest extends TestCase
{
    use RefreshDatabase;

    private function makeUserWithShift(bool $requireReason): User
    {
        $department = Department::query()->create(['name' => 'Ops']);

        DepartmentAttendanceSetting::query()->create([
            'department_id' => $department->id,
            'enabled' => true,
            'timezone' => 'Asia/Kuala_Lumpur',
            'grace_period_minutes' => 15,
            'require_early_clock_out_reason' => false,
            'require_late_clock_in_reason' => $requireReason,
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
            'email' => 'late-user@example.com',
        ]);
    }

    private function clockIn(User $user, Carbon $capturedAt, ?string $reason = null)
    {
        $payload = [
            'type' => 'clock_in',
            'photo_url' => 'https://example.com/in.jpg',
            'captured_at' => $capturedAt->toIso8601String(),
            'timezone' => 'Asia/Kuala_Lumpur',
        ];

        if ($reason !== null) {
            $payload['late_clock_in_reason'] = $reason;
        }

        $token = ApiTokenAuth::issueToken($user);

        return $this->withToken($token)->postJson('/api/attendance/clock', $payload);
    }

    public function test_late_clock_in_without_reason_rejected_when_required(): void
    {
        $user = $this->makeUserWithShift(requireReason: true);
        $inAt = Carbon::parse('2026-07-29 09:30:00', 'Asia/Kuala_Lumpur');

        $response = $this->clockIn($user, $inAt);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'A late clock-in reason is required when arriving after your shift start.');
    }

    public function test_late_clock_in_with_reason_succeeds_when_required(): void
    {
        $user = $this->makeUserWithShift(requireReason: true);
        $inAt = Carbon::parse('2026-07-29 09:30:00', 'Asia/Kuala_Lumpur');

        $response = $this->clockIn($user, $inAt, 'Traffic jam');

        $response->assertCreated()
            ->assertJsonPath('metadata.policy.is_late', true)
            ->assertJsonPath('metadata.policy.late_clock_in_reason', 'Traffic jam');

        $this->assertGreaterThan(0, (int) $response->json('metadata.policy.late_minutes'));
    }

    public function test_late_clock_in_without_reason_allowed_when_setting_off(): void
    {
        $user = $this->makeUserWithShift(requireReason: false);
        $inAt = Carbon::parse('2026-07-29 09:30:00', 'Asia/Kuala_Lumpur');

        $response = $this->clockIn($user, $inAt);

        $response->assertCreated()
            ->assertJsonPath('metadata.policy.is_late', true);

        $this->assertArrayNotHasKey('late_clock_in_reason', $response->json('metadata.policy') ?? []);
    }

    public function test_on_time_clock_in_does_not_require_reason(): void
    {
        $user = $this->makeUserWithShift(requireReason: true);
        $inAt = Carbon::parse('2026-07-29 09:10:00', 'Asia/Kuala_Lumpur');

        $response = $this->clockIn($user, $inAt);

        $response->assertCreated()
            ->assertJsonPath('metadata.policy.is_late', false);
    }
}
