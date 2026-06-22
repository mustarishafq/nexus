<?php

namespace App\Support;

use App\Models\AttendanceRecord;
use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use Carbon\Carbon;

class AttendancePolicyValidator
{
    public static function resolveForUser(User $user): ?DepartmentAttendanceSetting
    {
        if (! $user->department_id) {
            return null;
        }

        return DepartmentAttendanceSetting::query()
            ->where('department_id', $user->department_id)
            ->where('enabled', true)
            ->first();
    }

    /**
     * @return array{
     *   valid: bool,
     *   errors: array<int, string>,
     *   warnings: array<int, string>,
     *   metadata: array<string, mixed>
     * }
     */
    public static function validateClock(
        User $user,
        string $type,
        ?float $latitude,
        ?float $longitude,
        Carbon $capturedAt,
        ?AttendanceRecord $lastRecord = null,
    ): array {
        $setting = self::resolveForUser($user);

        if (! $setting) {
            return [
                'valid' => true,
                'errors' => [],
                'warnings' => [],
                'metadata' => [],
            ];
        }

        $errors = [];
        $warnings = [];
        $metadata = [
            'department_id' => $setting->department_id,
        ];

        self::validateGeofence($setting, $latitude, $longitude, $errors, $warnings, $metadata);
        self::validateShiftHours($setting, $capturedAt, $errors, $warnings, $metadata);

        if ($type === 'clock_out' && $setting->overtime_enabled && $lastRecord?->type === 'clock_in') {
            $metadata = array_merge(
                $metadata,
                self::calculateOvertime($lastRecord->captured_at, $capturedAt, $setting),
            );
        }

        return [
            'valid' => $errors === [],
            'errors' => $errors,
            'warnings' => $warnings,
            'metadata' => $metadata,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function policySummaryForUser(User $user): ?array
    {
        $setting = self::resolveForUser($user);

        if (! $setting) {
            return null;
        }

        $user->loadMissing('department');

        return [
            'department_id' => $setting->department_id,
            'department_name' => $user->department?->name,
            'geofence_enabled' => $setting->geofence_enabled,
            'center_latitude' => $setting->center_latitude !== null ? (float) $setting->center_latitude : null,
            'center_longitude' => $setting->center_longitude !== null ? (float) $setting->center_longitude : null,
            'sites' => DepartmentAttendanceSettings::normalizeSites($setting->sites ?? []),
            'radius_meters' => $setting->radius_meters,
            'allow_outside_radius' => $setting->allow_outside_radius,
            'timezone' => $setting->timezone,
            'grace_period_minutes' => $setting->grace_period_minutes,
            'allow_outside_shift_hours' => $setting->allow_outside_shift_hours,
            'overtime_enabled' => $setting->overtime_enabled,
            'standard_hours_per_day' => (float) $setting->standard_hours_per_day,
            'shifts' => $setting->shifts ?? [],
        ];
    }

    public static function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000;
        $latFrom = deg2rad($lat1);
        $latTo = deg2rad($lat2);
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $a = sin($latDelta / 2) ** 2
            + cos($latFrom) * cos($latTo) * sin($lngDelta / 2) ** 2;

        return 2 * $earthRadius * asin(min(1, sqrt($a)));
    }

    /**
     * @param  array<int, array<string, mixed>>  $shifts
     * @return array<string, mixed>|null
     */
    public static function findActiveShift(array $shifts, Carbon $at, int $graceMinutes): ?array
    {
        foreach ($shifts as $shift) {
            if (self::isWithinShift($shift, $at, $graceMinutes)) {
                return $shift;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $errors
     * @param  array<string, mixed>  $warnings
     * @param  array<string, mixed>  $metadata
     */
    private static function validateGeofence(
        DepartmentAttendanceSetting $setting,
        ?float $latitude,
        ?float $longitude,
        array &$errors,
        array &$warnings,
        array &$metadata,
    ): void {
        if (! $setting->geofence_enabled) {
            return;
        }

        if ($latitude === null || $longitude === null) {
            if (! $setting->allow_outside_radius) {
                $errors[] = 'Location is required for attendance in your department.';
            } else {
                $warnings[] = 'Location unavailable; recorded without geofence verification.';
                $metadata['outside_radius'] = true;
            }

            return;
        }

        $sites = self::resolveSites($setting);

        if ($sites === []) {
            return;
        }

        $closestDistance = null;
        $closestSite = null;
        $matchedSite = null;

        foreach ($sites as $site) {
            $distance = self::haversineMeters(
                (float) $site['latitude'],
                (float) $site['longitude'],
                $latitude,
                $longitude,
            );

            if ($closestDistance === null || $distance < $closestDistance) {
                $closestDistance = $distance;
                $closestSite = $site;
            }

            if ($distance <= $setting->radius_meters) {
                $matchedSite = $site;
                $metadata['distance_meters'] = round($distance, 1);
                break;
            }
        }

        if ($matchedSite) {
            $metadata['matched_site_name'] = $matchedSite['name'];

            return;
        }

        $metadata['distance_meters'] = round((float) $closestDistance, 1);
        $metadata['nearest_site_name'] = $closestSite['name'] ?? null;

        if (! $setting->allow_outside_radius) {
            $errors[] = sprintf(
                'You must be within %dm of a registered site (nearest: %s, ~%dm away).',
                $setting->radius_meters,
                $closestSite['name'] ?? 'assigned location',
                (int) round((float) $closestDistance),
            );
        } else {
            $warnings[] = sprintf(
                'Recorded outside allowed radius (nearest site: %s, ~%dm away).',
                $closestSite['name'] ?? 'assigned location',
                (int) round((float) $closestDistance),
            );
            $metadata['outside_radius'] = true;
        }
    }

    /**
     * @return array<int, array{name: string, latitude: float, longitude: float}>
     */
    private static function resolveSites(DepartmentAttendanceSetting $setting): array
    {
        $sites = DepartmentAttendanceSettings::normalizeSites($setting->sites ?? []);

        if ($sites !== []) {
            return $sites;
        }

        if ($setting->center_latitude === null || $setting->center_longitude === null) {
            return [];
        }

        return [[
            'name' => 'Primary location',
            'latitude' => (float) $setting->center_latitude,
            'longitude' => (float) $setting->center_longitude,
        ]];
    }

    /**
     * @param  array<string, mixed>  $errors
     * @param  array<string, mixed>  $warnings
     * @param  array<string, mixed>  $metadata
     */
    private static function validateShiftHours(
        DepartmentAttendanceSetting $setting,
        Carbon $capturedAt,
        array &$errors,
        array &$warnings,
        array &$metadata,
    ): void {
        $shifts = $setting->shifts ?? [];

        if ($shifts === []) {
            return;
        }

        $at = $capturedAt->copy()->timezone($setting->timezone);
        $activeShift = self::findActiveShift($shifts, $at, $setting->grace_period_minutes);

        if ($activeShift) {
            $metadata['shift_name'] = $activeShift['name'];

            return;
        }

        if (! $setting->allow_outside_shift_hours) {
            $errors[] = 'Clock in/out is not allowed outside your department shift hours.';
        } else {
            $warnings[] = 'Recorded outside scheduled shift hours.';
            $metadata['outside_shift_hours'] = true;
        }
    }

    /**
     * @param  array<string, mixed>  $shift
     */
    private static function isWithinShift(array $shift, Carbon $at, int $graceMinutes): bool
    {
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
            $startBound = max(0, $start - $graceMinutes);
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

        $startBound = max(0, $start - $graceMinutes);
        $endBound = min((24 * 60) - 1, $end + $graceMinutes);

        return $current >= $startBound && $current <= $endBound;
    }

    /**
     * @return array<string, int|bool>
     */
    private static function calculateOvertime(Carbon $clockIn, Carbon $clockOut, DepartmentAttendanceSetting $setting): array
    {
        $workedMinutes = $clockIn->diffInMinutes($clockOut);
        $standardMinutes = (int) round((float) $setting->standard_hours_per_day * 60);
        $overtimeMinutes = max(0, $workedMinutes - $standardMinutes - $setting->overtime_threshold_minutes);

        return [
            'worked_minutes' => $workedMinutes,
            'standard_minutes' => $standardMinutes,
            'overtime_minutes' => $overtimeMinutes,
            'is_overtime' => $overtimeMinutes > 0,
        ];
    }

    private static function parseTimeToMinutes(string $time): int
    {
        [$hour, $minute] = array_map('intval', explode(':', strlen($time) === 5 ? $time : substr($time, 0, 5)));

        return ($hour * 60) + $minute;
    }
}
