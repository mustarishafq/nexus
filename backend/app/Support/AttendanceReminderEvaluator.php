<?php

namespace App\Support;

use App\Models\AttendanceRecord;
use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class AttendanceReminderEvaluator
{
    public const REMIND_AFTER_START_MINUTES = 0;

    public const REMIND_AFTER_END_MINUTES = 0;

    public const MAX_CLOCK_OUT_REMINDER_HOURS = 4;

    /**
     * @param  Collection<int, AttendanceRecord>  $todayRecords
     * @return array<string, mixed>|null
     */
    public static function evaluate(
        User $user,
        ?AttendanceRecord $lastRecord,
        Collection $todayRecords,
        ?Carbon $now = null,
        ?DepartmentAttendanceSetting $setting = null,
    ): ?array {
        $setting = $setting ?? AttendancePolicyValidator::resolveForUser($user);

        if (! $setting) {
            return null;
        }

        $shifts = $setting->shifts ?? [];

        if ($shifts === []) {
            return null;
        }

        $now = ($now ?? now())->copy()->timezone($setting->timezone);
        $nextType = self::resolveNextType($lastRecord);

        if ($nextType === 'clock_in') {
            return self::evaluateClockInReminder($setting, $todayRecords, $now);
        }

        return self::evaluateClockOutReminder($setting, $lastRecord, $now);
    }

    /**
     * @param  Collection<int, AttendanceRecord>  $todayRecords
     * @return array<string, mixed>|null
     */
    private static function evaluateClockInReminder(
        DepartmentAttendanceSetting $setting,
        Collection $todayRecords,
        Carbon $now,
    ): ?array {
        $shifts = $setting->shifts ?? [];

        foreach ($shifts as $shift) {
            if (! self::shiftAppliesNow($shift, $now, $setting)) {
                continue;
            }

            [$start, $end] = AttendanceShiftSchedule::windowForDay(
                $shift,
                self::shiftWindowDay($shift, $now, $setting->timezone),
                $setting->timezone,
            );
            $remindAfter = $start->copy()->subMinutes($setting->grace_period_minutes);

            if ($now->lt($remindAfter) || $now->gte($end)) {
                continue;
            }

            if (! self::needsClockInReminder($todayRecords, $start, $end, $setting->timezone)) {
                continue;
            }

            $minutesLate = (int) max(0, $start->diffInMinutes($now));

            return [
                'type' => 'clock_in',
                'title' => 'Clock in reminder',
                'message' => $minutesLate > 0
                    ? sprintf(
                        '%s started at %s (%d min ago). Please clock in.',
                        $shift['name'],
                        $start->format('g:i A'),
                        $minutesLate,
                    )
                    : sprintf(
                        '%s has started. Please clock in now.',
                        $shift['name'],
                    ),
                'shift_name' => $shift['name'],
                'shift_start' => $start->toISOString(),
                'shift_end' => $end->toISOString(),
                'minutes_late' => $minutesLate,
                'urgency' => $minutesLate >= 30 ? 'high' : 'medium',
                'action_url' => '/attendance',
            ];
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $shift
     */
    private static function shiftWindowDay(array $shift, Carbon $now, string $timezone): Carbon
    {
        if (AttendanceShiftSchedule::appliesOnDay($shift, $now)) {
            return $now;
        }

        return $now->copy()->subDay();
    }

    /**
     * A shift applies if it is scheduled for today, or is an overnight shift still in progress.
     *
     * @param  array<string, mixed>  $shift
     */
    private static function shiftAppliesNow(array $shift, Carbon $now, DepartmentAttendanceSetting $setting): bool
    {
        if (AttendanceShiftSchedule::appliesOnDay($shift, $now)) {
            return true;
        }

        if (! (bool) ($shift['crosses_midnight'] ?? false)) {
            return false;
        }

        $yesterday = $now->copy()->subDay();

        if (! AttendanceShiftSchedule::appliesOnDay($shift, $yesterday)) {
            return false;
        }

        [$start, $end] = AttendanceShiftSchedule::windowForDay($shift, $yesterday, $setting->timezone);

        return $now->gte($start) && $now->lt($end);
    }

    /**
     * @param  Collection<int, AttendanceRecord>  $todayRecords
     */
    private static function needsClockInReminder(
        Collection $todayRecords,
        Carbon $start,
        Carbon $end,
        string $timezone,
    ): bool {
        $clockInsInWindow = $todayRecords
            ->filter(function (AttendanceRecord $record) use ($start, $end, $timezone) {
                if ($record->type !== 'clock_in') {
                    return false;
                }

                $capturedAt = $record->captured_at?->copy()->timezone($timezone);

                return $capturedAt && $capturedAt->between($start, $end, true);
            })
            ->sortByDesc('captured_at')
            ->values();

        if ($clockInsInWindow->isEmpty()) {
            return true;
        }

        $lastRecord = $todayRecords->sortByDesc('captured_at')->first();

        if ($lastRecord?->type === 'clock_out') {
            return ! $clockInsInWindow->contains(
                fn (AttendanceRecord $record) => $record->captured_at?->gt($lastRecord->captured_at)
            );
        }

        return false;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function evaluateClockOutReminder(
        DepartmentAttendanceSetting $setting,
        ?AttendanceRecord $lastRecord,
        Carbon $now,
    ): ?array {
        if (! $lastRecord || $lastRecord->type !== 'clock_in') {
            return null;
        }

        $clockInAt = $lastRecord->captured_at?->copy()->timezone($setting->timezone);

        if (! $clockInAt) {
            return null;
        }

        $shift = AttendancePolicyValidator::findActiveShift(
            $setting->shifts ?? [],
            $clockInAt,
            $setting->grace_period_minutes,
        );

        if (! $shift) {
            $shift = self::findShiftEndingNow($setting->shifts ?? [], $now, $setting->timezone);
        }

        if (! $shift) {
            return null;
        }

        [$start, $end] = AttendanceShiftSchedule::windowForDay($shift, $clockInAt, $setting->timezone);
        $remindAfter = $end->copy()->addMinutes(self::REMIND_AFTER_END_MINUTES + $setting->grace_period_minutes);

        if ($now->lt($remindAfter)) {
            return null;
        }

        if ($now->diffInHours($remindAfter) > self::MAX_CLOCK_OUT_REMINDER_HOURS) {
            return null;
        }

        $minutesLate = (int) max(0, $end->diffInMinutes($now));

        return [
            'type' => 'clock_out',
            'title' => 'Clock out reminder',
            'message' => sprintf(
                '%s ended at %s (%d min ago). Please clock out.',
                $shift['name'],
                $end->format('g:i A'),
                $minutesLate,
            ),
            'shift_name' => $shift['name'],
            'shift_start' => $start->toISOString(),
            'shift_end' => $end->toISOString(),
            'minutes_late' => $minutesLate,
            'urgency' => $minutesLate >= 30 ? 'high' : 'medium',
            'action_url' => '/attendance',
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $shifts
     * @return array<string, mixed>|null
     */
    private static function findShiftEndingNow(array $shifts, Carbon $now, string $timezone): ?array
    {
        foreach (AttendanceShiftSchedule::shiftsForDay($shifts, $now) as $shift) {
            [$start, $end] = AttendanceShiftSchedule::windowForDay($shift, $now, $timezone);

            if ($now->gte($start) && $now->lte($end->copy()->addHours(self::MAX_CLOCK_OUT_REMINDER_HOURS))) {
                return $shift;
            }
        }

        $yesterday = $now->copy()->subDay();

        foreach (AttendanceShiftSchedule::shiftsForDay($shifts, $yesterday) as $shift) {
            if (! (bool) ($shift['crosses_midnight'] ?? false)) {
                continue;
            }

            [$start, $end] = AttendanceShiftSchedule::windowForDay($shift, $yesterday, $timezone);

            if ($now->gte($start) && $now->lte($end->copy()->addHours(self::MAX_CLOCK_OUT_REMINDER_HOURS))) {
                return $shift;
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function scheduleHintForUser(
        User $user,
        ?Carbon $now = null,
        ?DepartmentAttendanceSetting $setting = null,
    ): ?array {
        $setting = $setting ?? AttendancePolicyValidator::resolveForUser($user);

        if (! $setting) {
            return null;
        }

        $shifts = $setting->shifts ?? [];

        if ($shifts === []) {
            return [
                'has_shift_today' => false,
                'message' => 'No shifts configured for your department.',
            ];
        }

        $now = ($now ?? now())->copy()->timezone($setting->timezone);
        $shiftsToday = array_values(array_filter(
            $shifts,
            static fn (array $shift) => self::shiftAppliesNow($shift, $now, $setting),
        ));

        if ($shiftsToday === []) {
            return [
                'has_shift_today' => false,
                'message' => 'No shift scheduled for today. Reminders only appear on configured working days.',
            ];
        }

        $activeShift = AttendancePolicyValidator::findActiveShift(
            $shifts,
            $now,
            $setting->grace_period_minutes,
        );

        if ($activeShift) {
            return [
                'has_shift_today' => true,
                'active_shift' => $activeShift['name'],
                'message' => sprintf('Current shift: %s (%s–%s)', $activeShift['name'], $activeShift['start_time'], $activeShift['end_time']),
            ];
        }

        $nextShift = $shiftsToday[0];

        return [
            'has_shift_today' => true,
            'active_shift' => null,
            'message' => sprintf(
                'Next shift today: %s at %s',
                $nextShift['name'],
                $nextShift['start_time'],
            ),
        ];
    }

    private static function resolveNextType(?AttendanceRecord $lastRecord): string
    {
        if (! $lastRecord || $lastRecord->type === 'clock_out') {
            return 'clock_in';
        }

        return 'clock_out';
    }
}
