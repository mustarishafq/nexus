<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Models\AttendanceLocation;
use App\Services\ResourceAttendancePolicyForwarder;
use App\Support\AttendanceLocationSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceLocationController extends Controller
{
    use AuthorizesRoles;

    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $locations = AttendanceLocation::query()
            ->shared()
            ->withCount('departmentSettings')
            ->orderBy('name')
            ->get();

        return response()->json([
            'locations' => $locations
                ->map(fn (AttendanceLocation $location) => AttendanceLocationSettings::serializeForApi($location))
                ->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $validated = $request->validate(AttendanceLocationSettings::validationRules());
        $config = AttendanceLocationSettings::normalizeConfig($validated);
        // Admin-created locations are shared company sites, not personal.
        $config['owner_user_id'] = null;

        $location = AttendanceLocation::query()->create(
            AttendanceLocationSettings::toDatabaseColumns($config),
        );

        app(ResourceAttendancePolicyForwarder::class)->pushAfterResponse();

        return response()->json([
            'location' => AttendanceLocationSettings::serializeForApi($location),
        ], 201);
    }

    public function update(Request $request, AttendanceLocation $attendanceLocation): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $validated = $request->validate(AttendanceLocationSettings::validationRules());
        $config = AttendanceLocationSettings::normalizeConfig($validated);
        // Keep personal ownership; admin editor does not reassign owners.
        $config['owner_user_id'] = $attendanceLocation->owner_user_id;

        $attendanceLocation->update(AttendanceLocationSettings::toDatabaseColumns($config));

        app(ResourceAttendancePolicyForwarder::class)->pushAfterResponse();

        return response()->json([
            'location' => AttendanceLocationSettings::serializeForApi(
                $attendanceLocation->fresh()->loadCount('departmentSettings'),
            ),
        ]);
    }

    public function destroy(Request $request, AttendanceLocation $attendanceLocation): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $departmentCount = $attendanceLocation->departmentSettings()->count();

        if ($departmentCount > 0) {
            return response()->json([
                'message' => sprintf(
                    'This location is assigned to %d department%s. Reassign them before deleting.',
                    $departmentCount,
                    $departmentCount === 1 ? '' : 's',
                ),
            ], 422);
        }

        $attendanceLocation->delete();

        app(ResourceAttendancePolicyForwarder::class)->pushAfterResponse();

        return response()->json(['message' => 'Location deleted']);
    }
}
