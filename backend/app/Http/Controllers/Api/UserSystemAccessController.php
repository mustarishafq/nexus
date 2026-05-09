<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\UserSystemAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserSystemAccessController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $items = $this->applyIndexQuery(
            $request,
            UserSystemAccess::query(),
            ['user_email']
        )->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_email' => ['required', 'email', 'max:255', 'unique:user_system_accesses,user_email'],
            'allowed_system_slugs' => ['nullable', 'array'],
            'allowed_system_slugs.*' => ['string', 'max:255'],
        ]);

        $item = UserSystemAccess::create($validated);

        return response()->json($item, 201);
    }

    public function show(UserSystemAccess $userSystemAccess): JsonResponse
    {
        return response()->json($userSystemAccess);
    }

    public function update(Request $request, UserSystemAccess $userSystemAccess): JsonResponse
    {
        $validated = $request->validate([
            'user_email' => ['sometimes', 'email', 'max:255', 'unique:user_system_accesses,user_email,'.$userSystemAccess->id],
            'allowed_system_slugs' => ['nullable', 'array'],
            'allowed_system_slugs.*' => ['string', 'max:255'],
        ]);

        $userSystemAccess->update($validated);

        return response()->json($userSystemAccess->fresh());
    }

    public function destroy(UserSystemAccess $userSystemAccess): JsonResponse
    {
        $userSystemAccess->delete();

        return response()->json(status: 204);
    }
}
