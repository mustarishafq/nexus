<?php

namespace App\Support;

use App\Models\DepartmentAttendanceSetting;

class DepartmentAttendanceSettings
{
    /** @var array<string, mixed> */
    public const DEFAULTS = [
        'enabled' => true,
        'attendance_location_id' => null,
        'timezone' => null,
        'grace_period_minutes' => 15,
        'allow_outside_shift_hours' => false,
        'overtime_enabled' => true,
        'standard_hours_per_day' => 8.0,
        'overtime_threshold_minutes' => 0,
        'shifts' => [],
    ];

    /** @var array<int, string> */
    public const WEEKDAYS = [
        1 => 'Monday',
        2 => 'Tuesday',
        3 => 'Wednesday',
        4 => 'Thursday',
        5 => 'Friday',
        6 => 'Saturday',
        7 => 'Sunday',
    ];

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public static function normalizeConfig(array $input): array
    {
        $config = self::DEFAULTS;

        $config['enabled'] = self::toBool($input['enabled'] ?? true);
        $config['attendance_location_id'] = self::toNullableInt($input['attendance_location_id'] ?? null);
        $config['timezone'] = self::normalizeTimezone($input['timezone'] ?? null);
        $config['grace_period_minutes'] = max(0, min(180, (int) ($input['grace_period_minutes'] ?? 15)));
        $config['allow_outside_shift_hours'] = self::toBool($input['allow_outside_shift_hours'] ?? false);
        $config['overtime_enabled'] = self::toBool($input['overtime_enabled'] ?? true);
        $config['standard_hours_per_day'] = max(0.5, min(24, (float) ($input['standard_hours_per_day'] ?? 8)));
        $config['overtime_threshold_minutes'] = max(0, min(480, (int) ($input['overtime_threshold_minutes'] ?? 0)));
        $config['shifts'] = self::normalizeShifts($input['shifts'] ?? []);

        return $config;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public static function validationRules(): array
    {
        return [
            'enabled' => ['nullable', 'boolean'],
            'attendance_location_id' => ['nullable', 'integer', 'exists:attendance_locations,id'],
            'timezone' => ['nullable', 'timezone:all'],
            'grace_period_minutes' => ['nullable', 'integer', 'min:0', 'max:180'],
            'allow_outside_shift_hours' => ['nullable', 'boolean'],
            'overtime_enabled' => ['nullable', 'boolean'],
            'standard_hours_per_day' => ['nullable', 'numeric', 'min:0.5', 'max:24'],
            'overtime_threshold_minutes' => ['nullable', 'integer', 'min:0', 'max:480'],
            'shifts' => ['nullable', 'array'],
            'shifts.*.name' => ['required_with:shifts', 'string', 'max:64'],
            'shifts.*.days_of_week' => ['required_with:shifts', 'array'],
            'shifts.*.days_of_week.*' => ['integer', 'between:1,7'],
            'shifts.*.start_time' => ['required_with:shifts', 'date_format:H:i'],
            'shifts.*.end_time' => ['required_with:shifts', 'date_format:H:i'],
            'shifts.*.crosses_midnight' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public static function toDatabaseColumns(array $config): array
    {
        return [
            'enabled' => $config['enabled'],
            'attendance_location_id' => $config['attendance_location_id'],
            'timezone' => $config['timezone'],
            'grace_period_minutes' => $config['grace_period_minutes'],
            'allow_outside_shift_hours' => $config['allow_outside_shift_hours'],
            'overtime_enabled' => $config['overtime_enabled'],
            'standard_hours_per_day' => $config['standard_hours_per_day'],
            'overtime_threshold_minutes' => $config['overtime_threshold_minutes'],
            'shifts' => $config['shifts'],
        ];
    }

    /**
     * @param  mixed  $shifts
     * @return array<int, array<string, mixed>>
     */
    public static function normalizeShifts($shifts): array
    {
        if (! is_array($shifts)) {
            return [];
        }

        $normalized = [];

        foreach ($shifts as $shift) {
            if (! is_array($shift)) {
                continue;
            }

            $name = trim((string) ($shift['name'] ?? ''));
            $start = self::normalizeTime((string) ($shift['start_time'] ?? ''));
            $end = self::normalizeTime((string) ($shift['end_time'] ?? ''));

            if ($name === '' || $start === null || $end === null) {
                continue;
            }

            $days = array_values(array_unique(array_map('intval', $shift['days_of_week'] ?? [])));
            $days = array_values(array_filter($days, fn (int $day) => $day >= 1 && $day <= 7));

            $normalized[] = [
                'name' => $name,
                'days_of_week' => $days,
                'start_time' => $start,
                'end_time' => $end,
                'crosses_midnight' => (bool) ($shift['crosses_midnight'] ?? false),
            ];
        }

        return $normalized;
    }

    /**
     * @param  mixed  $sites
     * @return array<int, array{name: string, latitude: float, longitude: float}>
     */
    public static function normalizeSites($sites): array
    {
        if (! is_array($sites)) {
            return [];
        }

        $normalized = [];

        foreach ($sites as $site) {
            if (! is_array($site)) {
                continue;
            }

            $name = trim((string) ($site['name'] ?? ''));
            $latitude = self::toNullableFloat($site['latitude'] ?? null);
            $longitude = self::toNullableFloat($site['longitude'] ?? null);

            if ($name === '' || $latitude === null || $longitude === null) {
                continue;
            }

            $normalized[] = [
                'name' => $name,
                'latitude' => $latitude,
                'longitude' => $longitude,
            ];
        }

        return $normalized;
    }

    /**
     * @return array<string, mixed>
     */
    public static function serializeForApi(DepartmentAttendanceSetting $setting): array
    {
        $location = $setting->relationLoaded('attendanceLocation')
            ? $setting->attendanceLocation
            : null;

        $payload = [
            'department_id' => $setting->department_id,
            'enabled' => $setting->enabled,
            'attendance_location_id' => $setting->attendance_location_id,
            'timezone' => $setting->timezone,
            'grace_period_minutes' => $setting->grace_period_minutes,
            'allow_outside_shift_hours' => $setting->allow_outside_shift_hours,
            'overtime_enabled' => $setting->overtime_enabled,
            'standard_hours_per_day' => (float) $setting->standard_hours_per_day,
            'overtime_threshold_minutes' => $setting->overtime_threshold_minutes,
            'shifts' => $setting->shifts ?? [],
        ];

        if ($location) {
            $payload['attendance_location'] = AttendanceLocationSettings::serializeForApi($location);
            $payload['geofence_enabled'] = $location->geofence_enabled;
            $payload['center_latitude'] = $location->center_latitude !== null ? (float) $location->center_latitude : null;
            $payload['center_longitude'] = $location->center_longitude !== null ? (float) $location->center_longitude : null;
            $payload['sites'] = AttendanceLocationSettings::resolveSites($location);
            $payload['radius_meters'] = $location->radius_meters;
            $payload['allow_outside_radius'] = $location->allow_outside_radius;
        } else {
            $payload['attendance_location'] = null;
            $payload['geofence_enabled'] = false;
            $payload['center_latitude'] = null;
            $payload['center_longitude'] = null;
            $payload['sites'] = [];
            $payload['radius_meters'] = AttendanceLocationSettings::DEFAULTS['radius_meters'];
            $payload['allow_outside_radius'] = false;
        }

        return $payload;
    }

    private static function normalizeTime(string $time): ?string
    {
        $time = trim($time);

        if ($time === '') {
            return null;
        }

        if (preg_match('/^\d{2}:\d{2}$/', $time)) {
            return $time;
        }

        if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $time)) {
            return substr($time, 0, 5);
        }

        return null;
    }

    private static function normalizeTimezone(?string $timezone): string
    {
        if (filled($timezone) && in_array($timezone, timezone_identifiers_list(), true)) {
            return $timezone;
        }

        return (string) config('app.timezone');
    }

    private static function toBool(mixed $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    private static function toNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }

    private static function toNullableFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (float) $value;
    }
}
