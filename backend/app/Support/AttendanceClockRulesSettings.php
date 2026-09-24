<?php

namespace App\Support;

use App\Models\DepartmentAttendanceSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AttendanceClockRulesSettings
{
    /** @var array<string, mixed> */
    public const DEFAULTS = [
        'allow_outside_shift_hours' => false,
        'require_early_clock_out_reason' => false,
        'require_late_clock_in_reason' => false,
        'overtime_enabled' => true,
        'overtime_threshold_minutes' => 0,
        'grace_period_minutes' => 15,
        'allow_different_shift_clock_in' => false,
        'shortage_enabled' => true,
        'count_work_from_scheduled_start' => true,
    ];

    /** @var list<string> */
    public const KEYS = [
        'allow_outside_shift_hours',
        'require_early_clock_out_reason',
        'require_late_clock_in_reason',
        'overtime_enabled',
        'overtime_threshold_minutes',
        'grace_period_minutes',
        'allow_different_shift_clock_in',
        'shortage_enabled',
        'count_work_from_scheduled_start',
    ];

    /**
     * @return array<string, mixed>
     */
    public static function current(): array
    {
        $stored = self::stored();
        if ($stored !== null) {
            return array_merge(self::DEFAULTS, self::normalize($stored));
        }

        $first = DepartmentAttendanceSetting::query()
            ->orderBy('department_id')
            ->first();

        if ($first) {
            return self::normalize([
                'allow_outside_shift_hours' => $first->allow_outside_shift_hours,
                'require_early_clock_out_reason' => $first->require_early_clock_out_reason,
                'require_late_clock_in_reason' => $first->require_late_clock_in_reason,
                'overtime_enabled' => $first->overtime_enabled,
                'overtime_threshold_minutes' => $first->overtime_threshold_minutes,
                'grace_period_minutes' => $first->grace_period_minutes,
                'allow_different_shift_clock_in' => $first->allow_different_shift_clock_in ?? false,
                'shortage_enabled' => $first->shortage_enabled ?? true,
                'count_work_from_scheduled_start' => $first->count_work_from_scheduled_start ?? true,
            ]);
        }

        return self::DEFAULTS;
    }

    /**
     * Keys actually saved as company rules. Missing keys stay on the department row.
     *
     * @return array<string, mixed>
     */
    public static function applied(): array
    {
        $stored = self::stored();
        if ($stored === null) {
            return [];
        }

        return self::normalize($stored);
    }

    public static function hasStored(): bool
    {
        return self::stored() !== null;
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public static function store(array $input): array
    {
        $previous = self::stored() ?? [];
        $config = self::normalize(array_merge($previous, $input));
        self::writeStored($config);
        self::stampDepartments($config);

        return array_merge(self::DEFAULTS, $config);
    }

    public static function applyTo(?DepartmentAttendanceSetting $setting): ?DepartmentAttendanceSetting
    {
        if (! $setting || ! self::hasStored()) {
            return $setting;
        }

        foreach (self::applied() as $key => $value) {
            $setting->{$key} = $value;
        }

        return $setting;
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public static function overlay(array $config): array
    {
        if (! self::hasStored()) {
            return $config;
        }

        return array_merge($config, self::applied());
    }

    /**
     * @return array<string, array<int, string>>
     */
    public static function validationRules(): array
    {
        return [
            'allow_outside_shift_hours' => ['nullable', 'boolean'],
            'require_early_clock_out_reason' => ['nullable', 'boolean'],
            'require_late_clock_in_reason' => ['nullable', 'boolean'],
            'overtime_enabled' => ['nullable', 'boolean'],
            'overtime_threshold_minutes' => ['nullable', 'integer', 'min:0', 'max:480'],
            'grace_period_minutes' => ['nullable', 'integer', 'min:0', 'max:180'],
            'allow_different_shift_clock_in' => ['nullable', 'boolean'],
            'shortage_enabled' => ['nullable', 'boolean'],
            'count_work_from_scheduled_start' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public static function normalize(array $input): array
    {
        $config = [];

        if (array_key_exists('allow_outside_shift_hours', $input)) {
            $config['allow_outside_shift_hours'] = self::toBool($input['allow_outside_shift_hours']);
        }
        if (array_key_exists('require_early_clock_out_reason', $input)) {
            $config['require_early_clock_out_reason'] = self::toBool($input['require_early_clock_out_reason']);
        }
        if (array_key_exists('require_late_clock_in_reason', $input)) {
            $config['require_late_clock_in_reason'] = self::toBool($input['require_late_clock_in_reason']);
        }
        if (array_key_exists('overtime_enabled', $input)) {
            $config['overtime_enabled'] = self::toBool($input['overtime_enabled']);
        }
        if (array_key_exists('overtime_threshold_minutes', $input)) {
            $config['overtime_threshold_minutes'] = max(0, min(480, (int) $input['overtime_threshold_minutes']));
        }
        if (array_key_exists('grace_period_minutes', $input)) {
            $config['grace_period_minutes'] = max(0, min(180, (int) $input['grace_period_minutes']));
        }
        if (array_key_exists('allow_different_shift_clock_in', $input)) {
            $config['allow_different_shift_clock_in'] = self::toBool($input['allow_different_shift_clock_in']);
        }
        if (array_key_exists('shortage_enabled', $input)) {
            $config['shortage_enabled'] = self::toBool($input['shortage_enabled']);
        }
        if (array_key_exists('count_work_from_scheduled_start', $input)) {
            $config['count_work_from_scheduled_start'] = self::toBool($input['count_work_from_scheduled_start']);
        }

        return $config;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function stored(): ?array
    {
        $stored = self::readStored();
        if (! is_array($stored) || $stored === []) {
            return null;
        }

        return $stored;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function readStored(): ?array
    {
        if (! Schema::hasTable('app_settings') || ! Schema::hasColumn('app_settings', 'attendance_rules')) {
            return null;
        }

        $row = DB::table('app_settings')->first();
        $value = $row->attendance_rules ?? null;
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : null;
        }

        return is_array($value) ? $value : null;
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private static function writeStored(array $config): void
    {
        if (! Schema::hasTable('app_settings') || ! Schema::hasColumn('app_settings', 'attendance_rules')) {
            return;
        }

        $encoded = json_encode($config);
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

    /**
     * @param  array<string, mixed>  $config
     */
    private static function stampDepartments(array $config): void
    {
        if (! DepartmentAttendanceSetting::query()->exists()) {
            return;
        }

        $update = [];
        foreach (self::KEYS as $key) {
            if (array_key_exists($key, $config)) {
                $update[$key] = $config[$key];
            }
        }

        if ($update === []) {
            return;
        }

        DepartmentAttendanceSetting::query()->update($update);
    }

    private static function toBool(mixed $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}
