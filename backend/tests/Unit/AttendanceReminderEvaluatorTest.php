<?php

namespace Tests\Unit;

use App\Models\AttendanceRecord;
use App\Models\DepartmentAttendanceSetting;
use App\Support\AttendanceReminderEvaluator;
use App\Support\AttendanceShiftSchedule;
use Carbon\Carbon;
use ReflectionMethod;
use Tests\TestCase;

class AttendanceReminderEvaluatorTest extends TestCase
{
    public function test_overnight_window_day_uses_previous_day_after_midnight(): void
    {
        $shift = [
            'name' => 'Shift 2',
            'start_time' => '22:00',
            'end_time' => '18:00',
            'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
            'crosses_midnight' => true,
        ];

        $day = AttendanceShiftSchedule::windowDayForInstant(
            $shift,
            Carbon::parse('2026-07-25 10:00', 'Asia/Kuala_Lumpur'),
            'Asia/Kuala_Lumpur',
            15,
        );

        $this->assertSame('2026-07-24', $day->toDateString());
    }

    public function test_overnight_window_day_uses_same_day_before_midnight(): void
    {
        $shift = [
            'name' => 'Shift 2',
            'start_time' => '22:00',
            'end_time' => '18:00',
            'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
            'crosses_midnight' => true,
        ];

        $day = AttendanceShiftSchedule::windowDayForInstant(
            $shift,
            Carbon::parse('2026-07-24 22:30', 'Asia/Kuala_Lumpur'),
            'Asia/Kuala_Lumpur',
            15,
        );

        $this->assertSame('2026-07-24', $day->toDateString());
    }

    public function test_clock_out_reminder_triggers_for_overnight_clock_in_after_midnight(): void
    {
        $setting = $this->setting();
        $result = $this->evaluateClockOut(
            $setting,
            Carbon::parse('2026-07-25 10:00', $setting->timezone),
            Carbon::parse('2026-07-25 18:20', $setting->timezone),
        );

        $this->assertNotNull($result);
        $this->assertSame('clock_out', $result['type']);
        $this->assertSame('Shift 2', $result['shift_name']);
        $this->assertStringContainsString('6:00 PM', $result['message']);
        $this->assertStringContainsString('20 min ago', $result['message']);
    }

    public function test_clock_out_reminder_triggers_for_day_shift(): void
    {
        $setting = $this->setting();
        $result = $this->evaluateClockOut(
            $setting,
            Carbon::parse('2026-07-24 09:15', $setting->timezone),
            Carbon::parse('2026-07-24 18:20', $setting->timezone),
        );

        $this->assertNotNull($result);
        $this->assertSame('Day Shift', $result['shift_name']);
    }

    public function test_clock_out_reminder_waits_for_grace_after_shift_end(): void
    {
        $setting = $this->setting();
        $result = $this->evaluateClockOut(
            $setting,
            Carbon::parse('2026-07-25 10:00', $setting->timezone),
            Carbon::parse('2026-07-25 18:10', $setting->timezone),
        );

        $this->assertNull($result);
    }

    public function test_clock_out_reminder_stops_after_max_window(): void
    {
        $setting = $this->setting();
        $result = $this->evaluateClockOut(
            $setting,
            Carbon::parse('2026-07-25 10:00', $setting->timezone),
            Carbon::parse('2026-07-25 22:20', $setting->timezone),
        );

        $this->assertNull($result);
    }

    private function setting(): DepartmentAttendanceSetting
    {
        $setting = new DepartmentAttendanceSetting([
            'enabled' => true,
            'timezone' => 'Asia/Kuala_Lumpur',
            'grace_period_minutes' => 15,
            'shifts' => [
                [
                    'name' => 'Day Shift',
                    'start_time' => '09:00',
                    'end_time' => '18:00',
                    'days_of_week' => [1, 2, 3, 4, 5],
                    'crosses_midnight' => false,
                ],
                [
                    'name' => 'Shift 2',
                    'start_time' => '22:00',
                    'end_time' => '18:00',
                    'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
                    'crosses_midnight' => true,
                ],
            ],
        ]);

        return $setting;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function evaluateClockOut(
        DepartmentAttendanceSetting $setting,
        Carbon $clockInAt,
        Carbon $now,
    ): ?array {
        $record = new AttendanceRecord(['type' => 'clock_in']);
        $record->captured_at = $clockInAt;

        $method = new ReflectionMethod(AttendanceReminderEvaluator::class, 'evaluateClockOutReminder');
        $method->setAccessible(true);

        $shifts = array_values(array_filter(
            is_array($setting->shifts) ? $setting->shifts : [],
            static fn ($shift) => is_array($shift),
        ));

        return $method->invoke(null, $setting, $record, $now, $shifts);
    }
}
