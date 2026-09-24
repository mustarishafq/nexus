<?php

namespace App\Http\Controllers\Api\Nexus\V1;

use App\Http\Controllers\Controller;
use App\Services\AttendancePolicySnapshotService;
use App\Support\AttendancePolicySyncGuard;
use App\Support\AttendancePolicySyncMeta;
use App\Support\NexusSatelliteAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendancePolicyController extends Controller
{
    public function show(Request $request, AttendancePolicySnapshotService $snapshot): JsonResponse
    {
        $auth = NexusSatelliteAuth::authenticate($request, ['brain-attendance-policy']);
        if ($auth instanceof JsonResponse) {
            return $auth;
        }

        return response()->json($snapshot->export());
    }

    public function update(Request $request, AttendancePolicySnapshotService $snapshot): JsonResponse
    {
        $auth = NexusSatelliteAuth::authenticate($request, ['brain-attendance-policy']);
        if ($auth instanceof JsonResponse) {
            return $auth;
        }

        $request->validate([
            'locations' => ['nullable', 'array'],
            'locations.*.name' => ['required_with:locations', 'string', 'max:120'],
            'departments' => ['nullable', 'array'],
            'departments.*.department_name' => ['required_with:departments', 'string', 'max:255'],
            'departments.*.location_name' => ['nullable', 'string', 'max:120'],
            'watermark' => ['nullable', 'array'],
            'clock_rules' => ['nullable', 'array'],
            'prune_missing' => ['nullable', 'boolean'],
        ]);

        $payload = [
            'locations' => $request->input('locations', []),
            'departments' => $request->input('departments', []),
            'watermark' => $request->input('watermark'),
            'clock_rules' => $request->input('clock_rules'),
            'prune_missing' => $request->boolean('prune_missing', true),
        ];

        $stats = AttendancePolicySyncGuard::runWithoutPush(
            fn () => $snapshot->apply($payload)
        );

        AttendancePolicySyncMeta::mark('inbound', is_array($stats) ? $stats : []);

        return response()->json([
            'message' => 'Attendance policy applied',
            'stats' => $stats,
            'policy' => $snapshot->export(),
        ]);
    }
}
