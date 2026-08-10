<?php

namespace App\Services;

use App\Models\AttendanceLocation;
use App\Models\Department;
use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use App\Support\AppSettings;
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
        $locations = AttendanceLocation::query()
            ->orderBy('name')
            ->get()
            ->map(function (AttendanceLocation $location) {
                $row = AttendanceLocationSettings::serializeForApi($location);
                unset($row['id'], $row['department_count']);

                return $row;
            })
            ->values()
            ->all();

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
            $departments[] = [
                'department_name' => $departmentName,
                'enabled' => (bool) $serialized['enabled'],
                'location_name' => $setting->attendanceLocation?->name,
                'timezone' => $serialized['timezone'],
                'grace_period_minutes' => $serialized['grace_period_minutes'],
                'require_early_clock_out_reason' => $serialized['require_early_clock_out_reason'],
                'require_late_clock_in_reason' => $serialized['require_late_clock_in_reason'],
                'allow_outside_shift_hours' => $serialized['allow_outside_shift_hours'],
                'overtime_enabled' => $serialized['overtime_enabled'],
                'standard_hours_per_day' => $serialized['standard_hours_per_day'],
                'overtime_threshold_minutes' => $serialized['overtime_threshold_minutes'],
                'shifts' => $serialized['shifts'] ?? [],
            ];
        }

        $watermark = AttendanceWatermarkSettings::normalizeConfig(AppSettings::row());
        if ($absolutizeLogo) {
            $watermark['logo_url'] = $this->absolutizeMediaUrl($watermark['logo_url'] ?? null);
        }

        return [
            'locations' => $locations,
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

            $locationsByName = AttendanceLocation::query()->get()->keyBy(
                fn (AttendanceLocation $location) => mb_strtolower((string) $location->name)
            );

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

                $config = DepartmentAttendanceSettings::normalizeConfig(array_merge($row, [
                    'attendance_location_id' => $locationId,
                    'shifts' => $normalizedShifts,
                ]));

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
