<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Services\ResourceAttendancePolicyForwarder;
use App\Support\AttendanceRulesSettings;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceRulesController extends Controller
{
    use AuthorizesRoles;

    public function show(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ATTENDANCE_MANAGE_POLICY)) {
            return $response;
        }

        return response()->json([
            'settings' => AttendanceRulesSettings::serializeForApi(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ATTENDANCE_MANAGE_POLICY)) {
            return $response;
        }

        $validated = $request->validate(AttendanceRulesSettings::validationRules());
        AttendanceRulesSettings::store($validated);

        app(ResourceAttendancePolicyForwarder::class)->pushAfterResponse();

        return response()->json([
            'settings' => AttendanceRulesSettings::serializeForApi(),
        ]);
    }
}
