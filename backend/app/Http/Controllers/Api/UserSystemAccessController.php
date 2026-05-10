<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\UserSystemAccess;
use App\Support\ApiTokenAuth;
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
            UserSystemAccess::query(),
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
                Rule::exists('connected_systems', 'slug')->where(fn ($query) => $query->where('visibility', 'public')),
            ],
        ]);

        $item = UserSystemAccess::create($validated);

        return response()->json($item, 201);
    }

    public function show(UserSystemAccess $userSystemAccess): JsonResponse
    {
        if ($response = $this->authorizeAdmin(request())) {
            return $response;
        }

        return response()->json($userSystemAccess);
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
                Rule::exists('connected_systems', 'slug')->where(fn ($query) => $query->where('visibility', 'public')),
            ],
        ]);

        $userSystemAccess->update($validated);

        return response()->json($userSystemAccess->fresh());
    }

    public function destroy(UserSystemAccess $userSystemAccess): JsonResponse
    {
        if ($response = $this->authorizeAdmin(request())) {
            return $response;
        }

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
