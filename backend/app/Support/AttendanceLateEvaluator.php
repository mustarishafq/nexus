<?php

namespace App\Support;

use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use Carbon\Carbon;

class AttendanceLateEvaluator
{
    /**
     * @return array{
     *     is_late: bool,
     *     late_minutes: int,
     *     scheduled_start: ?string,
     *     shift_name: ?string,
     *     grace_period_minutes: int,
     *     require_late_clock_in_reason: bool
     * }
     */
    public static function evaluate(User $user, Carbon $capturedAt): array
    {
        $result = [
            'is_late' => false,
            'late_minutes' => 0,
            'scheduled_start' => null,
            'shift_name' => null,
            'grace_period_minutes' => 0,
            'require_late_clock_in_reason' => false,
        ];

        if (! $user->department_id) {
            return $result;
        }

        $setting = DepartmentAttendanceSetting::query()
            ->where('department_id', $user->department_id)
            ->where('enabled', true)
            ->first();

        if (! $setting || empty($setting->shifts)) {
            return $result;
        }

        $result['require_late_clock_in_reason'] = (bool) $setting->require_late_clock_in_reason;

        $at = $capturedAt->copy()->timezone($setting->timezone);
        $isoDay = (int) $at->isoWeekday();
        $grace = (int) $setting->grace_period_minutes;
        $result['grace_period_minutes'] = $grace;

        foreach ($setting->shifts as $shift) {
            $days = $shift['days_of_week'] ?? [];
            if ($days !== [] && ! in_array($isoDay, $days, true)) {
                continue;
            }

            $start = self::parseTimeToMinutes((string) ($shift['start_time'] ?? '09:00'));
            $scheduled = $at->copy()->startOfDay()->addMinutes($start);
            $deadline = $scheduled->copy()->addMinutes($grace);
            $result['scheduled_start'] = $scheduled->toIso8601String();
            $result['shift_name'] = $shift['name'] ?? null;

            if ($at->gt($deadline)) {
                $result['is_late'] = true;
                $result['late_minutes'] = (int) $deadline->diffInMinutes($at);
            }

            break;
        }

        return $result;
    }

    private static function parseTimeToMinutes(string $time): int
    {
        [$h, $m] = array_map('intval', explode(':', $time) + [0, 0]);

        return ($h * 60) + $m;
    }
}
