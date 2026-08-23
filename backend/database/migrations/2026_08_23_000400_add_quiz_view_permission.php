<?php

use App\Support\PermissionCatalog;
use App\Support\UserRoles;
use Database\Seeders\RbacSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        (new RbacSeeder)->run();

        $userRoleId = DB::table('roles')->where('slug', UserRoles::USER)->value('id');
        if (! $userRoleId) {
            return;
        }

        $permissionIds = DB::table('permissions')
            ->whereIn('key', [
                PermissionCatalog::QUIZ_CREATE,
                PermissionCatalog::QUIZ_MANAGE_OWN,
            ])
            ->pluck('id');

        if ($permissionIds->isEmpty()) {
            return;
        }

        DB::table('role_permission')
            ->where('role_id', $userRoleId)
            ->whereIn('permission_id', $permissionIds)
            ->delete();
    }

    public function down(): void
    {
        $viewId = DB::table('permissions')->where('key', PermissionCatalog::QUIZ_VIEW)->value('id');
        if ($viewId) {
            DB::table('role_permission')->where('permission_id', $viewId)->delete();
            DB::table('permissions')->where('id', $viewId)->delete();
        }

        $userRoleId = DB::table('roles')->where('slug', UserRoles::USER)->value('id');
        $now = now();
        $restoreIds = DB::table('permissions')
            ->whereIn('key', [
                PermissionCatalog::QUIZ_CREATE,
                PermissionCatalog::QUIZ_MANAGE_OWN,
            ])
            ->pluck('id');

        if (! $userRoleId || $restoreIds->isEmpty()) {
            return;
        }

        foreach ($restoreIds as $permissionId) {
            $exists = DB::table('role_permission')
                ->where('role_id', $userRoleId)
                ->where('permission_id', $permissionId)
                ->exists();

            if (! $exists) {
                DB::table('role_permission')->insert([
                    'role_id' => $userRoleId,
                    'permission_id' => $permissionId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }
};
