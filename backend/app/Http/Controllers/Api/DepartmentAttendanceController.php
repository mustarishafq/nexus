<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\DepartmentAttendanceSetting;
use App\Support\DepartmentAttendanceSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentAttendanceController extends Controller
{
    use AuthorizesRoles;

    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $departments = Department::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        $settings = DepartmentAttendanceSetting::query()
            ->with('attendanceLocation')
            ->get()
            ->keyBy('department_id');

        return response()->json([
            'departments' => $departments->map(function (Department $department) use ($settings) {
                $setting = $settings->get($department->id);

                return [
                    'department' => $department->only(['id', 'name']),
                    'settings' => $setting
                        ? DepartmentAttendanceSettings::serializeForApi($setting)
                        : DepartmentAttendanceSettings::normalizeConfig([]),
                ];
            })->values(),
            'weekdays' => DepartmentAttendanceSettings::WEEKDAYS,
        ]);
    }

    public function show(Request $request, Department $department): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $setting = DepartmentAttendanceSetting::query()
            ->with('attendanceLocation')
            ->where('department_id', $department->id)
            ->first();

        return response()->json([
            'department' => $department->only(['id', 'name']),
            'settings' => $setting
                ? DepartmentAttendanceSettings::serializeForApi($setting)
                : DepartmentAttendanceSettings::normalizeConfig([]),
            'weekdays' => DepartmentAttendanceSettings::WEEKDAYS,
        ]);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $validated = $request->validate(DepartmentAttendanceSettings::validationRules());
        $config = DepartmentAttendanceSettings::normalizeConfig($validated);

        $setting = DepartmentAttendanceSetting::query()->updateOrCreate(
            ['department_id' => $department->id],
            DepartmentAttendanceSettings::toDatabaseColumns($config),
        );

        $setting->load('attendanceLocation');

        return response()->json([
            'department' => $department->only(['id', 'name']),
            'settings' => DepartmentAttendanceSettings::serializeForApi($setting),
            'weekdays' => DepartmentAttendanceSettings::WEEKDAYS,
        ]);
    }

    public function bulkUpdate(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $validated = $request->validate(array_merge(
            [
                'department_ids' => ['required', 'array', 'min:1'],
                'department_ids.*' => ['integer', 'distinct', 'exists:departments,id'],
            ],
            DepartmentAttendanceSettings::validationRules(),
        ));

        $departmentIds = array_values(array_unique(array_map('intval', $validated['department_ids'])));
        unset($validated['department_ids']);

        $config = DepartmentAttendanceSettings::normalizeConfig($validated);
        $columns = DepartmentAttendanceSettings::toDatabaseColumns($config);

        $departments = Department::query()
            ->whereIn('id', $departmentIds)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->keyBy('id');

        $results = [];

        foreach ($departmentIds as $departmentId) {
            $department = $departments->get($departmentId);
            if (! $department) {
                continue;
            }

            $setting = DepartmentAttendanceSetting::query()->updateOrCreate(
                ['department_id' => $departmentId],
                $columns,
            );
            $setting->load('attendanceLocation');

            $results[] = [
                'department' => $department->only(['id', 'name']),
                'settings' => DepartmentAttendanceSettings::serializeForApi($setting),
            ];
        }

        return response()->json([
            'departments' => $results,
            'weekdays' => DepartmentAttendanceSettings::WEEKDAYS,
        ]);
    }
}
