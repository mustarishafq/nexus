<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\DepartmentAttendanceSetting;
use App\Models\User;
use App\Services\ResourceAttendancePolicyForwarder;
use App\Support\AttendanceRulesSettings;
use App\Support\DepartmentAttendanceSettings;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class DepartmentAttendanceController extends Controller
{
    use AuthorizesRoles;

    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ATTENDANCE_MANAGE_POLICY)) {
            return $response;
        }

        $departments = Department::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        $settings = DepartmentAttendanceSetting::query()
            ->with('attendanceLocation')
            ->get()
            ->keyBy('department_id');

        $companyIdsByDepartment = $this->companyIdsByDepartment();

        return response()->json([
            'departments' => $departments->map(function (Department $department) use ($settings, $companyIdsByDepartment) {
                $setting = $settings->get($department->id);

                return [
                    'department' => [
                        'id' => $department->id,
                        'name' => $department->name,
                        'company_ids' => $companyIdsByDepartment->get($department->id, []),
                    ],
                    'settings' => AttendanceRulesSettings::serializeDepartment($setting, (int) $department->id),
                ];
            })->values(),
            'weekdays' => DepartmentAttendanceSettings::WEEKDAYS,
        ]);
    }

    public function show(Request $request, Department $department): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ATTENDANCE_MANAGE_POLICY)) {
            return $response;
        }

        $setting = DepartmentAttendanceSetting::query()
            ->with('attendanceLocation')
            ->where('department_id', $department->id)
            ->first();

        return response()->json([
            'department' => [
                'id' => $department->id,
                'name' => $department->name,
                'company_ids' => $this->companyIdsByDepartment()->get($department->id, []),
            ],
            'settings' => AttendanceRulesSettings::serializeDepartment($setting, (int) $department->id),
            'weekdays' => DepartmentAttendanceSettings::WEEKDAYS,
        ]);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ATTENDANCE_MANAGE_POLICY)) {
            return $response;
        }

        $validated = $request->validate(DepartmentAttendanceSettings::validationRules());
        $setting = AttendanceRulesSettings::persistDepartmentShifts(
            (int) $department->id,
            $validated['shifts'] ?? [],
        );

        app(ResourceAttendancePolicyForwarder::class)->pushAfterResponse();

        return response()->json([
            'department' => [
                'id' => $department->id,
                'name' => $department->name,
                'company_ids' => $this->companyIdsByDepartment()->get($department->id, []),
            ],
            'settings' => AttendanceRulesSettings::serializeDepartment($setting, (int) $department->id),
            'weekdays' => DepartmentAttendanceSettings::WEEKDAYS,
        ]);
    }

    public function bulkUpdate(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ATTENDANCE_MANAGE_POLICY)) {
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

        if (self::payloadHasRuleFields($validated)) {
            AttendanceRulesSettings::store($validated);
        }

        $departments = Department::query()
            ->whereIn('id', $departmentIds)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->keyBy('id');

        $companyIdsByDepartment = $this->companyIdsByDepartment();
        $results = [];
        $hasShifts = array_key_exists('shifts', $validated);

        foreach ($departmentIds as $departmentId) {
            $department = $departments->get($departmentId);
            if (! $department) {
                continue;
            }

            if ($hasShifts) {
                $setting = AttendanceRulesSettings::persistDepartmentShifts(
                    (int) $departmentId,
                    is_array($validated['shifts'] ?? null) ? $validated['shifts'] : [],
                );
            } else {
                $setting = DepartmentAttendanceSetting::query()
                    ->with('attendanceLocation')
                    ->where('department_id', $departmentId)
                    ->first();
            }

            $results[] = [
                'department' => [
                    'id' => $department->id,
                    'name' => $department->name,
                    'company_ids' => $companyIdsByDepartment->get($department->id, []),
                ],
                'settings' => AttendanceRulesSettings::serializeDepartment($setting, (int) $departmentId),
            ];
        }

        app(ResourceAttendancePolicyForwarder::class)->pushAfterResponse();

        return response()->json([
            'departments' => $results,
            'weekdays' => DepartmentAttendanceSettings::WEEKDAYS,
        ]);
    }

    /**
     * @return Collection<int, list<int>>
     */
    private function companyIdsByDepartment(): Collection
    {
        return User::query()
            ->whereNotNull('department_id')
            ->whereNotNull('company_id')
            ->select('department_id', 'company_id')
            ->distinct()
            ->get()
            ->groupBy('department_id')
            ->map(fn (Collection $rows) => $rows
                ->pluck('company_id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all());
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private static function payloadHasRuleFields(array $payload): bool
    {
        foreach (DepartmentAttendanceSettings::RULE_KEYS as $key) {
            if (array_key_exists($key, $payload)) {
                return true;
            }
        }

        return false;
    }
}
