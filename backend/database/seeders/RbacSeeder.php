<?php

namespace Database\Seeders;

use App\Support\PermissionCatalog;
use App\Support\UserRoles;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RbacSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $createdPermissionKeys = [];

        foreach (PermissionCatalog::definitions() as $definition) {
            $existing = DB::table('permissions')->where('key', $definition['key'])->first();
            $payload = [
                'module' => $definition['module'],
                'name' => $definition['name'],
                'sort_order' => $definition['sort_order'],
                'updated_at' => $now,
            ];

            if ($existing) {
                DB::table('permissions')->where('id', $existing->id)->update($payload);
            } else {
                DB::table('permissions')->insert(array_merge($payload, [
                    'key' => $definition['key'],
                    'created_at' => $now,
                ]));
                $createdPermissionKeys[] = $definition['key'];
            }
        }

        $roles = [
            UserRoles::ADMIN => [
                'name' => 'Admin',
                'description' => 'Full access to Nexus Brain administration.',
            ],
            UserRoles::HR => [
                'name' => 'Human Resource',
                'description' => 'People, attendance, feed moderation, and own quizzes.',
            ],
            UserRoles::USER => [
                'name' => 'User',
                'description' => 'Standard employee access, including creating and managing own quizzes.',
            ],
        ];

        foreach ($roles as $slug => $meta) {
            $existing = DB::table('roles')->where('slug', $slug)->first();
            $payload = [
                'name' => $meta['name'],
                'description' => $meta['description'],
                'is_active' => true,
                'updated_at' => $now,
            ];

            if ($existing) {
                DB::table('roles')->where('id', $existing->id)->update($payload);
            } else {
                DB::table('roles')->insert(array_merge($payload, [
                    'slug' => $slug,
                    'created_at' => $now,
                ]));
            }
        }

        $permissionIds = DB::table('permissions')->pluck('id', 'key');
        $roleIds = DB::table('roles')->whereIn('slug', array_keys($roles))->pluck('id', 'slug');

        foreach (PermissionCatalog::seedKeysByRoleSlug() as $slug => $keys) {
            $roleId = $roleIds[$slug] ?? null;
            if (! $roleId) {
                continue;
            }

            // Do not restore permissions an admin already removed from HR / User / custom roles.
            // Newly catalogued keys that belong on a seed role are attached once.
            // Admin always receives any newly catalogued keys.
            $alreadyAssigned = DB::table('role_permission')->where('role_id', $roleId)->exists();
            if ($alreadyAssigned) {
                if ($slug !== UserRoles::ADMIN) {
                    $keys = array_values(array_intersect($keys, $createdPermissionKeys));
                    if ($keys === []) {
                        continue;
                    }
                } else {
                    $keys = array_column(PermissionCatalog::definitions(), 'key');
                }
            }

            foreach ($keys as $key) {
                $permissionId = $permissionIds[$key] ?? null;
                if (! $permissionId) {
                    continue;
                }

                $exists = DB::table('role_permission')
                    ->where('role_id', $roleId)
                    ->where('permission_id', $permissionId)
                    ->exists();

                if (! $exists) {
                    DB::table('role_permission')->insert([
                        'role_id' => $roleId,
                        'permission_id' => $permissionId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }

        // Everyone can open Network Health today. Grant the new page permission to
        // existing custom roles once so behaviour does not change until an admin
        // unchecks it.
        if (in_array(PermissionCatalog::NETWORK_VIEW, $createdPermissionKeys, true)) {
            $networkViewId = $permissionIds[PermissionCatalog::NETWORK_VIEW] ?? null;
            if ($networkViewId) {
                foreach (DB::table('roles')->pluck('id') as $roleId) {
                    $exists = DB::table('role_permission')
                        ->where('role_id', $roleId)
                        ->where('permission_id', $networkViewId)
                        ->exists();

                    if (! $exists) {
                        DB::table('role_permission')->insert([
                            'role_id' => $roleId,
                            'permission_id' => $networkViewId,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                    }
                }
            }
        }
    }
}
