<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\MetabaseDashboard;
use App\Support\ApiTokenAuth;
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
                $query,
                ['name', 'sort_order', 'is_enabled'],
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

            if ($userGroupIds === []) {
                return response()->json([]);
            }

            $query->where(function ($inner) use ($userGroupIds) {
                foreach ($userGroupIds as $groupId) {
                    $inner->orWhereJsonContains('access_group_ids', $groupId);
                }
            });
        }

        $items = $this->applyIndexQuery(
            $request,
            $query,
            ['name', 'sort_order'],
            'sort_order'
        )->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'public_url' => ['required', 'url', 'max:2048', 'regex:/^https?:\/\//i'],
            'access_group_ids' => ['required', 'array', 'min:1'],
            'access_group_ids.*' => ['integer', 'exists:access_groups,id'],
            'is_enabled' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $validated['access_group_ids'] = $this->normalizeGroupIds($validated['access_group_ids']);

        $dashboard = MetabaseDashboard::create($validated);

        return response()->json($dashboard, 201);
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

        return response()->json($metabaseDashboard);
    }

    public function update(Request $request, MetabaseDashboard $metabaseDashboard): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'public_url' => ['sometimes', 'url', 'max:2048', 'regex:/^https?:\/\//i'],
            'access_group_ids' => ['sometimes', 'array', 'min:1'],
            'access_group_ids.*' => ['integer', Rule::exists('access_groups', 'id')],
            'is_enabled' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        if (array_key_exists('access_group_ids', $validated)) {
            $validated['access_group_ids'] = $this->normalizeGroupIds($validated['access_group_ids']);
        }

        $metabaseDashboard->update($validated);

        return response()->json($metabaseDashboard->fresh());
    }

    public function destroy(Request $request, MetabaseDashboard $metabaseDashboard): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $metabaseDashboard->delete();

        return response()->noContent();
    }

    /**
     * @param  array<int, int|string>  $groupIds
     * @return array<int, int>
     */
    private function normalizeGroupIds(array $groupIds): array
    {
        return array_values(array_unique(array_map('intval', $groupIds)));
    }

    private function userCanViewDashboard($user, MetabaseDashboard $dashboard): bool
    {
        if (! $dashboard->is_enabled) {
            return false;
        }

        $allowedGroupIds = array_map('intval', $dashboard->access_group_ids ?? []);
        if ($allowedGroupIds === []) {
            return false;
        }

        $userGroupIds = $user->accessGroups()
            ->pluck('access_groups.id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return count(array_intersect($allowedGroupIds, $userGroupIds)) > 0;
    }

    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
    }
}
