<?php

namespace App\Services;

use App\Models\AttendanceLocation;
use App\Models\Department;
use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use App\Support\AppSettings;
use App\Support\AttendanceClockRulesSettings;
use App\Support\AttendanceLocationSettings;
use App\Support\AttendanceWatermarkSettings;
use App\Support\DepartmentAttendanceSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AttendancePolicySnapshotService
{
    /**
     * @return array{locations: list<array<string, mixed>>, departments: list<array<string, mixed>>, watermark: array<string, mixed>}
     */
    public function export(bool $absolutizeLogo = true): array
    {
        $ownerIds = AttendanceLocation::query()
            ->whereNotNull('owner_user_id')
            ->pluck('owner_user_id')
            ->unique()
            ->filter()
            ->values()
            ->all();
        $ownersById = $ownerIds === []
            ? collect()
            : User::query()
                ->whereIn('id', $ownerIds)
                ->get(['id', 'email'])
                ->keyBy('id');

        $locations = AttendanceLocation::query()
            ->orderBy('name')
            ->get()
            ->map(function (AttendanceLocation $location) use ($ownersById) {
                $row = AttendanceLocationSettings::serializeForApi($location);
                unset($row['id'], $row['department_count'], $row['owner_user_id']);
                $owner = $location->owner_user_id
                    ? $ownersById->get($location->owner_user_id)
                    : null;
                $row['owner_email'] = $owner?->email;
                $row['owner_nexus_user_id'] = $location->owner_user_id
                    ? (string) $location->owner_user_id
                    : null;

                return $row;
            })
            ->values()
            ->all();

        $locationsById = AttendanceLocation::query()->get(['id', 'name'])->keyBy('id');

        $departments = [];
        $settings = DepartmentAttendanceSetting::query()
            ->with(['department:id,name', 'attendanceLocation:id,name'])
            ->get();

        foreach ($settings as $setting) {
            $departmentName = $setting->department?->name;
            if (! filled($departmentName)) {
                continue;
            }

            $serialized = DepartmentAttendanceSettings::serializeForApi($setting);
            $shifts = [];
            foreach ($serialized['shifts'] ?? [] as $shift) {
                if (! is_array($shift)) {
                    continue;
                }
                $shiftLocationId = isset($shift['attendance_location_id'])
                    ? (int) $shift['attendance_location_id']
                    : null;
                $shiftOut = $shift;
                unset($shiftOut['attendance_location_id']);
                $shiftOut['location_name'] = $shiftLocationId
                    ? ($locationsById->get($shiftLocationId)?->name)
                    : null;
                $shifts[] = $shiftOut;
            }

            $departments[] = [
                'department_name' => $departmentName,
                'enabled' => (bool) $serialized['enabled'],
                'location_name' => $setting->attendanceLocation?->name,
                'timezone' => $serialized['timezone'],
                'grace_period_minutes' => $serialized['grace_period_minutes'],
                'require_early_clock_out_reason' => $serialized['require_early_clock_out_reason'],
                'require_late_clock_in_reason' => $serialized['require_late_clock_in_reason'],
                'allow_outside_shift_hours' => $serialized['allow_outside_shift_hours'],
                'allow_different_shift_clock_in' => $serialized['allow_different_shift_clock_in'] ?? false,
                'overtime_enabled' => $serialized['overtime_enabled'],
                'shortage_enabled' => $serialized['shortage_enabled'] ?? true,
                'count_work_from_scheduled_start' => $serialized['count_work_from_scheduled_start'] ?? true,
                'standard_hours_per_day' => $serialized['standard_hours_per_day'],
                'overtime_threshold_minutes' => $serialized['overtime_threshold_minutes'],
                'shifts' => $shifts,
            ];
        }

        $watermark = AttendanceWatermarkSettings::normalizeConfig(AppSettings::row());
        if ($absolutizeLogo) {
            $watermark['logo_url'] = $this->absolutizeMediaUrl($watermark['logo_url'] ?? null);
        }

        return [
            'locations' => $locations,
            'clock_rules' => AttendanceClockRulesSettings::hasStored()
                ? AttendanceClockRulesSettings::current()
                : null,
            'departments' => $departments,
            'watermark' => $watermark,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{locations_upserted: int, locations_pruned: int, departments_upserted: int, watermark_updated: bool}
     */
    public function apply(array $payload): array
    {
        $stats = [
            'locations_upserted' => 0,
            'locations_pruned' => 0,
            'departments_upserted' => 0,
            'clock_rules_updated' => false,
            'watermark_updated' => false,
        ];

        $locationRows = is_array($payload['locations'] ?? null) ? $payload['locations'] : [];
        $departmentRows = is_array($payload['departments'] ?? null) ? $payload['departments'] : [];
        $pruneMissing = filter_var($payload['prune_missing'] ?? true, FILTER_VALIDATE_BOOLEAN);
        $watermarkInput = is_array($payload['watermark'] ?? null) ? $payload['watermark'] : null;

        $keptLocationNames = [];

        DB::transaction(function () use (
            $locationRows,
            $departmentRows,
            $pruneMissing,
            $watermarkInput,
            $payload,
            &$stats,
            &$keptLocationNames,
        ) {
            foreach ($locationRows as $row) {
                if (! is_array($row)) {
                    continue;
                }

                $config = AttendanceLocationSettings::normalizeConfig($row);
                $name = $config['name'];
                $keptLocationNames[] = $name;

                $existing = AttendanceLocation::query()->where('name', $name)->first();
                $ownerId = $this->resolveLocationOwnerId($row, $existing);
                $config['owner_user_id'] = $ownerId;

                AttendanceLocation::query()->updateOrCreate(
                    ['name' => $name],
                    AttendanceLocationSettings::toDatabaseColumns($config),
                );
                $stats['locations_upserted']++;
            }

            if ($pruneMissing) {
                $query = AttendanceLocation::query()->whereNull('owner_user_id');
                if ($keptLocationNames !== []) {
                    $query->whereNotIn('name', array_values(array_unique($keptLocationNames)));
                }
                $stats['locations_pruned'] = (int) $query->delete();
            }

            $locationsByName = AttendanceLocation::query()
                ->shared()
                ->get()
                ->keyBy(
                    fn (AttendanceLocation $location) => mb_strtolower((string) $location->name)
                );

            if (is_array($payload['clock_rules'] ?? null)) {
                AttendanceClockRulesSettings::store($payload['clock_rules']);
                $stats['clock_rules_updated'] = true;
            }

            foreach ($departmentRows as $row) {
                if (! is_array($row)) {
                    continue;
                }

                $departmentName = trim((string) ($row['department_name'] ?? ''));
                if ($departmentName === '') {
                    continue;
                }

                $department = Department::query()->firstOrCreate(['name' => $departmentName]);
                $locationName = trim((string) ($row['location_name'] ?? ''));
                $locationId = null;
                if ($locationName !== '') {
                    $location = $locationsByName->get(mb_strtolower($locationName));
                    $locationId = $location?->id;
                }

                $shifts = is_array($row['shifts'] ?? null) ? $row['shifts'] : [];
                $normalizedShifts = [];
                foreach ($shifts as $shift) {
                    if (! is_array($shift)) {
                        continue;
                    }
                    $shiftLocationName = trim((string) ($shift['location_name'] ?? ''));
                    $shiftLocationId = null;
                    if ($shiftLocationName !== '') {
                        $shiftLocationId = $locationsByName->get(mb_strtolower($shiftLocationName))?->id;
                    } elseif (isset($shift['attendance_location_id'])) {
                        // Ignore peer local IDs; names are the portable key.
                        $shiftLocationId = null;
                    }
                    $normalizedShifts[] = array_merge($shift, [
                        'attendance_location_id' => $shiftLocationId,
                    ]);
                }

                $config = DepartmentAttendanceSettings::preserveClockRules(
                    DepartmentAttendanceSettings::normalizeConfig(array_merge($row, [
                        'attendance_location_id' => $locationId,
                        'shifts' => $normalizedShifts,
                    ])),
                    DepartmentAttendanceSetting::query()->where('department_id', $department->id)->first(),
                );

                DepartmentAttendanceSetting::query()->updateOrCreate(
                    ['department_id' => $department->id],
                    DepartmentAttendanceSettings::toDatabaseColumns($config),
                );
                $stats['departments_upserted']++;
            }

            if ($watermarkInput !== null && Schema::hasTable('app_settings')) {
                $config = AttendanceWatermarkSettings::normalizeConfig($watermarkInput);
                $columns = AttendanceWatermarkSettings::toDatabaseColumns($config);
                $existing = DB::table('app_settings')->first();
                if ($existing) {
                    DB::table('app_settings')->where('id', $existing->id)->update(array_merge($columns, [
                        'updated_at' => now(),
                    ]));
                } else {
                    DB::table('app_settings')->insert(array_merge([
                        'system_name' => config('app.name', 'EMZI Nexus Brain'),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ], $columns));
                }
                AppSettings::forget();
                $stats['watermark_updated'] = true;
            }
        });

        return $stats;
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function resolveLocationOwnerId(array $row, ?AttendanceLocation $existing): ?int
    {
        $nexusId = trim((string) ($row['owner_nexus_user_id'] ?? ''));
        if ($nexusId !== '' && ctype_digit($nexusId)) {
            $user = User::query()->find((int) $nexusId);
            if ($user) {
                return (int) $user->id;
            }
        }

        $email = strtolower(trim((string) ($row['owner_email'] ?? '')));
        if ($email !== '') {
            $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();
            if ($user) {
                return (int) $user->id;
            }
        }

        if ($existing?->owner_user_id) {
            return (int) $existing->owner_user_id;
        }

        return null;
    }

    private function absolutizeMediaUrl(?string $url): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }

        if (preg_match('#^(https?:|data:|blob:)#i', $url) === 1) {
            return $url;
        }

        $origin = rtrim((string) config('app.url'), '/');
        $relative = str_starts_with($url, '/') ? $url : '/'.$url;

        return $origin.$relative;
    }
}
