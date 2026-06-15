<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\UserSystemAccess;
use App\Support\ApiTokenAuth;
use App\Support\SyncAssignmentRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserSystemAccessController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $items = $this->applyIndexQuery(
            $request,
            UserSystemAccess::query()->with('allowedApplications'),
            ['user_email']
        )->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'user_email' => ['required', 'email', 'max:255', 'unique:user_system_accesses,user_email'],
            'allowed_system_slugs' => ['nullable', 'array'],
            'allowed_system_slugs.*' => [
                'string',
                'max:255',
                Rule::exists('applications', 'slug')->where(fn ($query) => $query->where('visibility', 'public')),
            ],
        ]);

        $allowedSlugs = $validated['allowed_system_slugs'] ?? null;
        unset($validated['allowed_system_slugs']);

        $item = UserSystemAccess::create($validated);
        SyncAssignmentRecords::syncUserSystemAccessApplications($item, $allowedSlugs);

        return response()->json($item->fresh()->load('allowedApplications'), 201);
    }

    public function show(UserSystemAccess $userSystemAccess): JsonResponse
    {
        if ($response = $this->authorizeAdmin(request())) {
            return $response;
        }

        return response()->json($userSystemAccess->load('allowedApplications'));
    }

    public function update(Request $request, UserSystemAccess $userSystemAccess): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'user_email' => ['sometimes', 'email', 'max:255', 'unique:user_system_accesses,user_email,'.$userSystemAccess->id],
            'allowed_system_slugs' => ['nullable', 'array'],
            'allowed_system_slugs.*' => [
                'string',
                'max:255',
                Rule::exists('applications', 'slug')->where(fn ($query) => $query->where('visibility', 'public')),
            ],
        ]);

        $allowedSlugs = array_key_exists('allowed_system_slugs', $validated) ? $validated['allowed_system_slugs'] : null;
        unset($validated['allowed_system_slugs']);

        $userSystemAccess->update($validated);

        if ($allowedSlugs !== null) {
            SyncAssignmentRecords::syncUserSystemAccessApplications($userSystemAccess, $allowedSlugs);
        }

        return response()->json($userSystemAccess->fresh()->load('allowedApplications'));
    }

    public function destroy(UserSystemAccess $userSystemAccess): JsonResponse
    {
        if ($response = $this->authorizeAdmin(request())) {
            return $response;
        }

        $userSystemAccess->allowedApplications()->detach();
        $userSystemAccess->delete();

        return response()->noContent();
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
