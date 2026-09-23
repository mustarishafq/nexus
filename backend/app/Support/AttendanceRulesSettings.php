<?php

namespace App\Support;

use App\Models\AttendanceLocation;
use App\Models\DepartmentAttendanceSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AttendanceRulesSettings
{
    /**
     * @return array<string, mixed>
     */
    public static function current(): array
    {
        $stored = self::readStored();
        if (is_array($stored) && $stored !== []) {
            $config = DepartmentAttendanceSettings::normalizeConfig($stored + ['shifts' => []]);
            $config['shifts'] = [];

            return array_merge($config, self::extraFrom($stored));
        }

        $first = DepartmentAttendanceSetting::query()->orderBy('id')->first();
        if ($first) {
            $config = DepartmentAttendanceSettings::normalizeConfig(
                DepartmentAttendanceSettings::serializeForApi($first)
            );
            $config['shifts'] = [];

            return array_merge($config, self::extraFrom($stored ?? []));
        }

        $config = DepartmentAttendanceSettings::normalizeConfig([]);
        $config['shifts'] = [];

        return $config;
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public static function store(array $input): array
    {
        $config = DepartmentAttendanceSettings::normalizeConfig($input + [
            'shifts' => is_array($input['shifts'] ?? null) ? $input['shifts'] : [],
        ]);
        $config['shifts'] = [];
        $extra = self::extraFrom($input);
        $payload = array_merge(DepartmentAttendanceSettings::toRuleColumns($config), $extra);

        self::writeStored($payload);
        self::syncToAllDepartmentRows($config);

        return array_merge($config, $extra);
    }

    /**
     * @param  array<string, mixed>|null  $config
     */
    public static function syncToAllDepartmentRows(?array $config = null): void
    {
        $columns = DepartmentAttendanceSettings::toRuleColumns($config ?? self::current());

        DepartmentAttendanceSetting::query()->update($columns);
    }

    public static function applyTo(DepartmentAttendanceSetting $setting): DepartmentAttendanceSetting
    {
        $rules = self::current();
        foreach (DepartmentAttendanceSettings::toRuleColumns($rules) as $key => $value) {
            $setting->{$key} = $value;
        }

        if ($setting->attendance_location_id) {
            if (! $setting->relationLoaded('attendanceLocation')
                || (int) $setting->attendanceLocation?->id !== (int) $setting->attendance_location_id) {
                $setting->setRelation(
                    'attendanceLocation',
                    AttendanceLocation::query()->find($setting->attendance_location_id)
                );
            }
        } else {
            $setting->setRelation('attendanceLocation', null);
        }

        return $setting;
    }

    public static function applyToNullable(?DepartmentAttendanceSetting $setting, ?int $departmentId = null): ?DepartmentAttendanceSetting
    {
        $rules = self::current();
        if (! ($rules['enabled'] ?? true)) {
            return null;
        }

        if (! $setting) {
            if (! $departmentId) {
                return null;
            }
            $setting = new DepartmentAttendanceSetting([
                'department_id' => $departmentId,
                'shifts' => [],
            ]);
        }

        return self::applyTo($setting);
    }

    /**
     * @param  array<int, mixed>  $shifts
     */
    public static function persistDepartmentShifts(int $departmentId, array $shifts): DepartmentAttendanceSetting
    {
        $config = DepartmentAttendanceSettings::normalizeConfig(array_merge(self::current(), [
            'shifts' => $shifts,
        ]));

        $setting = DepartmentAttendanceSetting::query()->updateOrCreate(
            ['department_id' => $departmentId],
            DepartmentAttendanceSettings::toDatabaseColumns($config),
        );

        $setting->load('attendanceLocation');

        return $setting;
    }

    /**
     * @return array<string, mixed>
     */
    public static function serializeDepartment(?DepartmentAttendanceSetting $setting, ?int $departmentId = null): array
    {
        $model = $setting ?? new DepartmentAttendanceSetting([
            'department_id' => $departmentId,
            'shifts' => [],
        ]);

        self::applyTo($model);

        return DepartmentAttendanceSettings::serializeForApi($model);
    }

    /**
     * @return array<string, mixed>
     */
    public static function serializeForSnapshot(): array
    {
        $rules = self::current();
        $locationId = $rules['attendance_location_id'] ?? null;
        $location = $locationId
            ? AttendanceLocation::query()->find($locationId)
            : null;

        unset($rules['shifts']);
        $rules['location_name'] = $location?->name;
        unset($rules['attendance_location_id']);

        return $rules;
    }

    /**
     * @return array<string, mixed>
     */
    public static function serializeForApi(): array
    {
        $current = self::current();
        $setting = new DepartmentAttendanceSetting($current);
        if ($setting->attendance_location_id) {
            $setting->setRelation(
                'attendanceLocation',
                AttendanceLocation::query()->find($setting->attendance_location_id)
            );
        }

        $payload = DepartmentAttendanceSettings::serializeForApi($setting);
        unset($payload['department_id'], $payload['shifts']);

        return array_merge($payload, self::extraFrom($current));
    }

    /**
     * @return array<string, array<int, string>>
     */
    public static function validationRules(): array
    {
        $rules = DepartmentAttendanceSettings::validationRules();
        unset(
            $rules['shifts'],
            $rules['shifts.*.id'],
            $rules['shifts.*.name'],
            $rules['shifts.*.days_of_week'],
            $rules['shifts.*.days_of_week.*'],
            $rules['shifts.*.start_time'],
            $rules['shifts.*.end_time'],
            $rules['shifts.*.crosses_midnight'],
            $rules['shifts.*.unpaid_break_minutes'],
            $rules['shifts.*.attendance_location_id'],
        );

        foreach (DepartmentAttendanceSettings::EXTRA_RULE_KEYS as $key) {
            $rules[$key] = ['nullable', 'boolean'];
        }

        return $rules;
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private static function extraFrom(array $input): array
    {
        $extra = [];
        foreach (DepartmentAttendanceSettings::EXTRA_RULE_KEYS as $key) {
            if (array_key_exists($key, $input)) {
                $extra[$key] = filter_var($input[$key], FILTER_VALIDATE_BOOLEAN);
            }
        }

        return $extra;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function readStored(): ?array
    {
        if (! Schema::hasTable('app_settings') || ! Schema::hasColumn('app_settings', 'attendance_rules')) {
            return null;
        }

        $row = AppSettings::row();
        $value = $row->attendance_rules ?? null;
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);

            return is_array($decoded) ? $decoded : null;
        }

        return is_array($value) ? $value : null;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private static function writeStored(array $payload): void
    {
        if (! Schema::hasTable('app_settings') || ! Schema::hasColumn('app_settings', 'attendance_rules')) {
            return;
        }

        $encoded = json_encode($payload);
        $existing = DB::table('app_settings')->first();
        if ($existing) {
            DB::table('app_settings')->where('id', $existing->id)->update([
                'attendance_rules' => $encoded,
                'updated_at' => now(),
            ]);
        } else {
            DB::table('app_settings')->insert([
                'system_name' => config('app.name', 'EMZI Nexus Brain'),
                'attendance_rules' => $encoded,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        AppSettings::forget();
    }
}
