<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\DepartmentAttendanceSetting;
use App\Support\ApiTokenAuth;
use App\Support\DepartmentAttendanceSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentAttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
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
        if ($response = $this->authorizeAdmin($request)) {
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
        if ($response = $this->authorizeAdmin($request)) {
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

    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
    }
}
