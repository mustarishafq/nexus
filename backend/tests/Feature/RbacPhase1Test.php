<?php

namespace Tests\Feature;

use App\Models\Quiz;
use App\Models\Role;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RbacPhase1Test extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('r', 40).str_pad((string) $user->id, 40, '0');
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    /**
     * @return array{0: User, 1: string}
     */
    private function actingAsRole(string $role): array
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => $role,
        ]);

        return [$user, $this->issueToken($user)];
    }

    public function test_me_exposes_access_role_and_permissions_and_keeps_role_string(): void
    {
        [, $token] = $this->actingAsRole('admin');

        $this->withToken($token)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('role', 'admin')
            ->assertJsonPath('access_role.slug', 'admin')
            ->assertJsonPath('access_role.name', 'Admin')
            ->assertJsonFragment(['roles.manage'])
            ->assertJsonFragment(['quiz.create']);
    }

    public function test_user_cannot_create_quizzes_by_default(): void
    {
        [, $token] = $this->actingAsRole('user');

        $this->withToken($token)
            ->postJson('/api/quizzes', ['title' => 'Intern quiz'])
            ->assertForbidden();
    }

    public function test_hr_can_create_quizzes_but_cannot_manage_someone_elses(): void
    {
        [$owner] = $this->actingAsRole('user');
        $quiz = Quiz::query()->create([
            'user_id' => $owner->id,
            'title' => 'Owned',
            'status' => Quiz::STATUS_DRAFT,
        ]);

        [, $hrToken] = $this->actingAsRole('hr');
        $this->withToken($hrToken)
            ->postJson('/api/quizzes', ['title' => 'HR quiz'])
            ->assertCreated();

        $this->withToken($hrToken)
            ->patchJson('/api/quizzes/'.$quiz->id, ['title' => 'Hijacked'])
            ->assertForbidden();
    }

    public function test_admin_can_manage_someone_elses_quiz(): void
    {
        [$owner] = $this->actingAsRole('user');
        $quiz = Quiz::query()->create([
            'user_id' => $owner->id,
            'title' => 'Owned',
            'status' => Quiz::STATUS_DRAFT,
        ]);

        [, $adminToken] = $this->actingAsRole('admin');
        $this->withToken($adminToken)
            ->patchJson('/api/quizzes/'.$quiz->id, ['title' => 'Admin edit'])
            ->assertOk()
            ->assertJsonPath('title', 'Admin edit');
    }

    public function test_admin_can_delete_someone_elses_published_quiz(): void
    {
        [$owner] = $this->actingAsRole('user');
        $quiz = Quiz::query()->create([
            'user_id' => $owner->id,
            'title' => 'Published by user',
            'status' => Quiz::STATUS_PUBLISHED,
        ]);

        [, $adminToken] = $this->actingAsRole('admin');
        [, $hrToken] = $this->actingAsRole('hr');
        [, $userToken] = $this->actingAsRole('user');

        $this->withToken($hrToken)->deleteJson('/api/quizzes/'.$quiz->id)->assertForbidden();
        $this->withToken($userToken)->deleteJson('/api/quizzes/'.$quiz->id)->assertForbidden();
        $this->withToken($adminToken)->deleteJson('/api/quizzes/'.$quiz->id)->assertOk();

        $this->assertDatabaseMissing('quizzes', ['id' => $quiz->id]);
    }

    public function test_admin_can_manage_roles_and_hr_cannot(): void
    {
        [, $adminToken] = $this->actingAsRole('admin');
        [, $hrToken] = $this->actingAsRole('hr');
        [, $userToken] = $this->actingAsRole('user');

        $this->withToken($hrToken)->getJson('/api/roles')->assertForbidden();
        $this->withToken($userToken)->getJson('/api/roles')->assertForbidden();

        $this->withToken($adminToken)
            ->getJson('/api/roles')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Admin');

        $created = $this->withToken($adminToken)
            ->postJson('/api/roles', [
                'name' => 'Quiz Helper',
                'description' => 'Created by admin',
                'is_active' => true,
            ])
            ->assertCreated()
            ->json();

        $this->assertSame('Quiz Helper', $created['name']);
        $this->assertNotContains(PermissionCatalog::QUIZ_CREATE, $created['permission_keys']);
        $this->assertContains(PermissionCatalog::NETWORK_VIEW, $created['permission_keys']);

        $this->withToken($adminToken)
            ->patchJson('/api/roles/'.$created['id'], ['description' => 'Updated'])
            ->assertOk()
            ->assertJsonPath('description', 'Updated');

        $keys = $this->withToken($adminToken)
            ->putJson('/api/roles/'.$created['id'].'/permissions', [
                'permission_keys' => [PermissionCatalog::QUIZ_CREATE],
            ])
            ->assertOk()
            ->json('permission_keys');

        $this->assertEqualsCanonicalizing([
            PermissionCatalog::QUIZ_VIEW,
            PermissionCatalog::QUIZ_CREATE,
            PermissionCatalog::QUIZ_MANAGE_OWN,
        ], $keys);
    }

    public function test_admin_role_cannot_be_deleted_or_deactivated_or_lose_roles_manage(): void
    {
        [, $token] = $this->actingAsRole('admin');
        $adminRoleId = Role::query()->where('slug', 'admin')->value('id');

        $this->withToken($token)
            ->deleteJson('/api/roles/'.$adminRoleId)
            ->assertStatus(422);

        $this->withToken($token)
            ->patchJson('/api/roles/'.$adminRoleId, ['is_active' => false])
            ->assertStatus(422);

        $this->withToken($token)
            ->putJson('/api/roles/'.$adminRoleId.'/permissions', [
                'permission_keys' => [PermissionCatalog::QUIZ_CREATE],
            ])
            ->assertOk()
            ->assertJsonFragment([PermissionCatalog::ROLES_MANAGE])
            ->assertJsonFragment([PermissionCatalog::SETTINGS_MANAGE])
            ->assertJsonFragment([PermissionCatalog::TOKENS_MANAGE]);
    }

    public function test_role_with_users_cannot_be_deleted(): void
    {
        [, $token] = $this->actingAsRole('admin');
        $this->actingAsRole('user');
        $userRoleId = Role::query()->where('slug', 'user')->value('id');

        $this->withToken($token)
            ->deleteJson('/api/roles/'.$userRoleId)
            ->assertStatus(422);
    }

    public function test_empty_custom_role_can_be_deleted(): void
    {
        [, $token] = $this->actingAsRole('admin');

        $role = $this->withToken($token)
            ->postJson('/api/roles', ['name' => 'Temporary'])
            ->assertCreated()
            ->json();

        $this->withToken($token)
            ->deleteJson('/api/roles/'.$role['id'])
            ->assertOk();

        $this->assertNull(Role::query()->find($role['id']));
    }

    public function test_custom_role_can_save_an_empty_permission_list(): void
    {
        [, $token] = $this->actingAsRole('admin');

        $roleId = $this->withToken($token)
            ->postJson('/api/roles', ['name' => 'No Access'])
            ->assertCreated()
            ->json('id');

        $this->withToken($token)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [
                    PermissionCatalog::QUIZ_CREATE,
                    PermissionCatalog::NETWORK_VIEW,
                ],
            ])
            ->assertOk();

        $cleared = $this->withToken($token)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [],
            ])
            ->assertOk()
            ->json('permission_keys');

        $this->assertSame([], $cleared);
    }

    public function test_unchecking_one_module_removes_only_that_modules_permissions(): void
    {
        [, $token] = $this->actingAsRole('admin');

        $roleId = $this->withToken($token)
            ->postJson('/api/roles', ['name' => 'Partial Access'])
            ->assertCreated()
            ->json('id');

        $this->withToken($token)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [
                    PermissionCatalog::QUIZ_VIEW,
                    PermissionCatalog::QUIZ_CREATE,
                    PermissionCatalog::NETWORK_VIEW,
                    PermissionCatalog::FEED_MODERATE,
                ],
            ])
            ->assertOk();

        $keys = $this->withToken($token)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [
                    PermissionCatalog::NETWORK_VIEW,
                    PermissionCatalog::FEED_MODERATE,
                ],
            ])
            ->assertOk()
            ->json('permission_keys');

        $this->assertContains(PermissionCatalog::NETWORK_VIEW, $keys);
        $this->assertContains(PermissionCatalog::FEED_MODERATE, $keys);
        $this->assertNotContains(PermissionCatalog::QUIZ_VIEW, $keys);
        $this->assertNotContains(PermissionCatalog::QUIZ_CREATE, $keys);
        $this->assertNotContains(PermissionCatalog::QUIZ_MANAGE_OWN, $keys);
        $this->assertNotContains(PermissionCatalog::QUIZ_MANAGE, $keys);
    }

    public function test_admin_empty_permission_payload_still_keeps_admin_only_keys(): void
    {
        [, $token] = $this->actingAsRole('admin');
        $adminRoleId = Role::query()->where('slug', 'admin')->value('id');

        $keys = $this->withToken($token)
            ->putJson('/api/roles/'.$adminRoleId.'/permissions', [
                'permission_keys' => [],
            ])
            ->assertOk()
            ->json('permission_keys');

        $this->assertContains(PermissionCatalog::ROLES_MANAGE, $keys);
        $this->assertContains(PermissionCatalog::SETTINGS_MANAGE, $keys);
        $this->assertContains(PermissionCatalog::TOKENS_MANAGE, $keys);
        $this->assertNotContains(PermissionCatalog::QUIZ_VIEW, $keys);
        $this->assertNotContains(PermissionCatalog::QUIZ_CREATE, $keys);
        $this->assertNotContains(PermissionCatalog::NETWORK_VIEW, $keys);
    }

    public function test_last_admin_cannot_be_demoted(): void
    {
        [$admin, $token] = $this->actingAsRole('admin');

        $this->withToken($token)
            ->patchJson('/api/users/'.$admin->id, ['role' => 'user'])
            ->assertStatus(422);
    }

    public function test_admin_can_assign_a_custom_role(): void
    {
        [, $adminToken] = $this->actingAsRole('admin');
        [$target] = $this->actingAsRole('user');

        $role = $this->withToken($adminToken)
            ->postJson('/api/roles', ['name' => 'Coordinator'])
            ->assertCreated()
            ->json();

        $this->withToken($adminToken)
            ->patchJson('/api/users/'.$target->id, ['role' => $role['slug']])
            ->assertOk();

        $target->refresh();
        $this->assertSame($role['slug'], $target->assignedRole?->slug);
        $this->assertSame('user', $target->role);
    }

    public function test_permission_catalog_uses_games_module_and_includes_new_assignable_keys(): void
    {
        [, $token] = $this->actingAsRole('admin');

        $modules = $this->withToken($token)
            ->getJson('/api/permissions')
            ->assertOk()
            ->json('data');

        $keys = collect($modules)->pluck('key')->all();
        $this->assertContains('games', $keys);
        $this->assertNotContains('quiz', $keys);
        $this->assertContains('analytics', $keys);
        $this->assertContains('applications', $keys);
        $this->assertContains('broadcast', $keys);
        $this->assertContains('network', $keys);

        $allPermissionKeys = collect($modules)->flatMap(fn (array $module) => collect($module['permissions'])->pluck('key'))->all();
        $this->assertContains(PermissionCatalog::QUIZ_VIEW, $allPermissionKeys);
        $this->assertContains(PermissionCatalog::QUIZ_CREATE, $allPermissionKeys);
        $this->assertNotContains(PermissionCatalog::QUIZ_MANAGE_OWN, $allPermissionKeys);
        $this->assertContains(PermissionCatalog::CALENDAR_MANAGE, $allPermissionKeys);
        $this->assertContains(PermissionCatalog::PEOPLE_MANAGE_GROUPS, $allPermissionKeys);
        $this->assertContains(PermissionCatalog::ANALYTICS_MANAGE, $allPermissionKeys);
        $this->assertContains(PermissionCatalog::APPLICATIONS_MANAGE, $allPermissionKeys);
        $this->assertContains(PermissionCatalog::BROADCAST_MANAGE, $allPermissionKeys);
        $this->assertContains(PermissionCatalog::NETWORK_VIEW, $allPermissionKeys);
        $this->assertContains(PermissionCatalog::NETWORK_VIEW_ALL, $allPermissionKeys);
        $this->assertNotContains(PermissionCatalog::ROLES_MANAGE, $allPermissionKeys);
    }

    public function test_hr_cannot_use_new_admin_style_permissions_until_granted(): void
    {
        [, $hrToken] = $this->actingAsRole('hr');

        $this->withToken($hrToken)->getJson('/api/access-groups')->assertForbidden();
        $this->withToken($hrToken)->getJson('/api/broadcasts')->assertForbidden();
        $this->withToken($hrToken)->getJson('/api/network-health/dashboard')->assertOk();
    }

    public function test_user_can_access_network_health_until_permission_removed(): void
    {
        [, $adminToken] = $this->actingAsRole('admin');
        [, $userToken] = $this->actingAsRole('user');
        $userRoleId = Role::query()->where('slug', 'user')->value('id');

        $this->withToken($userToken)->getJson('/api/network-health/dashboard')->assertOk();
        $this->withToken($userToken)->getJson('/api/network-health/ping')->assertOk();

        $this->withToken($adminToken)
            ->putJson('/api/roles/'.$userRoleId.'/permissions', [
                'permission_keys' => [
                    PermissionCatalog::QUIZ_CREATE,
                    PermissionCatalog::QUIZ_MANAGE_OWN,
                ],
            ])
            ->assertOk();

        $this->withToken($userToken)->getJson('/api/network-health/dashboard')->assertForbidden();
        $this->withToken($userToken)->getJson('/api/network-health/ping')->assertForbidden();
    }

    public function test_hr_cannot_assign_roles(): void
    {
        [, $hrToken] = $this->actingAsRole('hr');
        [$target] = $this->actingAsRole('user');

        $this->withToken($hrToken)
            ->patchJson('/api/users/'.$target->id, ['role' => 'admin'])
            ->assertForbidden();
    }

    public function test_custom_role_without_quiz_create_is_forbidden_by_api(): void
    {
        [, $adminToken] = $this->actingAsRole('admin');
        [$target] = $this->actingAsRole('user');

        $role = $this->withToken($adminToken)
            ->postJson('/api/roles', ['name' => 'No Quiz'])
            ->assertCreated()
            ->json();

        $this->withToken($adminToken)
            ->putJson('/api/roles/'.$role['id'].'/permissions', [
                'permission_keys' => [PermissionCatalog::QUIZ_MANAGE_OWN],
            ])
            ->assertOk();

        $this->withToken($adminToken)
            ->patchJson('/api/users/'.$target->id, ['role' => $role['slug']])
            ->assertOk();

        $targetToken = $this->issueToken($target->fresh());
        $this->withToken($targetToken)
            ->postJson('/api/quizzes', ['title' => 'Blocked'])
            ->assertForbidden();
    }

    public function test_admin_can_search_and_assign_role_members(): void
    {
        [, $adminToken] = $this->actingAsRole('admin');
        $hrRoleId = Role::query()->where('slug', 'hr')->value('id');
        $userRoleId = Role::query()->where('slug', 'user')->value('id');

        $byName = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'name' => 'Ahmad Rahman',
            'full_name' => 'Ahmad Rahman',
            'email' => 'ahmad@company.test',
        ]);
        $byEmail = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'name' => 'Sarah Lee',
            'full_name' => 'Sarah Lee',
            'email' => 'sarah@company.test',
        ]);

        $this->withToken($adminToken)
            ->getJson('/api/roles/'.$hrRoleId.'/user-search?q=Ahmad')
            ->assertOk()
            ->assertJsonFragment(['id' => $byName->id, 'email' => 'ahmad@company.test']);

        $this->withToken($adminToken)
            ->getJson('/api/roles/'.$hrRoleId.'/user-search?q=sarah@company.test')
            ->assertOk()
            ->assertJsonFragment(['id' => $byEmail->id, 'email' => 'sarah@company.test']);

        $before = $this->withToken($adminToken)->getJson('/api/roles')->assertOk()->json('data');
        $hrBefore = collect($before)->firstWhere('id', $hrRoleId);
        $userBefore = collect($before)->firstWhere('id', $userRoleId);

        $this->withToken($adminToken)
            ->postJson('/api/roles/'.$hrRoleId.'/users', ['user_ids' => [$byName->id]])
            ->assertOk()
            ->assertJsonPath('users_count', ($hrBefore['users_count'] ?? 0) + 1);

        $byName->refresh();
        $this->assertSame($hrRoleId, $byName->role_id);
        $this->assertSame('hr', $byName->role);
        $this->assertSame('hr', $byName->assignedRole?->slug);

        $this->withToken($adminToken)
            ->getJson('/api/roles/'.$hrRoleId.'/users')
            ->assertOk()
            ->assertJsonFragment(['id' => $byName->id, 'email' => 'ahmad@company.test']);

        $after = $this->withToken($adminToken)->getJson('/api/roles')->assertOk()->json('data');
        $this->assertSame(($hrBefore['users_count'] ?? 0) + 1, collect($after)->firstWhere('id', $hrRoleId)['users_count']);
        $this->assertSame(($userBefore['users_count'] ?? 0) - 1, collect($after)->firstWhere('id', $userRoleId)['users_count']);
    }

    public function test_role_membership_replace_and_users_page_assignment_stay_in_sync(): void
    {
        [, $adminToken] = $this->actingAsRole('admin');
        $hrRoleId = Role::query()->where('slug', 'hr')->value('id');
        $userRoleId = Role::query()->where('slug', 'user')->value('id');

        $target = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'name' => 'John Tan',
            'email' => 'john@company.test',
        ]);

        $this->withToken($adminToken)
            ->postJson('/api/roles/'.$hrRoleId.'/users', ['user_ids' => [$target->id]])
            ->assertOk();

        $target->refresh();
        $this->assertSame($hrRoleId, $target->role_id);

        $this->withToken($adminToken)
            ->patchJson('/api/users/'.$target->id, ['role' => 'user'])
            ->assertOk();

        $target->refresh();
        $this->assertSame($userRoleId, $target->role_id);
        $this->assertSame('user', $target->role);

        $hrMembers = $this->withToken($adminToken)
            ->getJson('/api/roles/'.$hrRoleId.'/users')
            ->assertOk()
            ->json('data');
        $this->assertFalse(collect($hrMembers)->pluck('id')->contains($target->id));

        $userMembers = $this->withToken($adminToken)
            ->getJson('/api/roles/'.$userRoleId.'/users')
            ->assertOk()
            ->json('data');
        $this->assertTrue(collect($userMembers)->pluck('id')->contains($target->id));
    }

    public function test_removing_a_role_member_requires_another_active_role(): void
    {
        [, $adminToken] = $this->actingAsRole('admin');
        $hrRoleId = Role::query()->where('slug', 'hr')->value('id');
        $userRoleId = Role::query()->where('slug', 'user')->value('id');

        $target = User::factory()->create([
            'is_approved' => true,
            'role' => 'hr',
            'name' => 'Priya Kumar',
            'email' => 'priya@company.test',
        ]);

        $this->withToken($adminToken)
            ->patchJson('/api/roles/'.$hrRoleId.'/users/'.$target->id, [])
            ->assertStatus(422);

        $this->withToken($adminToken)
            ->patchJson('/api/roles/'.$hrRoleId.'/users/'.$target->id, ['role_id' => $hrRoleId])
            ->assertStatus(422);

        $this->withToken($adminToken)
            ->patchJson('/api/roles/'.$hrRoleId.'/users/'.$target->id, ['role_id' => $userRoleId])
            ->assertOk();

        $target->refresh();
        $this->assertSame($userRoleId, $target->role_id);
        $this->assertSame('user', $target->role);
        $this->assertNotNull($target->role_id);
    }

    public function test_last_admin_cannot_be_moved_from_role_membership(): void
    {
        [$admin, $token] = $this->actingAsRole('admin');
        $hrRoleId = Role::query()->where('slug', 'hr')->value('id');

        $this->withToken($token)
            ->postJson('/api/roles/'.$hrRoleId.'/users', ['user_ids' => [$admin->id]])
            ->assertStatus(422);

        $admin->refresh();
        $this->assertSame('admin', $admin->assignedRole?->slug);
    }

    public function test_hr_and_user_cannot_manage_role_membership(): void
    {
        [, $hrToken] = $this->actingAsRole('hr');
        [, $userToken] = $this->actingAsRole('user');
        [$target] = $this->actingAsRole('user');
        $hrRoleId = Role::query()->where('slug', 'hr')->value('id');
        $userRoleId = Role::query()->where('slug', 'user')->value('id');

        foreach ([$hrToken, $userToken] as $token) {
            $this->withToken($token)->getJson('/api/roles/'.$hrRoleId.'/users')->assertForbidden();
            $this->withToken($token)->getJson('/api/roles/'.$hrRoleId.'/user-search?q=Priya')->assertForbidden();
            $this->withToken($token)
                ->postJson('/api/roles/'.$hrRoleId.'/users', ['user_ids' => [$target->id]])
                ->assertForbidden();
            $this->withToken($token)
                ->patchJson('/api/roles/'.$userRoleId.'/users/'.$target->id, ['role_id' => $hrRoleId])
                ->assertForbidden();
        }

        $target->refresh();
        $this->assertSame($userRoleId, $target->role_id);
    }

    public function test_removing_hr_feed_and_attendance_permissions_is_enforced(): void
    {
        [, $adminToken] = $this->actingAsRole('admin');
        [$hr, $hrToken] = $this->actingAsRole('hr');
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $hrRoleId = Role::query()->where('slug', 'hr')->value('id');

        $this->withToken($hrToken)
            ->getJson('/api/attendance/dashboard')
            ->assertOk();

        $pending = \App\Models\Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Needs review',
            'approval_status' => \App\Models\Post::APPROVAL_PENDING,
        ]);

        $this->withToken($hrToken)
            ->postJson('/api/posts/'.$pending->id.'/approve')
            ->assertOk();

        $pendingAgain = \App\Models\Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Needs review again',
            'approval_status' => \App\Models\Post::APPROVAL_PENDING,
        ]);

        $this->withToken($adminToken)
            ->putJson('/api/roles/'.$hrRoleId.'/permissions', [
                'permission_keys' => [
                    PermissionCatalog::QUIZ_CREATE,
                    PermissionCatalog::QUIZ_MANAGE_OWN,
                    PermissionCatalog::PEOPLE_VIEW_SENSITIVE,
                    PermissionCatalog::PEOPLE_MANAGE_USERS,
                    PermissionCatalog::ATTENDANCE_MANAGE_POLICY,
                    PermissionCatalog::GAMIFICATION_AWARD_MANUAL,
                ],
            ])
            ->assertOk();

        $permissions = $this->withToken($hrToken)
            ->getJson('/api/me')
            ->assertOk()
            ->json('permissions');

        $this->assertNotContains(PermissionCatalog::FEED_MODERATE, $permissions);
        $this->assertNotContains(PermissionCatalog::ATTENDANCE_VIEW_ALL, $permissions);
        $this->assertContains(PermissionCatalog::ATTENDANCE_MANAGE_POLICY, $permissions);

        $this->withToken($hrToken)
            ->getJson('/api/attendance/dashboard')
            ->assertForbidden();

        $this->withToken($hrToken)
            ->postJson('/api/posts/'.$pendingAgain->id.'/approve')
            ->assertForbidden();

        $hr->refresh();
        $this->assertSame('hr', $hr->role);
    }
}
