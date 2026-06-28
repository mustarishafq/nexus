<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Services\ApplicationHealthCheckerService;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicationHealthController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['ok' => true]);
    }

    public function test(Request $request, Application $application, ApplicationHealthCheckerService $service): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canEditSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'base_url' => ['nullable', 'string', 'max:2048'],
            'health_check_enabled' => ['nullable', 'boolean'],
            'health_check_path' => ['nullable', 'string', 'max:255'],
            'health_check_mode' => ['nullable', 'in:json_ok,http_status'],
            'mcp_api_key' => ['nullable', 'string', 'max:255'],
            'mcp_auth_mode' => ['nullable', 'in:bearer,x-api-key'],
            'api_key' => ['nullable', 'string', 'max:255'],
            'notification_config' => ['nullable', 'array'],
        ]);

        return response()->json($service->test($application, $validated));
    }

    public function run(Request $request, ApplicationHealthCheckerService $service): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        dispatch(function () use ($service): void {
            $service->checkAll();
        })->afterResponse();

        return response()->json([
            'message' => 'Health checks started.',
            'status' => 'running',
        ], 202);
    }

    private function canEditSystem($user, Application $application): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return (int) $application->created_by_user_id === (int) $user->id;
    }
}
