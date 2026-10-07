<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Api\Nexus\V1\BroadcastController as NexusV1BroadcastController;
use App\Http\Controllers\Controller;
use App\Models\Broadcast;
use App\Models\Notification;
use App\Support\ApiTokenAuth;
use App\Support\BroadcastAudience;
use App\Support\PermissionCatalog;
use App\Support\SyncAssignmentRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BroadcastController extends Controller
{
    use AppliesIndexQuery;
    use AuthorizesRoles;

    public function index(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user?->is_approved) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $request->boolean('active_only')) {
            if ($response = $this->authorizePermission($request, PermissionCatalog::BROADCAST_MANAGE)) {
                return $response;
            }
        }

        $query = Broadcast::query()->with(['assignedUsers', 'assignedDepartments', 'application:id,name,slug,notification_config']);

        if ($request->boolean('active_only')) {
            $query->active();
            BroadcastAudience::scopeVisibleToUser($query, $user);
        }

        $items = $this->applyIndexQuery(
            $request,
            $query,
            ['priority', 'audience_type'],
            'created_at'
        )->get();

        if ($request->boolean('active_only')) {
            // An application that may no longer broadcast takes its open ones down with it.
            $items = $items->reject(
                fn (Broadcast $b) => $b->application_id !== null
                    && (! $b->application || ! NexusV1BroadcastController::broadcastsEnabled($b->application))
            )->values();
        }

        // Which application raised it, by name only — never its settings.
        $items->each(fn (Broadcast $b) => $b->application?->setVisible(['id', 'name', 'slug']));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::BROADCAST_MANAGE)) {
            return $response;
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string'],
            // Optional reference link (e.g. a Google Form); the announcement gets an Open button to it.
            'action_url' => ['nullable', 'url:http,https', 'max:2048'],
            'priority' => ['sometimes', 'in:low,medium,high,critical'],
            'audience_type' => ['sometimes', Rule::in([
                Broadcast::AUDIENCE_ALL,
                Broadcast::AUDIENCE_DEPARTMENT,
                Broadcast::AUDIENCE_INDIVIDUAL,
            ])],
            'user_ids' => ['required_if:audience_type,'.Broadcast::AUDIENCE_INDIVIDUAL, 'array', 'min:1'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'department_ids' => ['required_if:audience_type,'.Broadcast::AUDIENCE_DEPARTMENT, 'array', 'min:1'],
            'department_ids.*' => ['integer', 'exists:departments,id'],
            'broadcast_starts_at' => ['nullable', 'date'],
            'broadcast_ends_at' => ['nullable', 'date', 'after_or_equal:broadcast_starts_at'],
        ]);

        $validated['audience_type'] = $validated['audience_type'] ?? Broadcast::AUDIENCE_ALL;
        $userIds = $validated['user_ids'] ?? null;
        $departmentIds = $validated['department_ids'] ?? null;
        unset($validated['user_ids'], $validated['department_ids']);

        $broadcast = Broadcast::create($validated);
        $this->syncAudience($broadcast, $userIds, $departmentIds);

        $notification = Notification::create([
            'title' => $broadcast->title,
            'message' => $broadcast->message,
            'type' => 'info',
            'priority' => $broadcast->priority ?? 'medium',
            'category' => 'announcement',
            'is_broadcast' => true,
            'broadcast_id' => $broadcast->id,
            'is_read' => false,
            'broadcast_starts_at' => $broadcast->broadcast_starts_at,
            'broadcast_ends_at' => $broadcast->broadcast_ends_at,
            'delivery_channels' => ['in_app'],
        ]);

        $shouldSendPush = !($notification->broadcast_starts_at && $notification->broadcast_starts_at->isFuture());

        if ($shouldSendPush) {
            app()->make('App\\Services\\PushNotificationService')->sendNotification($notification);
        }

        return response()->json($broadcast->fresh()->load(['assignedUsers', 'assignedDepartments']), 201);
    }

    public function show(Request $request, Broadcast $broadcast): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::BROADCAST_MANAGE)) {
            return $response;
        }

        return response()->json($broadcast->load(['assignedUsers', 'assignedDepartments']));
    }

    public function update(Request $request, Broadcast $broadcast): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::BROADCAST_MANAGE)) {
            return $response;
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'message' => ['nullable', 'string'],
            // Optional reference link (e.g. a Google Form); the announcement gets an Open button to it.
            'action_url' => ['nullable', 'url:http,https', 'max:2048'],
            'priority' => ['sometimes', 'in:low,medium,high,critical'],
            'audience_type' => ['sometimes', Rule::in([
                Broadcast::AUDIENCE_ALL,
                Broadcast::AUDIENCE_DEPARTMENT,
                Broadcast::AUDIENCE_INDIVIDUAL,
            ])],
            'user_ids' => ['required_if:audience_type,'.Broadcast::AUDIENCE_INDIVIDUAL, 'array', 'min:1'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'department_ids' => ['required_if:audience_type,'.Broadcast::AUDIENCE_DEPARTMENT, 'array', 'min:1'],
            'department_ids.*' => ['integer', 'exists:departments,id'],
            'broadcast_starts_at' => ['nullable', 'date'],
            'broadcast_ends_at' => ['nullable', 'date', 'after_or_equal:broadcast_starts_at'],
        ]);

        $userIds = array_key_exists('user_ids', $validated) ? $validated['user_ids'] : null;
        $departmentIds = array_key_exists('department_ids', $validated) ? $validated['department_ids'] : null;
        unset($validated['user_ids'], $validated['department_ids']);

        $broadcast->update($validated);

        $audienceType = $validated['audience_type'] ?? $broadcast->audience_type;
        if ($userIds !== null || $departmentIds !== null || array_key_exists('audience_type', $validated)) {
            $this->syncAudience(
                $broadcast,
                $audienceType === Broadcast::AUDIENCE_INDIVIDUAL ? ($userIds ?? $broadcast->assignedUserIdList()) : [],
                $audienceType === Broadcast::AUDIENCE_DEPARTMENT ? ($departmentIds ?? $broadcast->assignedDepartmentIdList()) : [],
                $audienceType
            );
        }

        return response()->json($broadcast->fresh()->load(['assignedUsers', 'assignedDepartments']));
    }

    public function destroy(Request $request, Broadcast $broadcast): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::BROADCAST_MANAGE)) {
            return $response;
        }

        $broadcast->delete();

        return response()->json(null, 204);
    }

    /**
     * @param  array<int, int|string>|null  $userIds
     * @param  array<int, int|string>|null  $departmentIds
     */
    private function syncAudience(
        Broadcast $broadcast,
        ?array $userIds,
        ?array $departmentIds,
        ?string $audienceType = null,
    ): void {
        $audienceType ??= $broadcast->audience_type;

        if ($audienceType === Broadcast::AUDIENCE_INDIVIDUAL) {
            SyncAssignmentRecords::syncBroadcastUsers($broadcast, $userIds ?? []);
            SyncAssignmentRecords::syncBroadcastDepartments($broadcast, []);
            return;
        }

        if ($audienceType === Broadcast::AUDIENCE_DEPARTMENT) {
            SyncAssignmentRecords::syncBroadcastDepartments($broadcast, $departmentIds ?? []);
            SyncAssignmentRecords::syncBroadcastUsers($broadcast, []);
            return;
        }

        SyncAssignmentRecords::syncBroadcastUsers($broadcast, []);
        SyncAssignmentRecords::syncBroadcastDepartments($broadcast, []);
    }
}
