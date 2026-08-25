<?php

namespace App\Services;

use App\Models\Quiz;
use App\Models\Role;
use App\Models\User;
use App\Support\PermissionCatalog;
use App\Support\UserRoles;
use Illuminate\Support\Facades\Schema;

class PermissionService
{
    /** @var array<int, list<string>> */
    private static array $permissionCache = [];

    /** @var array<int, Role|null> */
    private static array $roleCache = [];

    private static mixed $cacheScope = null;

    public static function flush(?User $user = null): void
    {
        if ($user) {
            unset(self::$permissionCache[$user->id], self::$roleCache[$user->id]);

            return;
        }

        self::$permissionCache = [];
        self::$roleCache = [];
    }

    /**
     * PHP-FPM workers reuse this class across requests. Scope the in-memory
     * cache to the current application instance so a saved role change is
     * visible on the next request instead of serving a leftover Admin/HR map.
     */
    private static function rememberRequestCache(): void
    {
        $scope = spl_object_id(app());
        if (self::$cacheScope === $scope) {
            return;
        }

        self::$permissionCache = [];
        self::$roleCache = [];
        self::$cacheScope = $scope;
    }

    public static function can(User $user, string $key): bool
    {
        return in_array($key, self::permissionsFor($user), true);
    }

    /**
     * Users whose assigned role is active and includes the given permission key.
     *
     * @return \Illuminate\Database\Eloquent\Builder<User>
     */
    public static function usersWith(string $key)
    {
        return User::query()
            ->whereHas('assignedRole', function ($roleQuery) use ($key) {
                $roleQuery->where('is_active', true)
                    ->whereHas('permissions', fn ($permissionQuery) => $permissionQuery->where('permissions.key', $key));
            });
    }

    /**
     * @return list<string>
     */
    public static function permissionsFor(User $user): array
    {
        self::rememberRequestCache();

        if (array_key_exists($user->id, self::$permissionCache)) {
            return self::$permissionCache[$user->id];
        }

        $role = self::resolveRole($user);
        if (! $role || ! $role->is_active) {
            return self::$permissionCache[$user->id] = [];
        }

        $keys = $role->permissions()->pluck('permissions.key')->values()->all();

        return self::$permissionCache[$user->id] = array_values(array_unique($keys));
    }

    /**
     * @return array{id: int, slug: string, name: string}|null
     */
    public static function rolePayload(User $user): ?array
    {
        $role = self::resolveRole($user);
        if (! $role) {
            return null;
        }

        return [
            'id' => $role->id,
            'slug' => $role->slug,
            'name' => UserRoles::displayName($role->slug, $role->name),
        ];
    }

    public static function canAccessGames(User $user): bool
    {
        return self::can($user, PermissionCatalog::QUIZ_VIEW)
            || self::can($user, PermissionCatalog::QUIZ_CREATE)
            || self::can($user, PermissionCatalog::QUIZ_MANAGE_OWN)
            || self::can($user, PermissionCatalog::QUIZ_MANAGE);
    }

    public static function canManageQuiz(User $user, Quiz $quiz): bool
    {
        if (self::can($user, PermissionCatalog::QUIZ_MANAGE)) {
            return true;
        }

        if ((int) $quiz->user_id !== (int) $user->id) {
            return false;
        }

        return self::can($user, PermissionCatalog::QUIZ_MANAGE_OWN)
            || self::can($user, PermissionCatalog::QUIZ_CREATE);
    }

    public static function resolveRole(User $user): ?Role
    {
        self::rememberRequestCache();

        if (array_key_exists($user->id, self::$roleCache)) {
            return self::$roleCache[$user->id];
        }

        if (! Schema::hasTable('roles')) {
            return self::$roleCache[$user->id] = null;
        }

        $role = null;
        if ($user->role_id) {
            $role = Role::query()->find($user->role_id);
        }

        if (! $role && $user->role) {
            $role = Role::query()->where('slug', $user->role)->first();
        }

        return self::$roleCache[$user->id] = $role;
    }

    public static function compatibilityRoleSlug(?Role $role): string
    {
        if ($role && in_array($role->slug, UserRoles::ALL, true)) {
            return $role->slug;
        }

        return UserRoles::USER;
    }
}
