<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuthToken;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApiTokenController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $tokens = AuthToken::query()
            ->with('user:id,name,full_name,email')
            ->whereNotNull('label')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (AuthToken $token) => $this->serializeToken($token));

        return response()->json(['items' => $tokens]);
    }

    public function store(Request $request): JsonResponse
    {
        $admin = ApiTokenAuth::userFromRequest($request);

        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'label' => ['required', 'string', 'max:120'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'expires_in_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $owner = isset($validated['user_id'])
            ? User::query()->findOrFail($validated['user_id'])
            : $admin;

        $expiresAt = isset($validated['expires_in_days'])
            ? now()->addDays((int) $validated['expires_in_days'])
            : null;

        $plainToken = ApiTokenAuth::issueToken($owner, [
            'label' => $validated['label'],
            'expires_at' => $expiresAt,
        ]);

        $authToken = AuthToken::query()
            ->where('user_id', $owner->id)
            ->where('token_hash', hash('sha256', $plainToken))
            ->with('user:id,name,full_name,email')
            ->firstOrFail();

        return response()->json([
            'token' => $plainToken,
            'item' => $this->serializeToken($authToken),
        ], 201);
    }

    public function destroy(Request $request, AuthToken $apiToken): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        if ($apiToken->label === null) {
            return response()->json(['message' => 'Only labeled API tokens can be revoked here.'], 422);
        }

        $apiToken->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeToken(AuthToken $token): array
    {
        $user = $token->user;

        return [
            'id' => $token->id,
            'label' => $token->label,
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->full_name ?: $user->name ?: $user->email,
                'email' => $user->email,
            ] : null,
            'last_used_at' => $token->last_used_at?->toIso8601String(),
            'expires_at' => $token->expires_at?->toIso8601String(),
            'created_at' => $token->created_at?->toIso8601String(),
            'is_expired' => $token->isExpired(),
        ];
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
