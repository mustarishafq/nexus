<?php

namespace App\Support;

use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use App\Services\ResourceSpecialReleaseClient;
use Carbon\Carbon;

class AttendanceLateEvaluator
{
    /**
     * Late only while still inside the scheduled shift window
     * (start−earlyWindow … end+grace). After the shift ends, a clock-in is
     * outside hours — not a late arrival for that start.
     *
     * @param  bool  $includeSpecialRelease  When false, skip Insan pin lookups (bulk backfill).
     * @return array{
     *     is_late: bool,
     *     late_minutes: int,
     *     scheduled_start: ?string,
     *     shift_name: ?string,
     *     shift_id: ?string,
     *     grace_period_minutes: int,
     *     early_clock_in_window_minutes: int,
     *     early_clock_in_cutoff_minutes: int,
     *     require_late_clock_in_reason: bool,
     *     special_release_shift?: bool
     * }
     */
    public static function evaluate(User $user, Carbon $capturedAt, bool $includeSpecialRelease = true): array
    {
        $earlyWindow = GamificationSettings::earlyClockInWindowMinutes();
        $earlyCutoff = GamificationSettings::earlyClockInCutoffMinutes();

        $result = [
            'is_late' => false,
            'late_minutes' => 0,
            'scheduled_start' => null,
            'shift_name' => null,
            'shift_id' => null,
            'grace_period_minutes' => 0,
            'early_clock_in_window_minutes' => $earlyWindow,
            'early_clock_in_cutoff_minutes' => $earlyCutoff,
            'require_late_clock_in_reason' => false,
        ];

        if (! $user->department_id) {
            return $result;
        }

        $setting = DepartmentAttendanceSetting::query()
            ->where('department_id', $user->department_id)
            ->where('enabled', true)
            ->first();

        if (! $setting) {
            return $result;
        }

        $result['require_late_clock_in_reason'] = (bool) $setting->require_late_clock_in_reason;

        $at = $capturedAt->copy()->timezone($setting->timezone);
        $grace = (int) $setting->grace_period_minutes;
        $result['grace_period_minutes'] = $grace;

        if ($includeSpecialRelease) {
            $today = $at->toDateString();
            $release = app(ResourceSpecialReleaseClient::class)
                ->findApprovedForUserOnDate($user->id, $today);
            $synthetic = $release?->toSyntheticShift();

            if ($synthetic) {
                return self::evaluateAgainstShift($synthetic, $at, $grace, $earlyWindow, $result, specialRelease: true);
            }
        }

        if (empty($setting->shifts)) {
            return $result;
        }

        $shifts = AttendanceShiftResolver::shiftsForUser($user, $setting);
        foreach ($shifts as $shift) {
            if (! self::isWithinShift($shift, $at, $grace, $earlyWindow)) {
                continue;
            }

            return self::evaluateAgainstShift($shift, $at, $grace, $earlyWindow, $result);
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $shift
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private static function evaluateAgainstShift(
        array $shift,
        Carbon $at,
        int $grace,
        int $earlyWindow,
        array $result,
        bool $specialRelease = false,
    ): array {
        if (! self::isWithinShift($shift, $at, $grace, $earlyWindow)) {
            return $result;
        }

        $start = self::parseTimeToMinutes((string) ($shift['start_time'] ?? '09:00'));
        $end = self::parseTimeToMinutes((string) ($shift['end_time'] ?? '17:00'));
        $crosses = (bool) ($shift['crosses_midnight'] ?? false);
        $current = ($at->hour * 60) + $at->minute;
        $endBound = min((24 * 60) - 1, $end + $grace);

        // Overnight morning leg is still the previous calendar day's start.
        $onMorningLeg = $crosses && $current <= $endBound;
        $scheduled = $at->copy()->startOfDay()->addMinutes($start);
        if ($onMorningLeg) {
            $scheduled->subDay();
        }

        $deadline = $scheduled->copy()->addMinutes($grace);
        $result['scheduled_start'] = $scheduled->toIso8601String();
        $result['shift_name'] = $shift['name'] ?? null;
        $result['shift_id'] = isset($shift['id']) ? (string) $shift['id'] : null;
        if ($specialRelease) {
            $result['special_release_shift'] = true;
        }

        if ($at->gt($deadline)) {
            $result['is_late'] = true;
            $result['late_minutes'] = (int) $deadline->diffInMinutes($at);
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $shift
     */
    private static function isWithinShift(
        array $shift,
        Carbon $at,
        int $graceMinutes,
        int $earlyWindowMinutes,
    ): bool {
        $days = $shift['days_of_week'] ?? [];

        if ($days === []) {
            return true;
        }

        $isoDay = (int) $at->isoWeekday();
        $start = self::parseTimeToMinutes((string) ($shift['start_time'] ?? '00:00'));
        $end = self::parseTimeToMinutes((string) ($shift['end_time'] ?? '23:59'));
        $current = ($at->hour * 60) + $at->minute;
        $crosses = (bool) ($shift['crosses_midnight'] ?? false);

        if ($crosses) {
            $startBound = max(0, $start - $earlyWindowMinutes);
            $endBound = min((24 * 60) - 1, $end + $graceMinutes);

            if ($current >= $startBound && in_array($isoDay, $days, true)) {
                return true;
            }

            $previousDay = $isoDay === 1 ? 7 : $isoDay - 1;

            return $current <= $endBound && in_array($previousDay, $days, true);
        }

        if (! in_array($isoDay, $days, true)) {
            return false;
        }

        $startBound = max(0, $start - $earlyWindowMinutes);
        $endBound = min((24 * 60) - 1, $end + $graceMinutes);

        return $current >= $startBound && $current <= $endBound;
    }

    private static function parseTimeToMinutes(string $time): int
    {
        [$h, $m] = array_map('intval', explode(':', $time) + [0, 0]);

        return ($h * 60) + $m;
    }
}
