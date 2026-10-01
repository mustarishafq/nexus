<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use App\Models\UserTodo;
use App\Support\ApiTokenAuth;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    use AppliesIndexQuery;

    private const CRITICAL_TYPES = ['error', 'critical'];

    public function index(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $query = Notification::query();
        $this->scopeToAuthenticatedUser($query, $user, $request);

        $query = $this->applyIndexQuery(
            $request,
            $query,
            ['system_id', 'type', 'priority', 'category', 'is_read', 'is_broadcast'],
            '-created_at',
            null,
        );

        if ($request->boolean('exclude_broadcasts')) {
            $query->where('is_broadcast', false);
        }

        if ($request->boolean('exclude_direct_messages')) {
            $query->where(function (Builder $inner) {
                $inner->whereNull('data')
                    ->orWhereNull('data->kind')
                    ->orWhere('data->kind', '!=', 'direct_message');
            });
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

        $limit = max(1, min((int) $request->query('limit', 50), 200));

        if ($request->filled('before_id')) {
            $query->where('id', '<', (int) $request->query('before_id'));
        }

        $items = $query->limit($limit)->get();

        return response()->json($items);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json(['count' => $this->personalUnreadQuery($user)->count()]);
    }

    /**
     * Per-tab totals for the notification panel: all, unread, and critical (error or critical type).
     */
    public function counts(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'type' => ['nullable', Rule::in(['info', 'success', 'warning', 'error', 'critical'])],
            'category' => ['nullable', 'string', 'max:50'],
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $all = $this->personalQuery($user)->count();
        $unread = $this->personalUnreadQuery($user)->count();
        $filtered = ['all' => $all, 'unread' => $unread];

        // Notification Center filters (type, category, search) narrow the "filtered" totals only.
        if (filled($validated['type'] ?? null) || filled($validated['category'] ?? null) || filled($validated['search'] ?? null)) {
            $matching = fn () => $this->personalQuery($user)
                ->when(filled($validated['type'] ?? null), fn (Builder $q) => $q->where('type', $validated['type']))
                ->when(filled($validated['category'] ?? null), fn (Builder $q) => $q->where('category', $validated['category']))
                ->when(filled($validated['search'] ?? null), function (Builder $q) use ($validated) {
                    $term = '%'.addcslashes($validated['search'], '\\%_').'%';
                    $q->where(fn (Builder $inner) => $inner->where('title', 'like', $term)->orWhere('message', 'like', $term));
                });

            $filtered = [
                'all' => $matching()->count(),
                'unread' => $matching()->where('is_read', false)->count(),
            ];
        }

        return response()->json([
            'all' => $all,
            'unread' => $unread,
            'critical' => $this->personalQuery($user)->whereIn('type', self::CRITICAL_TYPES)->count(),
            'filtered' => $filtered,
        ]);
    }

    /**
     * Mark every unread personal notification as read, not just the page the client has loaded.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $readAt = now();
        $updated = 0;

        // Bulk updates skip NotificationObserver, so complete the linked todos here.
        $this->personalUnreadQuery($user)->chunkById(500, function ($notifications) use ($readAt, &$updated) {
            $ids = $notifications->pluck('id');

            $updated += Notification::query()
                ->whereIn('id', $ids)
                ->update(['is_read' => true, 'read_at' => $readAt, 'updated_at' => $readAt]);

            UserTodo::query()
                ->whereIn('notification_id', $ids)
                ->whereNull('completed_at')
                ->update(['completed_at' => $readAt]);
        });

        return response()->json(['updated' => $updated]);
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
            'category' => ['sometimes', Rule::in(['booking', 'hr', 'inventory', 'finance', 'security', 'system', 'task', 'approval', 'announcement', 'calendar', 'other'])],
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

    public function show(Request $request, Notification $notification): JsonResponse
    {
        if ($response = $this->authorizeNotification($request, $notification)) {
            return $response;
        }

        return response()->json($notification);
    }

    public function update(Request $request, Notification $notification): JsonResponse
    {
        if ($response = $this->authorizeNotification($request, $notification)) {
            return $response;
        }

        $validated = $request->validate([
            'user_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'system_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'type' => ['sometimes', Rule::in(['info', 'success', 'warning', 'error', 'critical'])],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'critical'])],
            'title' => ['sometimes', 'string', 'max:255'],
            'message' => ['sometimes', 'nullable', 'string'],
            'data' => ['sometimes', 'nullable', 'array'],
            'category' => ['sometimes', Rule::in(['booking', 'hr', 'inventory', 'finance', 'security', 'system', 'task', 'approval', 'announcement', 'calendar', 'other'])],
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

    public function destroy(Request $request, Notification $notification): JsonResponse
    {
        if ($response = $this->authorizeNotification($request, $notification)) {
            return $response;
        }

        $notification->delete();

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

    private function scopeToAuthenticatedUser(Builder $query, User $user, Request $request): void
    {
        $query->where(function (Builder $inner) use ($user, $request) {
            $inner->where(function (Builder $personal) use ($user) {
                $personal
                    ->where('is_broadcast', false)
                    ->whereIn('user_id', $this->userIdentifiers($user));
            });

            if (! $request->boolean('exclude_broadcasts')) {
                $inner->orWhere('is_broadcast', true);
            }
        });
    }

    /**
     * Notifications shown in the bell panel: personal only, excluding broadcasts and direct messages.
     */
    private function personalQuery(User $user): Builder
    {
        return Notification::query()
            ->where('is_broadcast', false)
            ->whereIn('user_id', $this->userIdentifiers($user))
            ->where(function (Builder $inner) {
                $inner->whereNull('data')
                    ->orWhereNull('data->kind')
                    ->orWhere('data->kind', '!=', 'direct_message');
            });
    }

    private function personalUnreadQuery(User $user): Builder
    {
        return $this->personalQuery($user)->where('is_read', false);
    }

    /**
     * @return array<int, string>
     */
    private function userIdentifiers(User $user): array
    {
        return array_values(array_unique(array_filter([
            (string) $user->id,
            $user->email,
        ])));
    }

    private function authorizeNotification(Request $request, Notification $notification): ?JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($notification->is_broadcast) {
            return null;
        }

        if (! in_array((string) $notification->user_id, $this->userIdentifiers($user), true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
    }
}
