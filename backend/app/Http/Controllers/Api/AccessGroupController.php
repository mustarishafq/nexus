<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\AccessGroup;
use App\Support\ApiTokenAuth;
use App\Support\SyncAssignmentRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccessGroupController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $items = $this->applyIndexQuery(
            $request,
            AccessGroup::query()->with('allowedApplications')->withCount('users'),
            ['name']
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
            'description' => ['nullable', 'string'],
            'allowed_system_slugs' => ['nullable', 'array'],
            'allowed_system_slugs.*' => [
                'string',
                'max:255',
                Rule::exists('applications', 'slug')->where(fn ($query) => $query->where('visibility', 'public')),
            ],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $userIds = $validated['user_ids'] ?? [];
        $allowedSlugs = $validated['allowed_system_slugs'] ?? null;
        unset($validated['user_ids'], $validated['allowed_system_slugs']);

        $group = AccessGroup::create($validated);
        SyncAssignmentRecords::syncAccessGroupApplications($group, $allowedSlugs);
        $group->users()->sync($this->normalizeUserIds($userIds));

        return response()->json($group->fresh()->load('allowedApplications')->loadCount('users'), 201);
    }

    public function show(AccessGroup $accessGroup): JsonResponse
    {
        if ($response = $this->authorizeAdmin(request())) {
            return $response;
        }

        return response()->json($accessGroup->load('allowedApplications')->loadCount('users'));
    }

    public function update(Request $request, AccessGroup $accessGroup): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'allowed_system_slugs' => ['nullable', 'array'],
            'allowed_system_slugs.*' => [
                'string',
                'max:255',
                Rule::exists('applications', 'slug')->where(fn ($query) => $query->where('visibility', 'public')),
            ],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $userIds = array_key_exists('user_ids', $validated) ? $validated['user_ids'] : null;
        $allowedSlugs = array_key_exists('allowed_system_slugs', $validated) ? $validated['allowed_system_slugs'] : null;
        unset($validated['user_ids'], $validated['allowed_system_slugs']);

        $accessGroup->update($validated);

        if ($allowedSlugs !== null) {
            SyncAssignmentRecords::syncAccessGroupApplications($accessGroup, $allowedSlugs);
        }

        if ($userIds !== null) {
            $accessGroup->users()->sync($this->normalizeUserIds($userIds));
        }

        return response()->json($accessGroup->fresh()->load('allowedApplications')->loadCount('users'));
    }

    public function destroy(AccessGroup $accessGroup): JsonResponse
    {
        if ($response = $this->authorizeAdmin(request())) {
            return $response;
        }

        $accessGroup->users()->detach();
        $accessGroup->allowedApplications()->detach();
        $accessGroup->delete();

        return response()->noContent();
    }

    /**
     * @param  array<int, int|string>  $userIds
     * @return array<int, int>
     */
    private function normalizeUserIds(array $userIds): array
    {
        return array_values(array_unique(array_map('intval', $userIds)));
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
