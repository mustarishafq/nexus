<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Application;
use App\Models\User;
use App\Models\UserSystemAccess;
use App\Support\ApiTokenAuth;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

class ApplicationController extends Controller
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
            Application::query(),
            ['slug', 'status', 'is_enabled', 'auth_mode', 'visibility'],
            'sort_order'
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
            'slug' => ['required', 'string', 'max:255', 'unique:applications,slug'],
            'description' => ['nullable', 'string'],
            'base_url' => ['nullable', 'string', 'max:2048'],
            'icon_url' => ['nullable', 'string', 'max:2048'],
            'status' => ['sometimes', Rule::in(['online', 'offline', 'maintenance', 'degraded'])],
            'api_key' => ['nullable', 'string', 'max:255'],
            'auth_mode' => ['sometimes', Rule::in(['jwt', 'redirect'])],
            'open_mode' => ['sometimes', Rule::in(['embedded', 'new_tab', 'same_window'])],
            'visibility' => ['sometimes', Rule::in(['public', 'private'])],
            'private_allowed_user_emails' => ['nullable', 'array'],
            'private_allowed_user_emails.*' => ['email', 'max:255'],
            'is_enabled' => ['sometimes', 'boolean'],
            'last_heartbeat' => ['nullable', 'date'],
            'notification_config' => ['nullable', 'array'],
            'color' => ['nullable', 'string', 'max:20'],
        ]);

        if (($validated['auth_mode'] ?? 'jwt') !== 'redirect') {
            unset($validated['open_mode']);
        }

        $validated['created_by_user_id'] = $user->id;
        if ($user->role !== 'admin') {
            $validated['visibility'] = 'private';
        }
        $validated['private_allowed_user_emails'] = $this->normalizePrivateEmails($validated['private_allowed_user_emails'] ?? null, $user->email);
        if (($validated['visibility'] ?? 'public') !== 'private') {
            $validated['private_allowed_user_emails'] = null;
        }

        $validated['sort_order'] = ((int) Application::query()->max('sort_order')) + 1;

        $item = Application::create($validated);

        return response()->json($item->load('creator'), 201);
    }

    public function show(Application $application): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest(request());

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canViewSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($application->load('creator'));
    }

    public function update(Request $request, Application $application): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canEditSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('applications', 'slug')->ignore($application->id),
            ],
            'description' => ['nullable', 'string'],
            'base_url' => ['nullable', 'string', 'max:2048'],
            'icon_url' => ['nullable', 'string', 'max:2048'],
            'status' => ['sometimes', Rule::in(['online', 'offline', 'maintenance', 'degraded'])],
            'api_key' => ['nullable', 'string', 'max:255'],
            'auth_mode' => ['sometimes', Rule::in(['jwt', 'redirect'])],
            'open_mode' => ['sometimes', Rule::in(['embedded', 'new_tab', 'same_window'])],
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

        $nextAuthMode = $validated['auth_mode'] ?? $application->auth_mode;
        if ($nextAuthMode !== 'redirect') {
            unset($validated['open_mode']);
        }

        if (array_key_exists('private_allowed_user_emails', $validated)) {
            $validated['private_allowed_user_emails'] = $this->normalizePrivateEmails($validated['private_allowed_user_emails'], $user->email);
        }

        $nextVisibility = $validated['visibility'] ?? $application->visibility;
        if ($nextVisibility !== 'private') {
            $validated['private_allowed_user_emails'] = null;
        }

        $application->update($validated);

        return response()->json($application->fresh()->load('creator'));
    }

    public function reorder(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'order' => ['required', 'array', 'min:1'],
            'order.*' => ['integer', 'exists:applications,id'],
        ]);

        foreach ($validated['order'] as $index => $id) {
            Application::query()->whereKey($id)->update(['sort_order' => $index]);
        }

        return response()->json(['message' => 'Order updated']);
    }

    public function destroy(Application $application): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest(request());

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canEditSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $application->delete();

        return response()->json([], 204);
    }

    /**
     * Generate a signed SSO launch URL for the application.
     *
     * The application should verify the JWT using the same api_key as the
     * secret, then log in the user identified by the `sub` (user id) and `email`
     * claims.  The token is valid for 60 seconds to prevent replay attacks.
     */
    public function launch(Request $request, Application $application): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canViewSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! $application->is_enabled) {
            return response()->json(['message' => 'System is not enabled.'], 403);
        }

        if (! $application->base_url) {
            return response()->json(['message' => 'System has no base URL configured.'], 422);
        }

        $returnTo = rtrim((string) config('app.url'), '/') . '/applications';

        if ($application->auth_mode === 'redirect') {
            $launchUrl = rtrim($application->base_url, '/');

            ActivityLog::create([
                'user_id'     => (string) $user->id,
                'user_name'   => $user->full_name ?? $user->name ?? $user->email,
                'system_id'   => $application->slug,
                'action'      => 'view',
                'description' => 'Opened redirect link for ' . $application->name,
                'ip_address'  => $request->ip(),
            ]);

            return response()->json([
                'launch_url' => $launchUrl,
                'auth_mode'  => 'redirect',
                'open_mode'  => $application->open_mode ?? 'embedded',
            ]);
        }

        if (! $application->api_key) {
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
            'sys'   => $application->slug,
            'return_to' => $returnTo,
        ];

        $token = JWT::encode($payload, $application->api_key, 'HS256');

        $launchUrl = rtrim($application->base_url, '/')
            . '/sso/nexus?token=' . urlencode($token)
            . '&return_to=' . urlencode($returnTo);

        ActivityLog::create([
            'user_id'     => (string) $user->id,
            'user_name'   => $user->full_name ?? $user->name ?? $user->email,
            'system_id'   => $application->slug,
            'action'      => 'login',
            'description' => 'Launched / logged in to ' . $application->name,
            'ip_address'  => $request->ip(),
        ]);

        return response()->json([
            'launch_url' => $launchUrl,
            'token'      => $token,
            'expires_in' => 60,
            'auth_mode'  => 'jwt',
        ]);
    }

    private function canEditSystem(User $user, Application $application): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return (int) $application->created_by_user_id === (int) $user->id;
    }

    private function canViewSystem(User $user, Application $application): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        if ($application->visibility === 'private') {
            if ((int) $application->created_by_user_id === (int) $user->id) {
                return true;
            }

            $allowedEmails = array_values(array_filter((array) $application->private_allowed_user_emails, fn ($email) => is_string($email) && $email !== ''));

            return in_array($user->email, $allowedEmails, true);
        }

        $accessRecord = UserSystemAccess::query()->where('user_email', $user->email)->first();

        if (! $accessRecord) {
            return true;
        }

        $allowedPublicSlugs = array_values(array_filter((array) $accessRecord->allowed_system_slugs, fn ($slug) => is_string($slug) && $slug !== ''));

        return in_array($application->slug, $allowedPublicSlugs, true);
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
