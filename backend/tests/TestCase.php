<?php

namespace Tests;

use App\Models\Permission;
use App\Models\Role;
use App\Services\PermissionService;
use App\Support\McpUserAccess;
use App\Support\PermissionCatalog;
use App\Support\UserRoles;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function grantUserRoleQuizPlayAccess(): void
    {
        $role = Role::query()->where('slug', UserRoles::USER)->first();
        if (! $role) {
            return;
        }

        $ids = Permission::query()
            ->whereIn('key', [
                PermissionCatalog::QUIZ_VIEW,
                PermissionCatalog::QUIZ_CREATE,
                PermissionCatalog::QUIZ_MANAGE_OWN,
            ])
            ->pluck('id');

        $role->permissions()->syncWithoutDetaching($ids);
        PermissionService::flush();
    }

    protected function tearDown(): void
    {
        McpUserAccess::resetOverrideCache();
        PermissionService::flush();

        parent::tearDown();
    }
}
