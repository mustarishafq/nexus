<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $items = $this->applyIndexQuery(
            $request,
            Notification::query(),
            ['user_id', 'system_id', 'type', 'priority', 'category', 'is_read', 'is_broadcast']
        )->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['nullable', 'string', 'max:255'],
            'system_id' => ['nullable', 'string', 'max:255'],
            'type' => ['sometimes', Rule::in(['info', 'success', 'warning', 'error', 'critical'])],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'critical'])],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string'],
            'data' => ['nullable', 'array'],
            'category' => ['sometimes', Rule::in(['booking', 'hr', 'inventory', 'finance', 'security', 'system', 'task', 'approval', 'announcement', 'other'])],
            'is_read' => ['sometimes', 'boolean'],
            'read_at' => ['nullable', 'date'],
            'is_broadcast' => ['sometimes', 'boolean'],
            'snoozed_until' => ['nullable', 'date'],
            'action_url' => ['nullable', 'string', 'max:2048'],
            'delivery_channels' => ['nullable', 'array'],
            'delivery_channels.*' => ['string', 'max:50'],
        ]);

        $item = Notification::create($validated);

        return response()->json($item, 201);
    }

    public function show(Notification $notification): JsonResponse
    {
        return response()->json($notification);
    }

    public function update(Request $request, Notification $notification): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'system_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'type' => ['sometimes', Rule::in(['info', 'success', 'warning', 'error', 'critical'])],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'critical'])],
            'title' => ['sometimes', 'string', 'max:255'],
            'message' => ['sometimes', 'nullable', 'string'],
            'data' => ['sometimes', 'nullable', 'array'],
            'category' => ['sometimes', Rule::in(['booking', 'hr', 'inventory', 'finance', 'security', 'system', 'task', 'approval', 'announcement', 'other'])],
            'is_read' => ['sometimes', 'boolean'],
            'read_at' => ['sometimes', 'nullable', 'date'],
            'is_broadcast' => ['sometimes', 'boolean'],
            'snoozed_until' => ['sometimes', 'nullable', 'date'],
            'action_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'delivery_channels' => ['sometimes', 'nullable', 'array'],
            'delivery_channels.*' => ['string', 'max:50'],
        ]);

        $notification->update($validated);

        return response()->json($notification->fresh());
    }

    public function destroy(Notification $notification): JsonResponse
    {
        $notification->delete();

        return response()->json(status: 204);
    }
}
