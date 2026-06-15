<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\MetabaseDashboard;
use App\Support\ApiTokenAuth;
use App\Support\SyncAssignmentRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MetabaseDashboardController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $query = MetabaseDashboard::query();

        if ($request->boolean('admin') && $user->role === 'admin') {
            $items = $this->applyIndexQuery(
                $request,
                $query->with(['assignedAccessGroups', 'assignedUsers']),
                ['name', 'sort_order', 'is_enabled', 'assignment_type', 'category'],
                'sort_order'
            )->get();

            return response()->json($items);
        }

        $query->where('is_enabled', true);

        if ($user->role !== 'admin') {
            $userGroupIds = $user->accessGroups()
                ->pluck('access_groups.id')
                ->map(fn ($id) => (int) $id)
                ->all();

            $query->where(function ($outer) use ($user, $userGroupIds) {
                $outer->orWhere('owner_user_id', $user->id);

                $outer->orWhere(function ($inner) use ($user) {
                    $inner->where('assignment_type', MetabaseDashboard::ASSIGNMENT_INDIVIDUAL)
                        ->whereHas('assignedUsers', fn ($assigned) => $assigned->where('users.id', $user->id));
                });

                if ($userGroupIds !== []) {
                    $outer->orWhere(function ($inner) use ($userGroupIds) {
                        $inner->where('assignment_type', MetabaseDashboard::ASSIGNMENT_GROUP)
                            ->whereHas('assignedAccessGroups', fn ($assigned) => $assigned->whereIn('access_groups.id', $userGroupIds));
                    });
                }
            });
        }

        $items = $this->applyIndexQuery(
            $request,
            $query->with(['assignedAccessGroups', 'assignedUsers']),
            ['name', 'sort_order', 'category'],
            'sort_order'
        )->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role === 'admin') {
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'public_url' => ['required', 'url', 'max:2048', 'regex:/^https?:\/\//i'],
                'assignment_type' => ['required', Rule::in([
                    MetabaseDashboard::ASSIGNMENT_GROUP,
                    MetabaseDashboard::ASSIGNMENT_INDIVIDUAL,
                ])],
                'access_group_ids' => ['required_if:assignment_type,'.MetabaseDashboard::ASSIGNMENT_GROUP, 'array', 'min:1'],
                'access_group_ids.*' => ['integer', 'exists:access_groups,id'],
                'user_ids' => ['required_if:assignment_type,'.MetabaseDashboard::ASSIGNMENT_INDIVIDUAL, 'array', 'min:1'],
                'user_ids.*' => ['integer', 'exists:users,id'],
                'category' => ['nullable', 'string', 'max:100'],
                'is_enabled' => ['sometimes', 'boolean'],
                'sort_order' => ['sometimes', 'integer', 'min:0'],
            ]);

            $validated = $this->normalizeAdminPayload($validated);
            $accessGroupIds = $validated['access_group_ids'] ?? null;
            $userIds = $validated['user_ids'] ?? null;
            unset($validated['access_group_ids'], $validated['user_ids']);
        } else {
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'public_url' => ['required', 'url', 'max:2048', 'regex:/^https?:\/\//i'],
                'category' => ['nullable', 'string', 'max:100'],
                'sort_order' => ['sometimes', 'integer', 'min:0'],
            ]);

            $validated['assignment_type'] = MetabaseDashboard::ASSIGNMENT_INDIVIDUAL;
            $validated['owner_user_id'] = $user->id;
            $validated['is_enabled'] = true;
            $validated['category'] = $this->normalizeCategory($validated['category'] ?? null);
            $accessGroupIds = null;
            $userIds = null;
        }

        $dashboard = MetabaseDashboard::create($validated);

        if ($user->role === 'admin') {
            if ($validated['assignment_type'] === MetabaseDashboard::ASSIGNMENT_GROUP) {
                SyncAssignmentRecords::syncMetabaseDashboardAccessGroups($dashboard, $accessGroupIds ?? []);
            } else {
                SyncAssignmentRecords::syncMetabaseDashboardUsers($dashboard, $userIds ?? []);
            }
        }

        return response()->json($dashboard->fresh()->load(['assignedAccessGroups', 'assignedUsers']), 201);
    }

    public function show(Request $request, MetabaseDashboard $metabaseDashboard): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'admin' && ! $this->userCanViewDashboard($user, $metabaseDashboard)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($metabaseDashboard->load(['assignedAccessGroups', 'assignedUsers']));
    }

    public function update(Request $request, MetabaseDashboard $metabaseDashboard): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $accessGroupIds = null;
        $userIds = null;
        $shouldSyncAssignments = false;

        if ($user->role === 'admin') {
            if ($metabaseDashboard->owner_user_id !== null) {
                $validated = $request->validate([
                    'name' => ['sometimes', 'string', 'max:255'],
                    'public_url' => ['sometimes', 'url', 'max:2048', 'regex:/^https?:\/\//i'],
                    'category' => ['sometimes', 'nullable', 'string', 'max:100'],
                    'is_enabled' => ['sometimes', 'boolean'],
                    'sort_order' => ['sometimes', 'integer', 'min:0'],
                ]);

                if (array_key_exists('category', $validated)) {
                    $validated['category'] = $this->normalizeCategory($validated['category']);
                }

                $metabaseDashboard->update($validated);

                return response()->json($metabaseDashboard->fresh()->load(['assignedAccessGroups', 'assignedUsers']));
            }

            $metabaseDashboard->load(['assignedAccessGroups', 'assignedUsers']);

            $validated = $request->validate([
                'name' => ['sometimes', 'string', 'max:255'],
                'public_url' => ['sometimes', 'url', 'max:2048', 'regex:/^https?:\/\//i'],
                'assignment_type' => ['sometimes', Rule::in([
                    MetabaseDashboard::ASSIGNMENT_GROUP,
                    MetabaseDashboard::ASSIGNMENT_INDIVIDUAL,
                ])],
                'access_group_ids' => ['sometimes', 'array', 'min:1'],
                'access_group_ids.*' => ['integer', Rule::exists('access_groups', 'id')],
                'user_ids' => ['sometimes', 'array', 'min:1'],
                'user_ids.*' => ['integer', Rule::exists('users', 'id')],
                'category' => ['sometimes', 'nullable', 'string', 'max:100'],
                'is_enabled' => ['sometimes', 'boolean'],
                'sort_order' => ['sometimes', 'integer', 'min:0'],
            ]);

            $assignmentType = $validated['assignment_type'] ?? $metabaseDashboard->assignment_type;

            if ($assignmentType === MetabaseDashboard::ASSIGNMENT_GROUP) {
                if (array_key_exists('access_group_ids', $validated) && $validated['access_group_ids'] === []) {
                    return response()->json(['message' => 'Select at least one access group.'], 422);
                }
                if (! array_key_exists('access_group_ids', $validated) && ($metabaseDashboard->access_group_ids ?? []) === []) {
                    return response()->json(['message' => 'Select at least one access group.'], 422);
                }
            }

            if ($assignmentType === MetabaseDashboard::ASSIGNMENT_INDIVIDUAL && $metabaseDashboard->owner_user_id === null) {
                if (array_key_exists('user_ids', $validated) && $validated['user_ids'] === []) {
                    return response()->json(['message' => 'Select at least one user.'], 422);
                }
                if (! array_key_exists('user_ids', $validated) && ($metabaseDashboard->user_ids ?? []) === []) {
                    return response()->json(['message' => 'Select at least one user.'], 422);
                }
            }

            $normalized = $this->normalizeAdminPayload(
                array_merge([
                    'assignment_type' => $metabaseDashboard->assignment_type,
                    'access_group_ids' => $metabaseDashboard->accessGroupIdList(),
                    'user_ids' => $metabaseDashboard->assignedUserIdList(),
                    'category' => $metabaseDashboard->category,
                ], $validated)
            );

            $accessGroupIds = $normalized['access_group_ids'] ?? null;
            $userIds = $normalized['user_ids'] ?? null;
            unset($normalized['access_group_ids'], $normalized['user_ids']);

            $validated = $normalized;
            $shouldSyncAssignments = true;
        } else {
            if ((int) $metabaseDashboard->owner_user_id !== (int) $user->id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $validated = $request->validate([
                'name' => ['sometimes', 'string', 'max:255'],
                'public_url' => ['sometimes', 'url', 'max:2048', 'regex:/^https?:\/\//i'],
                'category' => ['sometimes', 'nullable', 'string', 'max:100'],
                'sort_order' => ['sometimes', 'integer', 'min:0'],
            ]);

            if (array_key_exists('category', $validated)) {
                $validated['category'] = $this->normalizeCategory($validated['category']);
            }
        }

        $metabaseDashboard->update($validated);

        if ($shouldSyncAssignments) {
            if (($validated['assignment_type'] ?? $metabaseDashboard->assignment_type) === MetabaseDashboard::ASSIGNMENT_GROUP) {
                SyncAssignmentRecords::syncMetabaseDashboardAccessGroups($metabaseDashboard, $accessGroupIds ?? []);
                SyncAssignmentRecords::syncMetabaseDashboardUsers($metabaseDashboard, []);
            } else {
                SyncAssignmentRecords::syncMetabaseDashboardUsers($metabaseDashboard, $userIds ?? []);
                SyncAssignmentRecords::syncMetabaseDashboardAccessGroups($metabaseDashboard, []);
            }
        }

        return response()->json($metabaseDashboard->fresh()->load(['assignedAccessGroups', 'assignedUsers']));
    }

    public function destroy(Request $request, MetabaseDashboard $metabaseDashboard): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'admin' && (int) $metabaseDashboard->owner_user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $metabaseDashboard->delete();

        return response()->noContent();
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function normalizeAdminPayload(array $payload): array
    {
        $assignmentType = $payload['assignment_type'] ?? MetabaseDashboard::ASSIGNMENT_GROUP;
        $payload['assignment_type'] = $assignmentType;
        $payload['category'] = $this->normalizeCategory($payload['category'] ?? null);

        if ($assignmentType === MetabaseDashboard::ASSIGNMENT_GROUP) {
            $payload['access_group_ids'] = $this->normalizeIdList($payload['access_group_ids'] ?? []);
            $payload['user_ids'] = null;
            $payload['owner_user_id'] = null;
        } else {
            $payload['user_ids'] = $this->normalizeIdList($payload['user_ids'] ?? []);
            $payload['access_group_ids'] = null;
            $payload['owner_user_id'] = null;
        }

        return $payload;
    }

    /**
     * @param  array<int, int|string>  $ids
     * @return array<int, int>
     */
    private function normalizeIdList(array $ids): array
    {
        return array_values(array_unique(array_map('intval', $ids)));
    }

    private function normalizeCategory(?string $category): ?string
    {
        if ($category === null) {
            return null;
        }

        $trimmed = trim($category);

        return $trimmed === '' ? null : $trimmed;
    }

    private function userCanViewDashboard($user, MetabaseDashboard $dashboard): bool
    {
        if (! $dashboard->is_enabled) {
            return false;
        }

        if ($dashboard->owner_user_id && (int) $dashboard->owner_user_id === (int) $user->id) {
            return true;
        }

        if ($dashboard->assignment_type === MetabaseDashboard::ASSIGNMENT_INDIVIDUAL) {
            $dashboard->loadMissing('assignedUsers');

            return in_array((int) $user->id, $dashboard->assignedUserIdList(), true);
        }

        $dashboard->loadMissing('assignedAccessGroups');
        $allowedGroupIds = $dashboard->accessGroupIdList();
        if ($allowedGroupIds === []) {
            return false;
        }

        $userGroupIds = $user->accessGroups()
            ->pluck('access_groups.id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return count(array_intersect($allowedGroupIds, $userGroupIds)) > 0;
    }
}
