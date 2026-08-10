<?php

namespace App\Support;

use App\Models\AttendanceLocation;

class AttendanceLocationSettings
{
    /** @var array<string, mixed> */
    public const DEFAULTS = [
        'name' => 'New location',
        'owner_user_id' => null,
        'geofence_enabled' => false,
        'center_latitude' => null,
        'center_longitude' => null,
        'sites' => [],
        'radius_meters' => 200,
        'allow_outside_radius' => false,
        'allow_clock_out_outside_radius' => false,
    ];

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public static function normalizeConfig(array $input): array
    {
        $config = self::DEFAULTS;

        $config['name'] = trim((string) ($input['name'] ?? self::DEFAULTS['name']));
        if ($config['name'] === '') {
            $config['name'] = self::DEFAULTS['name'];
        }

        $config['owner_user_id'] = self::toNullableInt($input['owner_user_id'] ?? null);
        $config['geofence_enabled'] = self::toBool($input['geofence_enabled'] ?? false);
        $config['center_latitude'] = self::toNullableFloat($input['center_latitude'] ?? null);
        $config['center_longitude'] = self::toNullableFloat($input['center_longitude'] ?? null);
        $config['sites'] = DepartmentAttendanceSettings::normalizeSites($input['sites'] ?? []);
        $config['radius_meters'] = max(10, min(50000, (int) ($input['radius_meters'] ?? 200)));
        $config['allow_outside_radius'] = self::toBool($input['allow_outside_radius'] ?? false);
        // Fall back to clock-in flag when peers/older clients omit the clock-out setting.
        $config['allow_clock_out_outside_radius'] = array_key_exists('allow_clock_out_outside_radius', $input)
            ? self::toBool($input['allow_clock_out_outside_radius'])
            : $config['allow_outside_radius'];

        if ($config['sites'] === [] && $config['center_latitude'] !== null && $config['center_longitude'] !== null) {
            $config['sites'] = [[
                'name' => 'Primary location',
                'latitude' => $config['center_latitude'],
                'longitude' => $config['center_longitude'],
            ]];
        }

        if ($config['sites'] !== []) {
            $primary = $config['sites'][0];
            $config['center_latitude'] = $primary['latitude'];
            $config['center_longitude'] = $primary['longitude'];
        }

        if ($config['geofence_enabled'] && $config['sites'] === []) {
            $config['geofence_enabled'] = false;
        }

        return $config;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public static function validationRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'owner_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'geofence_enabled' => ['nullable', 'boolean'],
            'center_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'center_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'sites' => ['nullable', 'array'],
            'sites.*.name' => ['required_with:sites', 'string', 'max:120'],
            'sites.*.latitude' => ['required_with:sites', 'numeric', 'between:-90,90'],
            'sites.*.longitude' => ['required_with:sites', 'numeric', 'between:-180,180'],
            'radius_meters' => ['nullable', 'integer', 'min:10', 'max:50000'],
            'allow_outside_radius' => ['nullable', 'boolean'],
            'allow_clock_out_outside_radius' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public static function toDatabaseColumns(array $config): array
    {
        return [
            'owner_user_id' => $config['owner_user_id'] ?? null,
            'name' => $config['name'],
            'geofence_enabled' => $config['geofence_enabled'],
            'center_latitude' => $config['center_latitude'],
            'center_longitude' => $config['center_longitude'],
            'sites' => $config['sites'],
            'radius_meters' => $config['radius_meters'],
            'allow_outside_radius' => $config['allow_outside_radius'],
            'allow_clock_out_outside_radius' => $config['allow_clock_out_outside_radius'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function serializeForApi(AttendanceLocation $location): array
    {
        return [
            'id' => $location->id,
            'owner_user_id' => $location->owner_user_id !== null ? (int) $location->owner_user_id : null,
            'name' => $location->name,
            'geofence_enabled' => $location->geofence_enabled,
            'center_latitude' => $location->center_latitude !== null ? (float) $location->center_latitude : null,
            'center_longitude' => $location->center_longitude !== null ? (float) $location->center_longitude : null,
            'sites' => DepartmentAttendanceSettings::normalizeSites($location->sites ?? []),
            'radius_meters' => $location->radius_meters,
            'allow_outside_radius' => $location->allow_outside_radius,
            'allow_clock_out_outside_radius' => $location->allow_clock_out_outside_radius,
            'department_count' => $location->department_settings_count ?? $location->departmentSettings()->count(),
        ];
    }

    /**
     * @return array<int, array{name: string, latitude: float, longitude: float}>
     */
    public static function resolveSites(?AttendanceLocation $location): array
    {
        if (! $location) {
            return [];
        }

        $sites = DepartmentAttendanceSettings::normalizeSites($location->sites ?? []);

        if ($sites !== []) {
            return $sites;
        }

        if ($location->center_latitude === null || $location->center_longitude === null) {
            return [];
        }

        return [[
            'name' => 'Primary location',
            'latitude' => (float) $location->center_latitude,
            'longitude' => (float) $location->center_longitude,
        ]];
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
