<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ActivityLogController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $items = $this->applyIndexQuery(
            $request,
            ActivityLog::query(),
            ['user_id', 'system_id', 'action', 'resource_type', 'resource_id']
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

    public function show(ActivityLog $activityLog): JsonResponse
    {
        return response()->json($activityLog);
    }

    public function update(Request $request, ActivityLog $activityLog): JsonResponse
    {
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

    public function destroy(ActivityLog $activityLog): JsonResponse
    {
        $activityLog->delete();

        return response()->json(status: 204);
    }
}
