<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Application;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\ApplicationEligibleUsers;
use App\Support\NotificationEventMapping;
use App\Support\UserApplicationAccess;
use Carbon\Carbon;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
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
            $allowedPublicSlugs = UserApplicationAccess::allowedPublicSlugs($user);

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
            'environment' => ['sometimes', Rule::in(['production', 'staging', 'beta', 'alpha', 'development'])],
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

        $validated['created_by_user_id'] = $user->id;
        if ($user->role !== 'admin') {
            $validated['visibility'] = 'private';
        }
        $validated['private_allowed_user_emails'] = $this->normalizePrivateEmails($validated['private_allowed_user_emails'] ?? null, $user->email);
        if (($validated['visibility'] ?? 'public') !== 'private') {
            $validated['private_allowed_user_emails'] = null;
        }

        $validated['sort_order'] = ((int) Application::query()->max('sort_order')) + 1;

        if (array_key_exists('notification_config', $validated)) {
            $validated['notification_config'] = NotificationEventMapping::normalizeForStorage($validated['notification_config']);
        }

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
            'environment' => ['sometimes', Rule::in(['production', 'staging', 'beta', 'alpha', 'development'])],
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

        if (array_key_exists('private_allowed_user_emails', $validated)) {
            $validated['private_allowed_user_emails'] = $this->normalizePrivateEmails($validated['private_allowed_user_emails'], $user->email);
        }

        $nextVisibility = $validated['visibility'] ?? $application->visibility;
        if ($nextVisibility !== 'private') {
            $validated['private_allowed_user_emails'] = null;
        }

        if (array_key_exists('notification_config', $validated)) {
            $validated['notification_config'] = NotificationEventMapping::normalizeForStorage($validated['notification_config']);
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

    public function usageStats(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'application_id' => ['nullable', 'integer', 'exists:applications,id'],
        ]);

        $applicationsQuery = Application::query()->orderBy('sort_order');

        if ($user->role === 'admin') {
            $applications = $applicationsQuery->get();
        } else {
            $applications = $applicationsQuery
                ->where('created_by_user_id', $user->id)
                ->get();
        }

        if ($applications->isEmpty()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $weekStart = now()->subDays(7);
        $monthStart = now()->subDays(30);

        if (! empty($validated['application_id'])) {
            $application = $applications->firstWhere('id', (int) $validated['application_id']);

            if (! $application) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            return response()->json($this->buildUsageStatsPayload(
                $applications,
                [$application->slug],
                ApplicationEligibleUsers::forApplication($application),
                $weekStart,
                $monthStart,
                'application',
                [
                    'application_id' => $application->id,
                    'slug' => $application->slug,
                    'name' => $application->name,
                ],
            ));
        }

        $slugs = $applications->pluck('slug')->all();

        return response()->json($this->buildUsageStatsPayload(
            $applications,
            $slugs,
            ApplicationEligibleUsers::forApplications($applications),
            $weekStart,
            $monthStart,
            'overall',
            null,
        ));
    }

    /**
     * @param  array<int, string>  $slugs
     * @param  array<string, mixed>|null  $application
     */
    private function buildUsageStatsPayload(
        Collection $applications,
        array $slugs,
        Collection $eligibleUsers,
        Carbon $weekStart,
        Carbon $monthStart,
        string $scope,
        ?array $application,
    ): array {
        $wauUsers = $this->activeUsersForSlugs($slugs, $weekStart);
        $mauUsers = $this->activeUsersForSlugs($slugs, $monthStart);
        $inactiveWauUsers = $this->inactiveUsersForSlugs($slugs, $eligibleUsers, $wauUsers);
        $inactiveMauUsers = $this->inactiveUsersForSlugs($slugs, $eligibleUsers, $mauUsers);

        $payload = [
            'scope' => $scope,
            'application' => $application,
            'applications_tracked' => $applications->count(),
            'wau' => count($wauUsers),
            'mau' => count($mauUsers),
            'wau_inactive' => count($inactiveWauUsers),
            'mau_inactive' => count($inactiveMauUsers),
            'eligible_users' => $eligibleUsers->count(),
            'users' => [
                'wau' => $wauUsers,
                'mau' => $mauUsers,
                'inactive_wau' => $inactiveWauUsers,
                'inactive_mau' => $inactiveMauUsers,
            ],
            'period' => [
                'wau_days' => 7,
                'mau_days' => 30,
            ],
        ];

        if ($scope === 'overall') {
            $payload['applications'] = $applications->map(fn (Application $app) => [
                'application_id' => $app->id,
                'slug' => $app->slug,
                'name' => $app->name,
            ])->values();
        }

        return $payload;
    }

    /**
     * @param  array<int, string>  $slugs
     * @return array<int, array<string, mixed>>
     */
    private function activeUsersForSlugs(array $slugs, Carbon $since): array
    {
        if ($slugs === []) {
            return [];
        }

        $rows = ActivityLog::query()
            ->select('user_id')
            ->selectRaw('MAX(user_name) as user_name')
            ->selectRaw('MAX(created_at) as last_active_at')
            ->selectRaw('MIN(created_at) as first_active_at')
            ->selectRaw('COUNT(*) as launch_count')
            ->selectRaw('COUNT(DISTINCT system_id) as apps_used')
            ->whereIn('system_id', $slugs)
            ->whereIn('action', ['login', 'view'])
            ->whereNotNull('user_id')
            ->where('created_at', '>=', $since)
            ->groupBy('user_id')
            ->orderByDesc('launch_count')
            ->get();

        $userIds = $rows->pluck('user_id')
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $users = User::query()
            ->whereIn('id', $userIds)
            ->get(['id', 'full_name', 'name', 'email', 'profile_picture'])
            ->keyBy('id');

        return $rows->map(function ($row) use ($users) {
            $profile = $users->get((int) $row->user_id);

            return [
                'user_id' => $row->user_id,
                'full_name' => $profile?->full_name ?: $profile?->name ?: $row->user_name,
                'email' => $profile?->email,
                'profile_picture' => $profile?->profile_picture,
                'last_active_at' => Carbon::parse($row->last_active_at)->toISOString(),
                'first_active_at' => Carbon::parse($row->first_active_at)->toISOString(),
                'launch_count' => (int) $row->launch_count,
                'apps_used' => (int) $row->apps_used,
            ];
        })->values()->all();
    }

    /**
     * @param  array<int, string>  $slugs
     * @param  array<int, array<string, mixed>>  $activeUsers
     * @return array<int, array<string, mixed>>
     */
    private function inactiveUsersForSlugs(array $slugs, Collection $eligibleUsers, array $activeUsers): array
    {
        if ($slugs === [] || $eligibleUsers->isEmpty()) {
            return [];
        }

        $activeIds = collect($activeUsers)
            ->pluck('user_id')
            ->map(fn ($id) => (string) $id)
            ->flip();

        $inactiveUsers = $eligibleUsers->filter(
            fn (User $user) => ! $activeIds->has((string) $user->id)
        );

        if ($inactiveUsers->isEmpty()) {
            return [];
        }

        $inactiveIds = $inactiveUsers
            ->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->values()
            ->all();

        $historical = ActivityLog::query()
            ->select('user_id')
            ->selectRaw('MAX(created_at) as last_active_at')
            ->selectRaw('MIN(created_at) as first_active_at')
            ->selectRaw('COUNT(*) as total_launch_count')
            ->whereIn('system_id', $slugs)
            ->whereIn('action', ['login', 'view'])
            ->whereNotNull('user_id')
            ->whereIn('user_id', $inactiveIds)
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        return $inactiveUsers
            ->map(function (User $user) use ($historical) {
                $history = $historical->get((string) $user->id);

                return [
                    'user_id' => (string) $user->id,
                    'full_name' => $user->full_name ?: $user->name,
                    'email' => $user->email,
                    'profile_picture' => $user->profile_picture,
                    'launch_count' => 0,
                    'never_launched' => $history === null,
                    'last_active_at' => $history
                        ? Carbon::parse($history->last_active_at)->toISOString()
                        : null,
                    'first_active_at' => $history
                        ? Carbon::parse($history->first_active_at)->toISOString()
                        : null,
                    'total_launch_count' => $history ? (int) $history->total_launch_count : 0,
                ];
            })
            ->sort(function (array $a, array $b) {
                if ($a['never_launched'] !== $b['never_launched']) {
                    return $a['never_launched'] ? -1 : 1;
                }

                if (! $a['never_launched'] && ! $b['never_launched']) {
                    $dateCompare = strcmp($a['last_active_at'] ?? '', $b['last_active_at'] ?? '');
                    if ($dateCompare !== 0) {
                        return $dateCompare;
                    }
                }

                if ($a['total_launch_count'] !== $b['total_launch_count']) {
                    return $a['total_launch_count'] <=> $b['total_launch_count'];
                }

                return strcasecmp($a['full_name'] ?? '', $b['full_name'] ?? '');
            })
            ->values()
            ->all();
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
        $redirectTo = $this->validatedRedirectTo(
            $application,
            $request->input('redirect_to')
        );

        if ($application->auth_mode === 'redirect') {
            $launchUrl = $redirectTo
                ? $this->absoluteRedirectUrl($application, $redirectTo)
                : rtrim($application->base_url, '/');

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

        if ($redirectTo) {
            $payload['redirect_to'] = $redirectTo;
        }

        $token = JWT::encode($payload, $application->api_key, 'HS256');

        $launchUrl = rtrim($application->base_url, '/')
            . '/sso/nexus?token=' . urlencode($token)
            . '&return_to=' . urlencode($returnTo);

        if ($redirectTo) {
            $launchUrl .= '&redirect_to=' . urlencode($redirectTo);
        }

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
            'open_mode'  => $application->open_mode ?? 'embedded',
        ]);
    }

    private function validatedRedirectTo(Application $application, mixed $redirectTo): ?string
    {
        if (! is_string($redirectTo) || trim($redirectTo) === '') {
            return null;
        }

        return $this->absoluteRedirectUrl($application, trim($redirectTo));
    }

    private function absoluteRedirectUrl(Application $application, string $redirectTo): ?string
    {
        $baseUrl = rtrim((string) $application->base_url, '/');
        $baseParts = parse_url($baseUrl);
        $targetParts = parse_url($redirectTo);

        if (! is_array($baseParts) || empty($baseParts['host'])) {
            return null;
        }

        if (! is_array($targetParts)) {
            return null;
        }

        if (empty($targetParts['host'])) {
            $path = $targetParts['path'] ?? '/';
            $query = isset($targetParts['query']) ? '?' . $targetParts['query'] : '';
            $fragment = isset($targetParts['fragment']) ? '#' . $targetParts['fragment'] : '';

            return $baseUrl . $path . $query . $fragment;
        }

        if (strcasecmp((string) $targetParts['host'], (string) $baseParts['host']) !== 0) {
            return null;
        }

        return $redirectTo;
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

        $allowedPublicSlugs = UserApplicationAccess::allowedPublicSlugs($user);

        if ($allowedPublicSlugs === null) {
            return true;
        }

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
