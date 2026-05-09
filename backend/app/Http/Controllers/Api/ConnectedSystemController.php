<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ConnectedSystem;
use App\Support\ApiTokenAuth;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ConnectedSystemController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $items = $this->applyIndexQuery(
            $request,
            ConnectedSystem::query(),
            ['slug', 'status', 'is_enabled']
        )->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:connected_systems,slug'],
            'description' => ['nullable', 'string'],
            'base_url' => ['nullable', 'string', 'max:2048'],
            'icon_url' => ['nullable', 'string', 'max:2048'],
            'status' => ['sometimes', Rule::in(['online', 'offline', 'maintenance', 'degraded'])],
            'api_key' => ['nullable', 'string', 'max:255'],
            'is_enabled' => ['sometimes', 'boolean'],
            'last_heartbeat' => ['nullable', 'date'],
            'notification_config' => ['nullable', 'array'],
            'color' => ['nullable', 'string', 'max:20'],
        ]);

        $item = ConnectedSystem::create($validated);

        return response()->json($item, 201);
    }

    public function show(ConnectedSystem $connectedSystem): JsonResponse
    {
        return response()->json($connectedSystem);
    }

    public function update(Request $request, ConnectedSystem $connectedSystem): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('connected_systems', 'slug')->ignore($connectedSystem->id),
            ],
            'description' => ['nullable', 'string'],
            'base_url' => ['nullable', 'string', 'max:2048'],
            'icon_url' => ['nullable', 'string', 'max:2048'],
            'status' => ['sometimes', Rule::in(['online', 'offline', 'maintenance', 'degraded'])],
            'api_key' => ['nullable', 'string', 'max:255'],
            'is_enabled' => ['sometimes', 'boolean'],
            'last_heartbeat' => ['nullable', 'date'],
            'notification_config' => ['nullable', 'array'],
            'color' => ['nullable', 'string', 'max:20'],
        ]);

        $connectedSystem->update($validated);

        return response()->json($connectedSystem->fresh());
    }

    public function destroy(ConnectedSystem $connectedSystem): JsonResponse
    {
        $connectedSystem->delete();

        return response()->json(status: 204);
    }

    /**
     * Generate a signed SSO launch URL for the connected system.
     *
     * The connected system should verify the JWT using the same api_key as the
     * secret, then log in the user identified by the `sub` (user id) and `email`
     * claims.  The token is valid for 60 seconds to prevent replay attacks.
     */
    public function launch(Request $request, ConnectedSystem $connectedSystem): JsonResponse
    {
        if (! $connectedSystem->is_enabled) {
            return response()->json(['message' => 'System is not enabled.'], 403);
        }

        if (! $connectedSystem->base_url) {
            return response()->json(['message' => 'System has no base URL configured.'], 422);
        }

        if (! $connectedSystem->api_key) {
            return response()->json(['message' => 'System has no api_key configured — cannot sign token.'], 422);
        }

        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $returnTo = rtrim((string) config('app.url'), '/') . '/systems';

        $now     = time();
        $payload = [
            'iss'   => config('app.url'),
            'iat'   => $now,
            'exp'   => $now + 60,
            'sub'   => (string) $user->id,
            'email' => $user->email,
            'name'  => $user->full_name ?? $user->name ?? '',
            'sys'   => $connectedSystem->slug,
            'return_to' => $returnTo,
        ];

        $token = JWT::encode($payload, $connectedSystem->api_key, 'HS256');

        $launchUrl = rtrim($connectedSystem->base_url, '/')
            . '/sso/nexus?token=' . urlencode($token)
            . '&return_to=' . urlencode($returnTo);

        ActivityLog::create([
            'user_id'     => (string) $user->id,
            'user_name'   => $user->full_name ?? $user->name ?? $user->email,
            'system_id'   => $connectedSystem->slug,
            'action'      => 'login',
            'description' => 'Launched / logged in to ' . $connectedSystem->name,
            'ip_address'  => $request->ip(),
        ]);

        return response()->json([
            'launch_url' => $launchUrl,
            'token'      => $token,
            'expires_in' => 60,
        ]);
    }
}
