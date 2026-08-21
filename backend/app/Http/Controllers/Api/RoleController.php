<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\PermissionService;
use App\Support\PermissionCatalog;
use App\Support\UserRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    use AuthorizesRoles;

    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ROLES_MANAGE)) {
            return $response;
        }

        $roles = Role::query()
            ->withCount('users')
            ->with('permissions:id,key')
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role) => $this->serializeRole($role));

        return response()->json(['data' => $roles]);
    }

    public function permissionCatalog(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ROLES_MANAGE)) {
            return $response;
        }

        $labels = PermissionCatalog::moduleLabels();
        $catalogNames = array_column(PermissionCatalog::definitions(), 'name', 'key');
        $permissions = Permission::query()
            ->orderBy('module')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $modules = [];
        foreach ($permissions as $permission) {
            $module = $permission->module;
            if ($module === 'admin' || in_array($permission->key, PermissionCatalog::adminOnlyKeys(), true)) {
                continue;
            }
            if (! isset($modules[$module])) {
                $modules[$module] = [
                    'key' => $module,
                    'name' => $labels[$module] ?? Str::headline($module),
                    'permissions' => [],
                ];
            }

            $modules[$module]['permissions'][] = [
                'id' => $permission->id,
                'key' => $permission->key,
                'name' => $catalogNames[$permission->key] ?? $permission->name,
            ];
        }

        $order = array_flip(PermissionCatalog::moduleOrder());
        $data = array_values($modules);
        usort($data, function (array $left, array $right) use ($order) {
            return ($order[$left['key']] ?? 100) <=> ($order[$right['key']] ?? 100);
        });

        return response()->json([
            'data' => $data,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ROLES_MANAGE)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $role = Role::query()->create([
            'slug' => $this->uniqueSlug($validated['name']),
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $userRole = Role::query()->where('slug', UserRoles::USER)->first();
        if ($userRole) {
            $role->permissions()->sync($userRole->permissions()->pluck('permissions.id'));
        }

        PermissionService::flush();

        return response()->json($this->serializeRole($role->loadCount('users')->load('permissions:id,key')), 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ROLES_MANAGE)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if ($role->isAdminRole() && array_key_exists('is_active', $validated) && ! $validated['is_active']) {
            return response()->json(['message' => 'The Admin role cannot be deactivated.'], 422);
        }

        if (array_key_exists('is_active', $validated) && ! $validated['is_active'] && $role->users()->exists()) {
            return response()->json(['message' => 'Deactivate is blocked while users are still assigned to this role.'], 422);
        }

        $role->fill($validated);
        $role->save();
        PermissionService::flush();

        return response()->json($this->serializeRole($role->loadCount('users')->load('permissions:id,key')));
    }

    public function destroy(Request $request, Role $role): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ROLES_MANAGE)) {
            return $response;
        }

        if (in_array($role->slug, UserRoles::ALL, true)) {
            return response()->json(['message' => 'The Admin, HR, and User roles cannot be deleted.'], 422);
        }

        if ($role->users()->exists()) {
            return response()->json(['message' => 'This role still has assigned users and cannot be deleted.'], 422);
        }

        $role->delete();
        PermissionService::flush();

        return response()->json(['message' => 'Role removed.']);
    }

    public function syncPermissions(Request $request, Role $role): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ROLES_MANAGE)) {
            return $response;
        }

        $validated = $request->validate([
            'permission_keys' => ['required', 'array'],
            'permission_keys.*' => ['string', Rule::exists('permissions', 'key')],
        ]);

        $keys = array_values(array_unique($validated['permission_keys']));
        $adminOnly = PermissionCatalog::adminOnlyKeys();

        if ($role->isAdminRole()) {
            $keys = array_values(array_unique(array_merge($keys, $adminOnly)));
        } else {
            $keys = array_values(array_diff($keys, $adminOnly));
        }

        $ids = Permission::query()->whereIn('key', $keys)->pluck('id');
        $role->permissions()->sync($ids);
        PermissionService::flush();

        return response()->json($this->serializeRole($role->loadCount('users')->load('permissions:id,key')));
    }

    /**
     * Lightweight list for the Users role dropdown. Admin-only assignment.
     */
    public function options(Request $request): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::PEOPLE_MANAGE_USERS)) {
            return $response;
        }

        $roles = Role::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'slug', 'name'])
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'slug' => $role->slug,
                'name' => UserRoles::displayName($role->slug, $role->name),
            ]);

        return response()->json(['data' => $roles]);
    }

    public function users(Request $request, Role $role): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ROLES_MANAGE)) {
            return $response;
        }

        $users = $role->users()
            ->with('assignedRole')
            ->orderByRaw('COALESCE(full_name, name, email)')
            ->get();

        return response()->json([
            'data' => $users->map(fn (User $user) => $this->serializeMember($user, $role))->values(),
            'users_count' => $users->count(),
        ]);
    }

    public function searchUsers(Request $request, Role $role): JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ROLES_MANAGE)) {
            return $response;
        }

        $validated = $request->validate([
            'q' => ['required', 'string', 'min:1', 'max:100'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:20'],
        ]);

        $users = User::query()
            ->with('assignedRole')
            ->where('is_approved', true)
            ->matchingSearch(trim($validated['q']))
            ->orderBy('full_name')
            ->orderBy('name')
            ->limit((int) ($validated['limit'] ?? 10))
            ->get();

        return response()->json(
            $users->map(fn (User $user) => $this->serializeMember($user, $role))->values()
        );
    }

    public function assignUsers(Request $request, Role $role): JsonResponse
    {
        if ($response = $this->authorizeMembershipChange($request)) {
            return $response;
        }

        if (! $role->is_active) {
            return response()->json(['message' => 'This role is inactive and cannot be assigned.'], 422);
        }

        $validated = $request->validate([
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $targets = User::query()
            ->with('assignedRole')
            ->whereIn('id', $validated['user_ids'])
            ->get();

        foreach ($targets as $target) {
            if ((int) $target->role_id === (int) $role->id) {
                continue;
            }

            if ($lock = $this->guardLastAdmin($target, $role)) {
                return $lock;
            }

            $target->role_id = $role->id;
            $target->save();
        }

        PermissionService::flush();

        return response()->json($this->serializeRole($role->loadCount('users')->load('permissions:id,key')));
    }

    public function reassignUser(Request $request, Role $role, User $user): JsonResponse
    {
        if ($response = $this->authorizeMembershipChange($request)) {
            return $response;
        }

        if ((int) $user->role_id !== (int) $role->id) {
            return response()->json(['message' => 'That user is not assigned to this role.'], 422);
        }

        $validated = $request->validate([
            'role_id' => ['required', 'integer', 'exists:roles,id'],
        ]);

        $nextRole = Role::query()->find($validated['role_id']);
        if (! $nextRole || ! $nextRole->is_active) {
            return response()->json([
                'message' => 'Users must have a role. Assign this user to another active role.',
            ], 422);
        }

        if ((int) $nextRole->id === (int) $role->id) {
            return response()->json(['message' => 'Choose a different role.'], 422);
        }

        $user->loadMissing('assignedRole');
        if ($lock = $this->guardLastAdmin($user, $nextRole)) {
            return $lock;
        }

        $user->role_id = $nextRole->id;
        $user->save();
        PermissionService::flush();

        return response()->json($this->serializeRole($role->loadCount('users')->load('permissions:id,key')));
    }

    private function authorizeMembershipChange(Request $request): ?JsonResponse
    {
        if ($response = $this->authorizePermission($request, PermissionCatalog::ROLES_MANAGE)) {
            return $response;
        }

        return $this->authorizePermission($request, PermissionCatalog::PEOPLE_ASSIGN_ROLE);
    }

    private function guardLastAdmin(User $target, Role $newRole): ?JsonResponse
    {
        $slug = $target->assignedRole?->slug ?? $target->role;
        if ($slug !== UserRoles::ADMIN && $target->role !== UserRoles::ADMIN) {
            return null;
        }

        if ($newRole->slug === UserRoles::ADMIN) {
            return null;
        }

        $adminCount = User::query()
            ->where(function ($query) {
                $query->where('role', UserRoles::ADMIN)
                    ->orWhereHas('assignedRole', fn ($roleQuery) => $roleQuery->where('slug', UserRoles::ADMIN));
            })
            ->count();

        if ($adminCount <= 1) {
            return response()->json([
                'message' => 'The last Admin cannot be assigned a different role.',
            ], 422);
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeMember(User $user, Role $role): array
    {
        return [
            'id' => $user->id,
            'name' => $user->displayName(),
            'full_name' => $user->full_name,
            'email' => $user->email,
            'profile_picture' => $user->profile_picture,
            'role' => $user->role,
            'in_role' => (int) $user->role_id === (int) $role->id,
            'access_role' => PermissionService::rolePayload($user),
        ];
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'role';
        if (in_array($base, UserRoles::ALL, true)) {
            $base .= '-custom';
        }

        $slug = $base;
        $i = 2;
        while (Role::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i;
            $i++;
        }

        return $slug;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeRole(Role $role): array
    {
        return [
            'id' => $role->id,
            'slug' => $role->slug,
            'name' => UserRoles::displayName($role->slug, $role->name),
            'description' => $role->description,
            'is_active' => (bool) $role->is_active,
            'users_count' => (int) ($role->users_count ?? $role->users()->count()),
            'permission_keys' => $role->relationLoaded('permissions')
                ? $role->permissions->pluck('key')->values()->all()
                : $role->permissions()->pluck('permissions.key')->values()->all(),
        ];
    }
}
