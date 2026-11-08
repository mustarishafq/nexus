<?php

namespace App\Support;

use App\Models\AttendanceRecord;
use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use Carbon\Carbon;

class AttendanceEarlyClockOutEvaluator
{
    /**
     * Early clock-out if leaving before the resolved shift end of the active clock-in.
     * If closing an open clock-in from a previous shift whose scheduled_end has already
     * passed (e.g. forgot to clock out yesterday), is_early_leave is false.
     *
     * @return array{
     *     is_early_leave: bool,
     *     early_leave_minutes: int,
     *     scheduled_end: ?string,
     *     shift_name: ?string,
     *     shift_id: ?string,
     *     require_early_clock_out_reason: bool,
     *     special_release_shift?: bool
     * }
     */
    public static function evaluate(
        User $user,
        Carbon $capturedAt,
        ?AttendanceRecord $lastRecord = null,
        bool $includeSpecialRelease = true,
    ): array {
        $result = [
            'is_early_leave' => false,
            'early_leave_minutes' => 0,
            'scheduled_end' => null,
            'shift_name' => null,
            'shift_id' => null,
            'require_early_clock_out_reason' => false,
        ];

        if (! $user->department_id) {
            return $result;
        }

        $setting = AttendanceClockRulesSettings::applyTo(
            DepartmentAttendanceSetting::query()
                ->where('department_id', $user->department_id)
                ->where('enabled', true)
                ->first()
        );

        if (! $setting) {
            return $result;
        }

        $result['require_early_clock_out_reason'] = (bool) $setting->require_early_clock_out_reason;

        $at = $capturedAt->copy()->timezone($setting->timezone);
        $lastInAt = ($lastRecord && $lastRecord->type === 'clock_in' && $lastRecord->captured_at)
            ? $lastRecord->captured_at->copy()->timezone($setting->timezone)
            : null;
        $referenceMoment = ($lastInAt && $lastInAt->lte($at)) ? $lastInAt : $at;
        $grace = (int) $setting->grace_period_minutes;

        if ($includeSpecialRelease) {
            $shift = AttendanceShiftResolver::resolveShiftForMoment($user, $referenceMoment, $setting);
        } else {
            $shifts = AttendanceShiftResolver::shiftsForUser($user, $setting);
            $earlyWindow = GamificationSettings::earlyClockInWindowMinutes();
            $shift = $shifts !== []
                ? AttendanceShiftResolver::selectArrivalShift($shifts, $referenceMoment, $grace, $earlyWindow)
                : null;
        }

        if ($shift === null) {
            return $result;
        }

        return self::evaluateAgainstShift(
            $shift,
            $at,
            $lastInAt,
            $grace,
            $result,
            specialRelease: ! empty($shift['special_release_id']),
        );
    }

    /**
     * @param  array<string, mixed>  $shift
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private static function evaluateAgainstShift(
        array $shift,
        Carbon $at,
        ?Carbon $lastInAt,
        int $grace,
        array $result,
        bool $specialRelease = false,
    ): array {
        $start = self::parseTimeToMinutes((string) ($shift['start_time'] ?? '09:00'));
        $end = self::parseTimeToMinutes((string) ($shift['end_time'] ?? '17:00'));
        $crosses = (bool) ($shift['crosses_midnight'] ?? false) || $end <= $start;
        $endBound = min((24 * 60) - 1, $end + max(0, $grace));

        $anchor = ($lastInAt && $lastInAt->lte($at)) ? $lastInAt : $at;
        $anchorMinutes = ($anchor->hour * 60) + $anchor->minute;

        if ($crosses) {
            $onMorningLeg = $anchorMinutes <= $endBound;
            $scheduledEnd = $onMorningLeg
                ? $anchor->copy()->startOfDay()->addMinutes($end)
                : $anchor->copy()->startOfDay()->addDay()->addMinutes($end);
        } else {
            $scheduledEnd = $anchor->copy()->startOfDay()->addMinutes($end);
        }

        $result['scheduled_end'] = $scheduledEnd->toIso8601String();
        $result['shift_name'] = $shift['name'] ?? null;
        $result['shift_id'] = isset($shift['id']) ? (string) $shift['id'] : null;
        if ($specialRelease) {
            $result['special_release_shift'] = true;
        }

        $atMinute = $at->copy()->startOfMinute();
        if ($atMinute->lt($scheduledEnd)) {
            $earlyMinutes = (int) round($atMinute->diffInMinutes($scheduledEnd));
            if ($earlyMinutes >= 1) {
                $result['is_early_leave'] = true;
                $result['early_leave_minutes'] = $earlyMinutes;
            }
        } elseif ($lastInAt && $lastInAt->toDateString() !== $at->toDateString()) {
            $result['closing_previous_shift'] = true;
        }

        return $result;
    }

    private static function parseTimeToMinutes(string $time): int
    {
        [$h, $m] = array_map('intval', explode(':', $time) + [0, 0]);

        return ($h * 60) + $m;
    }
}
