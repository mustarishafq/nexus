<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ActivityLogController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $items = $this->applyIndexQuery(
            $request,
            ActivityLog::query()->where('user_id', (string) $user->id),
            ['system_id', 'action', 'resource_type', 'resource_id']
        )->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['nullable', 'string', 'max:255'],
            'user_name' => ['nullable', 'string', 'max:255'],
            'system_id' => ['nullable', 'string', 'max:255'],
            'action' => ['sometimes', Rule::in(['login', 'logout', 'create', 'update', 'delete', 'approve', 'reject', 'view', 'export', 'import', 'other'])],
            'description' => ['required', 'string'],
            'resource_type' => ['nullable', 'string', 'max:255'],
            'resource_id' => ['nullable', 'string', 'max:255'],
            'ip_address' => ['nullable', 'ip'],
            'metadata' => ['nullable', 'array'],
        ]);

        $item = ActivityLog::create($validated);

        return response()->json($item, 201);
    }

    public function show(Request $request, ActivityLog $activityLog): JsonResponse
    {
        if ($response = $this->authorizeActivityLog($request, $activityLog)) {
            return $response;
        }

        return response()->json($activityLog);
    }

    public function update(Request $request, ActivityLog $activityLog): JsonResponse
    {
        if ($response = $this->authorizeActivityLog($request, $activityLog)) {
            return $response;
        }

        $validated = $request->validate([
            'user_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'user_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'system_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'action' => ['sometimes', Rule::in(['login', 'logout', 'create', 'update', 'delete', 'approve', 'reject', 'view', 'export', 'import', 'other'])],
            'description' => ['sometimes', 'string'],
            'resource_type' => ['sometimes', 'nullable', 'string', 'max:255'],
            'resource_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'ip_address' => ['sometimes', 'nullable', 'ip'],
            'metadata' => ['sometimes', 'nullable', 'array'],
        ]);

        $activityLog->update($validated);

        return response()->json($activityLog->fresh());
    }

    public function destroy(Request $request, ActivityLog $activityLog): JsonResponse
    {
        if ($response = $this->authorizeActivityLog($request, $activityLog)) {
            return $response;
        }

        $activityLog->delete();

        return response()->json(status: 204);
    }

    private function authenticatedUser(Request $request): ?User
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return null;
        }

        return $user;
    }

    private function authorizeActivityLog(Request $request, ActivityLog $activityLog): ?JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($activityLog->user_id !== (string) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
    }
}
