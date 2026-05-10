<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ConnectedSystem;
use App\Models\User;
use App\Models\UserSystemAccess;
use App\Support\ApiTokenAuth;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

class ConnectedSystemController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $query = $this->applyIndexQuery(
            $request,
            ConnectedSystem::query(),
            ['slug', 'status', 'is_enabled', 'auth_mode', 'visibility']
        )->with('creator');

        if ($user->role !== 'admin') {
            $accessRecord = UserSystemAccess::query()->where('user_email', $user->email)->first();
            $allowedPublicSlugs = $accessRecord ? array_values(array_filter((array) $accessRecord->allowed_system_slugs, fn ($slug) => is_string($slug) && $slug !== '')) : null;

            $query->where(function ($systems) use ($user, $allowedPublicSlugs) {
                $systems->where(function ($publicSystems) use ($allowedPublicSlugs) {
                    $publicSystems->where('visibility', 'public');
                    if ($allowedPublicSlugs !== null) {
                        if (count($allowedPublicSlugs) === 0) {
                            $publicSystems->whereRaw('1 = 0');
                        } else {
                            $publicSystems->whereIn('slug', $allowedPublicSlugs);
                        }
                    }
                })->orWhere(function ($privateSystems) use ($user) {
                    $privateSystems
                        ->where('visibility', 'private')
                        ->where(function ($privateAccess) use ($user) {
                            $privateAccess
                                ->where('created_by_user_id', $user->id)
                                ->orWhereJsonContains('private_allowed_user_emails', $user->email);
                        });
                });
            });
        }

        $items = $query->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:connected_systems,slug'],
            'description' => ['nullable', 'string'],
            'base_url' => ['nullable', 'string', 'max:2048'],
            'icon_url' => ['nullable', 'string', 'max:2048'],
            'status' => ['sometimes', Rule::in(['online', 'offline', 'maintenance', 'degraded'])],
            'api_key' => ['nullable', 'string', 'max:255'],
            'auth_mode' => ['sometimes', Rule::in(['jwt', 'redirect'])],
            'visibility' => ['sometimes', Rule::in(['public', 'private'])],
            'private_allowed_user_emails' => ['nullable', 'array'],
            'private_allowed_user_emails.*' => ['email', 'max:255'],
            'is_enabled' => ['sometimes', 'boolean'],
            'last_heartbeat' => ['nullable', 'date'],
            'notification_config' => ['nullable', 'array'],
            'color' => ['nullable', 'string', 'max:20'],
        ]);

        $validated['created_by_user_id'] = $user->id;
        if ($user->role !== 'admin') {
            $validated['visibility'] = 'private';
        }
        $validated['private_allowed_user_emails'] = $this->normalizePrivateEmails($validated['private_allowed_user_emails'] ?? null, $user->email);
        if (($validated['visibility'] ?? 'public') !== 'private') {
            $validated['private_allowed_user_emails'] = null;
        }

        $item = ConnectedSystem::create($validated);

        return response()->json($item->load('creator'), 201);
    }

    public function show(ConnectedSystem $connectedSystem): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest(request());

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canViewSystem($user, $connectedSystem)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($connectedSystem->load('creator'));
    }

    public function update(Request $request, ConnectedSystem $connectedSystem): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canEditSystem($user, $connectedSystem)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

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
            'auth_mode' => ['sometimes', Rule::in(['jwt', 'redirect'])],
            'visibility' => ['sometimes', Rule::in(['public', 'private'])],
            'private_allowed_user_emails' => ['nullable', 'array'],
            'private_allowed_user_emails.*' => ['email', 'max:255'],
            'is_enabled' => ['sometimes', 'boolean'],
            'last_heartbeat' => ['nullable', 'date'],
            'notification_config' => ['nullable', 'array'],
            'color' => ['nullable', 'string', 'max:20'],
        ]);

        if ($user->role !== 'admin') {
            $validated = Arr::except($validated, ['visibility']);
        }

        if (array_key_exists('private_allowed_user_emails', $validated)) {
            $validated['private_allowed_user_emails'] = $this->normalizePrivateEmails($validated['private_allowed_user_emails'], $user->email);
        }

        $nextVisibility = $validated['visibility'] ?? $connectedSystem->visibility;
        if ($nextVisibility !== 'private') {
            $validated['private_allowed_user_emails'] = null;
        }

        $connectedSystem->update($validated);

        return response()->json($connectedSystem->fresh()->load('creator'));
    }

    public function destroy(ConnectedSystem $connectedSystem): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest(request());

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canEditSystem($user, $connectedSystem)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $connectedSystem->delete();

        return response()->json([], 204);
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
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canViewSystem($user, $connectedSystem)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! $connectedSystem->is_enabled) {
            return response()->json(['message' => 'System is not enabled.'], 403);
        }

        if (! $connectedSystem->base_url) {
            return response()->json(['message' => 'System has no base URL configured.'], 422);
        }

        $returnTo = rtrim((string) config('app.url'), '/') . '/systems';

        if ($connectedSystem->auth_mode === 'redirect') {
            $launchUrl = rtrim($connectedSystem->base_url, '/');

            ActivityLog::create([
                'user_id'     => (string) $user->id,
                'user_name'   => $user->full_name ?? $user->name ?? $user->email,
                'system_id'   => $connectedSystem->slug,
                'action'      => 'view',
                'description' => 'Opened redirect link for ' . $connectedSystem->name,
                'ip_address'  => $request->ip(),
            ]);

            return response()->json([
                'launch_url' => $launchUrl,
                'auth_mode'  => 'redirect',
                'open_in_new_tab' => true,
            ]);
        }

        if (! $connectedSystem->api_key) {
            return response()->json(['message' => 'System has no api_key configured — cannot sign token.'], 422);
        }

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
            'auth_mode'  => 'jwt',
        ]);
    }

    private function canEditSystem(User $user, ConnectedSystem $connectedSystem): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return (int) $connectedSystem->created_by_user_id === (int) $user->id;
    }

    private function canViewSystem(User $user, ConnectedSystem $connectedSystem): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        if ($connectedSystem->visibility === 'private') {
            if ((int) $connectedSystem->created_by_user_id === (int) $user->id) {
                return true;
            }

            $allowedEmails = array_values(array_filter((array) $connectedSystem->private_allowed_user_emails, fn ($email) => is_string($email) && $email !== ''));

            return in_array($user->email, $allowedEmails, true);
        }

        $accessRecord = UserSystemAccess::query()->where('user_email', $user->email)->first();

        if (! $accessRecord) {
            return true;
        }

        $allowedPublicSlugs = array_values(array_filter((array) $accessRecord->allowed_system_slugs, fn ($slug) => is_string($slug) && $slug !== ''));

        return in_array($connectedSystem->slug, $allowedPublicSlugs, true);
    }

    private function normalizePrivateEmails(?array $emails, string $ownerEmail): array
    {
        $normalized = [];

        foreach ((array) $emails as $email) {
            if (! is_string($email)) {
                continue;
            }

            $clean = strtolower(trim($email));

            if ($clean === '' || $clean === strtolower(trim($ownerEmail))) {
                continue;
            }

            $normalized[$clean] = $clean;
        }

        return array_values($normalized);
    }
}
