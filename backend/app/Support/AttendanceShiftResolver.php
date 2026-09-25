<?php

namespace App\Support;

use App\Models\AttendanceLocation;
use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use App\Services\ResourceSpecialReleaseClient;
use Carbon\Carbon;
use Illuminate\Support\Str;

class AttendanceShiftResolver
{
    /**
     * @return list<array<string, mixed>>
     */
    public static function shiftsForUser(User $user, ?DepartmentAttendanceSetting $setting = null): array
    {
        $setting = $setting ?? self::settingForUser($user);
        if (! $setting) {
            return [];
        }

        $shifts = self::normalizeList($setting->shifts ?? []);
        if ($shifts === []) {
            return [];
        }

        $assignedIds = $user->assignedAttendanceShiftIds();
        if ($assignedIds === []) {
            return $shifts;
        }

        $assignedLookup = array_fill_keys($assignedIds, true);
        $matched = array_values(array_filter(
            $shifts,
            fn (array $shift) => isset($assignedLookup[(string) ($shift['id'] ?? '')]),
        ));

        return $matched !== [] ? $matched : $shifts;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function resolveShiftForClockIn(
        User $user,
        Carbon $at,
        ?DepartmentAttendanceSetting $setting = null,
        ?SpecialReleasePin $activeRelease = null,
    ): ?array {
        $setting = $setting ?? self::settingForUser($user);
        if (! $setting) {
            return null;
        }

        $override = self::specialReleaseShiftForMoment($user, $at, $setting, $activeRelease);
        if ($override) {
            return $override;
        }

        $shifts = self::shiftsForUser($user, $setting);
        if ($shifts === []) {
            return null;
        }

        $grace = (int) ($setting->grace_period_minutes ?? 0);
        $earlyWindow = GamificationSettings::earlyClockInWindowMinutes();

        return self::selectArrivalShift($shifts, $at, $grace, $earlyWindow);
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function resolveShiftForMoment(
        User $user,
        Carbon $at,
        ?DepartmentAttendanceSetting $setting = null,
        ?SpecialReleasePin $activeRelease = null,
    ): ?array {
        return self::resolveShiftForClockIn($user, $at, $setting, $activeRelease);
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function specialReleaseShiftForMoment(
        User $user,
        Carbon $at,
        ?DepartmentAttendanceSetting $setting = null,
        ?SpecialReleasePin $activeRelease = null,
    ): ?array {
        $setting = $setting ?? self::settingForUser($user);
        if (! $setting) {
            return null;
        }

        $release = $activeRelease;
        if (! $release) {
            $date = $at->copy()->timezone($setting->timezone ?: config('app.timezone'))->toDateString();
            $release = app(ResourceSpecialReleaseClient::class)
                ->findApprovedForUserOnDate($user->id, $date);
        }

        return $release?->toSyntheticShift();
    }

    public static function locationForShift(
        ?array $shift,
        ?DepartmentAttendanceSetting $setting,
        ?User $user = null,
    ): ?AttendanceLocation {
        if (! $setting) {
            return null;
        }

        $shiftId = isset($shift['id']) ? (string) $shift['id'] : '';
        $userLocationId = $user?->locationIdForAttendanceShift($shiftId !== '' ? $shiftId : null);
        if ($userLocationId !== null) {
            return self::findLocation($userLocationId, $setting);
        }

        $shiftLocationId = self::toNullableInt($shift['attendance_location_id'] ?? null);
        if ($shiftLocationId !== null) {
            return self::findLocation($shiftLocationId, $setting);
        }

        if ($setting->relationLoaded('attendanceLocation')) {
            return $setting->attendanceLocation;
        }

        return $setting->attendanceLocation()->first();
    }

    private static function findLocation(int $locationId, DepartmentAttendanceSetting $setting): ?AttendanceLocation
    {
        if ($setting->relationLoaded('attendanceLocation')
            && $setting->attendanceLocation
            && (int) $setting->attendanceLocation->id === $locationId
        ) {
            return $setting->attendanceLocation;
        }

        return AttendanceLocation::query()->find($locationId);
    }

    /**
     * Pick the shift this punch is arriving for.
     * When several windows overlap, keep a shift that has not passed start + grace
     * so an earlier shift does not mark an on-time arrival for a later shift as late.
     *
     * @param  list<array<string, mixed>>  $shifts
     * @return array<string, mixed>|null
     */
    public static function selectArrivalShift(array $shifts, Carbon $at, int $grace, int $earlyWindow): ?array
    {
        if ($shifts === []) {
            return null;
        }

        if (count($shifts) === 1) {
            return $shifts[0];
        }

        $within = [];
        foreach ($shifts as $shift) {
            if (AttendancePolicyValidator::isWithinShift($shift, $at, $grace, $earlyWindow)) {
                $within[] = $shift;
            }
        }

        if ($within === []) {
            return self::nearestDayMatchingShift($shifts, $at) ?? $shifts[0];
        }

        $onTime = array_values(array_filter(
            $within,
            fn (array $shift) => ! self::punchIsAfterGrace($shift, $at, $grace),
        ));

        if ($onTime === []) {
            return $within[0];
        }

        usort($onTime, function (array $a, array $b): int {
            return self::parseTimeToMinutes((string) ($a['start_time'] ?? '09:00'))
                <=> self::parseTimeToMinutes((string) ($b['start_time'] ?? '09:00'));
        });

        return $onTime[0];
    }

    /**
     * @param  array<string, mixed>  $shift
     */
    private static function punchIsAfterGrace(array $shift, Carbon $at, int $grace): bool
    {
        $start = self::parseTimeToMinutes((string) ($shift['start_time'] ?? '09:00'));
        $end = self::parseTimeToMinutes((string) ($shift['end_time'] ?? '18:00'));
        $crosses = (bool) ($shift['crosses_midnight'] ?? false);
        $current = ($at->hour * 60) + $at->minute;
        $endBound = min((24 * 60) - 1, $end + max(0, $grace));
        $scheduled = $at->copy()->startOfDay()->addMinutes($start);
        if ($crosses && $current <= $endBound) {
            $scheduled->subDay();
        }

        return $at->gt($scheduled->addMinutes(max(0, $grace)));
    }

    /**
     * @param  list<array<string, mixed>>  $shifts
     * @return array<string, mixed>|null
     */
    public static function nearestDayMatchingShift(array $shifts, Carbon $at): ?array
    {
        $isoDay = (int) $at->isoWeekday();
        $current = ($at->hour * 60) + $at->minute;
        $best = null;
        $bestDistance = null;

        foreach ($shifts as $shift) {
            $days = $shift['days_of_week'] ?? [];
            $crosses = (bool) ($shift['crosses_midnight'] ?? false);
            $start = self::parseTimeToMinutes((string) ($shift['start_time'] ?? '09:00'));

            if ($crosses) {
                $previousDay = $isoDay === 1 ? 7 : $isoDay - 1;
                $end = self::parseTimeToMinutes((string) ($shift['end_time'] ?? '04:00'));
                if (($days === [] || in_array($previousDay, $days, true)) && $current <= $end) {
                    $distance = 0;
                } elseif ($days !== [] && ! in_array($isoDay, $days, true)) {
                    continue;
                } else {
                    $distance = abs($current - $start);
                }
            } else {
                if ($days !== [] && ! in_array($isoDay, $days, true)) {
                    continue;
                }
                $distance = abs($current - $start);
            }

            if ($bestDistance === null || $distance < $bestDistance || ($distance === $bestDistance && $start < self::parseTimeToMinutes((string) ($best['start_time'] ?? '09:00')))) {
                $best = $shift;
                $bestDistance = $distance;
            }
        }

        return $best;
    }

    /**
     * @param  mixed  $shifts
     * @return list<array<string, mixed>>
     */
    public static function ensureShiftIds(mixed $shifts): array
    {
        $list = self::normalizeList($shifts);
        $out = [];

        foreach ($list as $shift) {
            $id = trim((string) ($shift['id'] ?? ''));
            if ($id === '' || strlen($id) > 64) {
                $id = (string) Str::uuid();
            }
            $shift['id'] = $id;
            $out[] = $shift;
        }

        return $out;
    }

    public static function settingForUser(User $user): ?DepartmentAttendanceSetting
    {
        if (! $user->department_id) {
            return null;
        }

        return DepartmentAttendanceSetting::query()
            ->with('attendanceLocation')
            ->where('department_id', $user->department_id)
            ->where('enabled', true)
            ->first();
    }

    /**
     * @param  mixed  $shifts
     * @return list<array<string, mixed>>
     */
    private static function normalizeList(mixed $shifts): array
    {
        if (! is_array($shifts)) {
            return [];
        }

        $out = [];
        foreach ($shifts as $shift) {
            if (is_array($shift)) {
                $out[] = $shift;
            }
        }

        return $out;
    }

    private static function parseTimeToMinutes(string $time): int
    {
        [$h, $m] = array_map('intval', explode(':', $time) + [0, 0]);

        return ($h * 60) + $m;
    }

    private static function toNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }
}
