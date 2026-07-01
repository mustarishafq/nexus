<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\AuthToken;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use App\Support\UserApplicationAccess;
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

    public function showUserMcpAccess(Request $request, User $user): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        return response()->json($this->serializeUserMcpAccess($user));
    }

    public function updateUserMcpAccess(Request $request, User $user): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'mcp_access' => ['required', 'string', Rule::in(McpUserAccess::LEVELS)],
            'application_overrides' => ['sometimes', 'array'],
            'application_overrides.*.application_id' => ['required', 'integer', 'exists:applications,id'],
            'application_overrides.*.mcp_access' => ['nullable', 'string', Rule::in(array_merge(McpUserAccess::LEVELS, ['inherit']))],
        ]);

        $user->forceFill(['mcp_access' => $validated['mcp_access']])->save();

        if (array_key_exists('application_overrides', $validated)) {
            McpUserAccess::syncApplicationOverrides($user, $validated['application_overrides']);
        }

        McpUserAccess::forgetCachedOverrides($user);

        return response()->json($this->serializeUserMcpAccess($user->fresh()));
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
                'has_application_overrides' => $user->applicationMcpAccess()->exists(),
            ] : null,
            'last_used_at' => $token->last_used_at?->toIso8601String(),
            'expires_at' => $token->expires_at?->toIso8601String(),
            'created_at' => $token->created_at?->toIso8601String(),
            'is_expired' => $token->isExpired(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUserMcpAccess(User $user): array
    {
        $user->loadMissing('applicationMcpAccess');
        $overridesByAppId = $user->applicationMcpAccess->keyBy('application_id');

        $applications = UserApplicationAccess::accessibleMcpApplicationsQuery($user)
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'icon_url', 'color'])
            ->map(fn (Application $application) => [
                'application_id' => $application->id,
                'slug' => $application->slug,
                'name' => $application->name,
                'icon_url' => $application->icon_url,
                'color' => $application->color,
                'override' => $overridesByAppId->get($application->id)?->mcp_access,
                'effective_mcp_access' => McpUserAccess::effectiveLevelForApplication($user, $application),
            ])
            ->values();

        return [
            'user_id' => $user->id,
            'mcp_access' => McpUserAccess::effectiveLevel($user),
            'has_application_overrides' => $user->applicationMcpAccess->isNotEmpty(),
            'applications' => $applications,
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
