<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuthToken;
use App\Models\OAuthClient;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ApiTokenController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $tokens = AuthToken::query()
            ->with('user:id,name,full_name,email,role,mcp_access')
            ->where(function ($query) {
                $query->whereNotNull('label')
                    ->orWhereNotNull('oauth_client_id');
            })
            ->orderByDesc('created_at')
            ->get();

        $manual = $tokens->filter(fn (AuthToken $token) => $token->oauth_client_id === null);
        $oauth = $tokens
            ->filter(fn (AuthToken $token) => $token->oauth_client_id !== null)
            ->groupBy(fn (AuthToken $token) => $token->user_id.'|'.$token->oauth_client_id)
            ->map(fn ($group) => $group->sortByDesc(fn (AuthToken $token) => $token->last_used_at ?? $token->created_at)->first())
            ->values();

        $items = $manual
            ->concat($oauth)
            ->sortByDesc('created_at')
            ->values()
            ->map(fn (AuthToken $token) => $this->serializeToken($token));

        return response()->json(['items' => $items]);
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
            ->with('user:id,name,full_name,email,role,mcp_access')
            ->firstOrFail();

        return response()->json([
            'token' => $plainToken,
            'item' => $this->serializeToken($authToken),
        ], 201);
    }

    public function updateUserMcpAccess(Request $request, User $user): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'mcp_access' => ['required', 'string', Rule::in(McpUserAccess::LEVELS)],
        ]);

        $user->forceFill(['mcp_access' => $validated['mcp_access']])->save();

        return response()->json([
            'user_id' => $user->id,
            'mcp_access' => $user->mcp_access,
        ]);
    }

    public function destroy(Request $request, AuthToken $apiToken): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        if ($apiToken->label === null && $apiToken->oauth_client_id === null) {
            return response()->json(['message' => 'Only managed API tokens can be revoked here.'], 422);
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
            'label' => $token->label ?: ($token->oauth_client_id ? 'MCP connection' : null),
            'source' => $token->oauth_client_id ? 'oauth' : 'manual',
            'oauth_client_id' => $token->oauth_client_id,
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->full_name ?: $user->name ?: $user->email,
                'email' => $user->email,
                'role' => $user->role,
                'mcp_access' => McpUserAccess::effectiveLevel($user),
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
