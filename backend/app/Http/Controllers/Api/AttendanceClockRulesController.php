<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Services\ResourceAttendancePolicyForwarder;
use App\Support\AttendanceClockRulesSettings;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceClockRulesController extends Controller
{
    use AuthorizesRoles;

    public function show(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ATTENDANCE_MANAGE_POLICY)) {
            return $response;
        }

        return response()->json([
            'settings' => AttendanceClockRulesSettings::current(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ATTENDANCE_MANAGE_POLICY)) {
            return $response;
        }

        $validated = $request->validate(AttendanceClockRulesSettings::validationRules());
        $settings = AttendanceClockRulesSettings::store($validated);

        app(ResourceAttendancePolicyForwarder::class)->pushAfterResponse();

        return response()->json([
            'message' => 'Clock rules saved',
            'settings' => $settings,
        ]);
    }
}
