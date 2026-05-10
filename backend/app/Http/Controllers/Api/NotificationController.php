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
        $query = $this->applyIndexQuery(
            $request,
            Notification::query(),
            ['user_id', 'system_id', 'type', 'priority', 'category', 'is_read', 'is_broadcast']
        );

        if ($request->boolean('exclude_broadcasts')) {
            $query->where('is_broadcast', false);
        }

        if ($request->boolean('active_broadcast_only')) {
            $now = now();

            $query
                ->where('is_broadcast', true)
                ->where(function ($inner) use ($now) {
                    $inner->whereNull('broadcast_starts_at')
                        ->orWhere('broadcast_starts_at', '<=', $now);
                })
                ->where(function ($inner) use ($now) {
                    $inner->whereNull('broadcast_ends_at')
                        ->orWhere('broadcast_ends_at', '>=', $now);
                });
        }

        $items = $query->get();

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
            'broadcast_starts_at' => ['nullable', 'date'],
            'broadcast_ends_at' => ['nullable', 'date', 'after:broadcast_starts_at'],
            'snoozed_until' => ['nullable', 'date'],
            'action_url' => ['nullable', 'string', 'max:2048'],
            'delivery_channels' => ['nullable', 'array'],
            'delivery_channels.*' => ['string', 'max:50'],
        ]);

        $item = Notification::create($validated);

        $shouldSendPush = !($item->is_broadcast && $item->broadcast_starts_at && $item->broadcast_starts_at->isFuture());

        if ($shouldSendPush) {
            app()->make('App\\Services\\PushNotificationService')->sendNotification($item);
        }

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
            'broadcast_starts_at' => ['sometimes', 'nullable', 'date'],
            'broadcast_ends_at' => ['sometimes', 'nullable', 'date'],
            'snoozed_until' => ['sometimes', 'nullable', 'date'],
            'action_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'delivery_channels' => ['sometimes', 'nullable', 'array'],
            'delivery_channels.*' => ['string', 'max:50'],
        ]);

        $startAt = array_key_exists('broadcast_starts_at', $validated)
            ? $validated['broadcast_starts_at']
            : $notification->broadcast_starts_at;
        $endAt = array_key_exists('broadcast_ends_at', $validated)
            ? $validated['broadcast_ends_at']
            : $notification->broadcast_ends_at;

        if ($startAt && $endAt && strtotime((string) $endAt) <= strtotime((string) $startAt)) {
            return response()->json([
                'message' => 'The broadcast_ends_at must be a date after broadcast_starts_at.',
                'errors' => [
                    'broadcast_ends_at' => ['The broadcast_ends_at must be a date after broadcast_starts_at.'],
                ],
            ], 422);
        }

        $notification->update($validated);

        return response()->json($notification->fresh());
    }

    public function destroy(Notification $notification): JsonResponse
    {
        $notification->delete();

        return response()->json(status: 204);
    }
}
