<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\Broadcast;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BroadcastController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $query = $this->applyIndexQuery(
            $request,
            Broadcast::query(),
            ['priority'],
            'created_at'
        );

        // Filter to active broadcasts only (within start/end time window)
        if ($request->boolean('active_only')) {
            $now = now();
            $query
                ->where(function ($inner) use ($now) {
                    $inner->whereNull('broadcast_starts_at')
                        ->orWhere('broadcast_starts_at', '<=', $now);
                })
                ->where(function ($inner) use ($now) {
                    $inner->whereNull('broadcast_ends_at')
                        ->orWhere('broadcast_ends_at', '>=', $now);
                });
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string'],
            'priority' => ['sometimes', 'in:low,medium,high,critical'],
            'broadcast_starts_at' => ['nullable', 'date'],
            'broadcast_ends_at' => ['nullable', 'date', 'after_or_equal:broadcast_starts_at'],
        ]);

        $broadcast = Broadcast::create($validated);

        $notification = Notification::create([
            'title' => $broadcast->title,
            'message' => $broadcast->message,
            'type' => 'info',
            'priority' => $broadcast->priority ?? 'medium',
            'category' => 'announcement',
            'is_broadcast' => true,
            'is_read' => false,
            'broadcast_starts_at' => $broadcast->broadcast_starts_at,
            'broadcast_ends_at' => $broadcast->broadcast_ends_at,
            'delivery_channels' => ['in_app'],
        ]);

        $shouldSendPush = !($notification->broadcast_starts_at && $notification->broadcast_starts_at->isFuture());

        if ($shouldSendPush) {
            app()->make('App\\Services\\PushNotificationService')->sendNotification($notification);
        }

        return response()->json($broadcast, 201);
    }

    public function show(Broadcast $broadcast): JsonResponse
    {
        return response()->json($broadcast);
    }

    public function update(Request $request, Broadcast $broadcast): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'message' => ['nullable', 'string'],
            'priority' => ['sometimes', 'in:low,medium,high,critical'],
            'broadcast_starts_at' => ['nullable', 'date'],
            'broadcast_ends_at' => ['nullable', 'date', 'after_or_equal:broadcast_starts_at'],
        ]);

        $broadcast->update($validated);

        return response()->json($broadcast);
    }

    public function destroy(Broadcast $broadcast): JsonResponse
    {
        $broadcast->delete();

        return response()->json(null, 204);
    }
}
