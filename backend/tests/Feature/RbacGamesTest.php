<?php

namespace Tests\Feature;

use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\Role;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\PermissionCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RbacGamesTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    /**
     * @return array{0: User, 1: string}
     */
    private function userWithRole(string $slug): array
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => $slug,
        ]);

        return [$user, $this->token($user)];
    }

    /**
     * @return array{0: User, 1: string, 2: Role}
     */
    private function userWithPermissionKeys(array $keys): array
    {
        [, $adminToken] = $this->userWithRole('admin');

        $role = $this->withToken($adminToken)
            ->postJson('/api/roles', ['name' => 'Games Fixture '.uniqid()])
            ->assertCreated()
            ->json();

        $this->withToken($adminToken)
            ->putJson('/api/roles/'.$role['id'].'/permissions', [
                'permission_keys' => $keys,
            ])
            ->assertOk();

        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $this->withToken($adminToken)
            ->patchJson('/api/users/'.$user->id, ['role' => $role['slug']])
            ->assertOk();

        $user = $user->fresh();

        return [$user, $this->token($user), Role::query()->findOrFail($role['id'])];
    }

    private function makePublishedQuiz(User $owner): Quiz
    {
        $quiz = Quiz::create([
            'user_id' => $owner->id,
            'title' => 'Published trivia',
            'status' => Quiz::STATUS_PUBLISHED,
        ]);

        $question = QuizQuestion::create([
            'quiz_id' => $quiz->id,
            'prompt' => '2+2?',
            'time_limit_seconds' => 20,
            'points_base' => 1000,
            'sort_order' => 0,
        ]);
        QuizOption::create([
            'quiz_question_id' => $question->id,
            'label' => '4',
            'is_correct' => true,
            'sort_order' => 0,
        ]);
        QuizOption::create([
            'quiz_question_id' => $question->id,
            'label' => '5',
            'is_correct' => false,
            'sort_order' => 1,
        ]);

        return $quiz->fresh(['questions.options']);
    }

    public function test_catalog_includes_quiz_view_and_hides_manage_own(): void
    {
        [, $token] = $this->userWithRole('admin');

        $modules = $this->withToken($token)
            ->getJson('/api/permissions')
            ->assertOk()
            ->json('data');

        $keys = collect($modules)
            ->flatMap(fn (array $module) => collect($module['permissions'])->pluck('key'))
            ->all();

        $this->assertContains(PermissionCatalog::QUIZ_VIEW, $keys);
        $this->assertContains(PermissionCatalog::QUIZ_CREATE, $keys);
        $this->assertContains(PermissionCatalog::QUIZ_MANAGE, $keys);
        $this->assertNotContains(PermissionCatalog::QUIZ_MANAGE_OWN, $keys);

        $games = collect($modules)->firstWhere('key', 'games');
        $names = collect($games['permissions'])->pluck('name', 'key');
        $this->assertSame('View & Play Games', $names[PermissionCatalog::QUIZ_VIEW]);
        $this->assertSame('Create Games', $names[PermissionCatalog::QUIZ_CREATE]);
        $this->assertSame('Manage All Games', $names[PermissionCatalog::QUIZ_MANAGE]);
    }

    public function test_seeded_roles_match_games_matrix(): void
    {
        [, $adminToken] = $this->userWithRole('admin');
        [, $hrToken] = $this->userWithRole('hr');
        [, $userToken] = $this->userWithRole('user');

        $admin = $this->withToken($adminToken)->getJson('/api/me')->assertOk()->json('permissions');
        $hr = $this->withToken($hrToken)->getJson('/api/me')->assertOk()->json('permissions');
        $user = $this->withToken($userToken)->getJson('/api/me')->assertOk()->json('permissions');

        foreach ([
            PermissionCatalog::QUIZ_VIEW,
            PermissionCatalog::QUIZ_CREATE,
            PermissionCatalog::QUIZ_MANAGE_OWN,
            PermissionCatalog::QUIZ_MANAGE,
        ] as $key) {
            $this->assertContains($key, $admin);
        }

        $this->assertContains(PermissionCatalog::QUIZ_VIEW, $hr);
        $this->assertContains(PermissionCatalog::QUIZ_CREATE, $hr);
        $this->assertContains(PermissionCatalog::QUIZ_MANAGE_OWN, $hr);
        $this->assertNotContains(PermissionCatalog::QUIZ_MANAGE, $hr);

        $this->assertNotContains(PermissionCatalog::QUIZ_VIEW, $user);
        $this->assertNotContains(PermissionCatalog::QUIZ_CREATE, $user);
        $this->assertNotContains(PermissionCatalog::QUIZ_MANAGE_OWN, $user);
        $this->assertNotContains(PermissionCatalog::QUIZ_MANAGE, $user);
    }

    public function test_custom_roles_do_not_receive_quiz_view_automatically(): void
    {
        [, $adminToken] = $this->userWithRole('admin');

        $created = $this->withToken($adminToken)
            ->postJson('/api/roles', ['name' => 'Custom Ops'])
            ->assertCreated()
            ->json();

        $this->assertNotContains(PermissionCatalog::QUIZ_VIEW, $created['permission_keys']);
        $this->assertNotContains(PermissionCatalog::QUIZ_CREATE, $created['permission_keys']);
        $this->assertContains(PermissionCatalog::NETWORK_VIEW, $created['permission_keys']);
    }

    public function test_permission_sync_implications(): void
    {
        [, $adminToken] = $this->userWithRole('admin');
        $roleId = $this->withToken($adminToken)
            ->postJson('/api/roles', ['name' => 'Games Sync'])
            ->assertCreated()
            ->json('id');

        $viewOnly = $this->withToken($adminToken)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [PermissionCatalog::QUIZ_VIEW],
            ])
            ->assertOk()
            ->json('permission_keys');
        $this->assertEqualsCanonicalizing([PermissionCatalog::QUIZ_VIEW], $viewOnly);

        $create = $this->withToken($adminToken)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [PermissionCatalog::QUIZ_CREATE],
            ])
            ->assertOk()
            ->json('permission_keys');
        $this->assertEqualsCanonicalizing([
            PermissionCatalog::QUIZ_VIEW,
            PermissionCatalog::QUIZ_CREATE,
            PermissionCatalog::QUIZ_MANAGE_OWN,
        ], $create);

        $manage = $this->withToken($adminToken)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [PermissionCatalog::QUIZ_MANAGE],
            ])
            ->assertOk()
            ->json('permission_keys');
        $this->assertEqualsCanonicalizing([
            PermissionCatalog::QUIZ_VIEW,
            PermissionCatalog::QUIZ_CREATE,
            PermissionCatalog::QUIZ_MANAGE_OWN,
            PermissionCatalog::QUIZ_MANAGE,
        ], $manage);

        $removedCreate = $this->withToken($adminToken)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [
                    PermissionCatalog::QUIZ_VIEW,
                    PermissionCatalog::QUIZ_CREATE,
                    PermissionCatalog::QUIZ_MANAGE_OWN,
                ],
            ])
            ->assertOk()
            ->json('permission_keys');
        $this->assertEqualsCanonicalizing([
            PermissionCatalog::QUIZ_VIEW,
            PermissionCatalog::QUIZ_CREATE,
            PermissionCatalog::QUIZ_MANAGE_OWN,
        ], $removedCreate);

        $viewAfterRemovingCreate = $this->withToken($adminToken)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [PermissionCatalog::QUIZ_VIEW],
            ])
            ->assertOk()
            ->json('permission_keys');
        $this->assertEqualsCanonicalizing([PermissionCatalog::QUIZ_VIEW], $viewAfterRemovingCreate);
        $this->assertNotContains(PermissionCatalog::QUIZ_MANAGE_OWN, $viewAfterRemovingCreate);

        $exactVisibleCreate = $this->withToken($adminToken)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [
                    PermissionCatalog::QUIZ_VIEW,
                    PermissionCatalog::QUIZ_CREATE,
                ],
            ])
            ->assertOk()
            ->json('permission_keys');
        $this->assertEqualsCanonicalizing([
            PermissionCatalog::QUIZ_VIEW,
            PermissionCatalog::QUIZ_CREATE,
            PermissionCatalog::QUIZ_MANAGE_OWN,
        ], $exactVisibleCreate);
    }

    public function test_empty_games_selection_does_not_add_games_permissions(): void
    {
        [, $adminToken] = $this->userWithRole('admin');
        $roleId = $this->withToken($adminToken)
            ->postJson('/api/roles', ['name' => 'Games Empty'])
            ->assertCreated()
            ->json('id');

        $this->withToken($adminToken)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [
                    PermissionCatalog::QUIZ_VIEW,
                    PermissionCatalog::QUIZ_CREATE,
                    PermissionCatalog::NETWORK_VIEW,
                ],
            ])
            ->assertOk();

        $keys = $this->withToken($adminToken)
            ->putJson('/api/roles/'.$roleId.'/permissions', [
                'permission_keys' => [PermissionCatalog::NETWORK_VIEW],
            ])
            ->assertOk()
            ->json('permission_keys');

        $this->assertEqualsCanonicalizing([PermissionCatalog::NETWORK_VIEW], $keys);
        $this->assertNotContains(PermissionCatalog::QUIZ_VIEW, $keys);
        $this->assertNotContains(PermissionCatalog::QUIZ_CREATE, $keys);
        $this->assertNotContains(PermissionCatalog::QUIZ_MANAGE_OWN, $keys);
        $this->assertNotContains(PermissionCatalog::QUIZ_MANAGE, $keys);
    }

    public function test_user_without_view_is_forbidden_from_published_play_and_join(): void
    {
        [$hr] = $this->userWithRole('hr');
        $quiz = $this->makePublishedQuiz($hr);
        [, $userToken] = $this->userWithRole('user');

        $this->withToken($userToken)
            ->getJson('/api/quizzes?scope=published')
            ->assertForbidden();
        $this->withToken($userToken)
            ->getJson('/api/quizzes/'.$quiz->id)
            ->assertForbidden();
        $this->withToken($userToken)
            ->getJson('/api/quizzes?scope=mine')
            ->assertForbidden();
        $this->withToken($userToken)
            ->postJson('/api/quizzes', ['title' => 'Nope'])
            ->assertForbidden();
        $this->withToken($userToken)
            ->postJson('/api/quizzes/'.$quiz->id.'/sessions', ['mode' => 'async'])
            ->assertForbidden();
    }

    public function test_view_only_user_can_browse_play_and_join_but_cannot_create_or_manage(): void
    {
        [$hr, $hrToken] = $this->userWithRole('hr');
        $quiz = $this->makePublishedQuiz($hr);
        [$viewer, $viewerToken] = $this->userWithPermissionKeys([PermissionCatalog::QUIZ_VIEW]);

        $this->withToken($viewerToken)
            ->getJson('/api/quizzes?scope=published')
            ->assertOk()
            ->assertJsonFragment(['id' => $quiz->id]);
        $this->withToken($viewerToken)
            ->getJson('/api/quizzes/'.$quiz->id)
            ->assertOk();
        $this->withToken($viewerToken)
            ->postJson('/api/quizzes/'.$quiz->id.'/sessions', ['mode' => 'async'])
            ->assertCreated();

        $this->withToken($viewerToken)
            ->postJson('/api/quizzes', ['title' => 'Blocked'])
            ->assertForbidden();
        $this->withToken($viewerToken)
            ->getJson('/api/quizzes?scope=mine')
            ->assertForbidden();
        $this->withToken($viewerToken)
            ->patchJson('/api/quizzes/'.$quiz->id, ['title' => 'Stolen'])
            ->assertForbidden();
        $this->withToken($viewerToken)
            ->postJson('/api/quizzes/'.$quiz->id.'/sessions', ['mode' => 'live'])
            ->assertForbidden();

        $draft = Quiz::create([
            'user_id' => $hr->id,
            'title' => 'Unpublished draft',
            'status' => Quiz::STATUS_DRAFT,
        ]);
        $this->withToken($viewerToken)
            ->getJson('/api/quizzes/'.$draft->id)
            ->assertForbidden();

        $live = $this->withToken($hrToken)
            ->postJson('/api/quizzes/'.$quiz->id.'/sessions', ['mode' => 'live'])
            ->assertCreated()
            ->json();

        $this->withToken($viewerToken)
            ->postJson('/api/quiz-sessions/join', ['pin' => $live['pin']])
            ->assertOk();

        $this->getJson('/api/quiz-join/'.$live['join_token'])
            ->assertOk()
            ->assertJsonPath('pin', $live['pin']);
    }

    public function test_pin_join_without_view_is_forbidden_after_auth(): void
    {
        [$hr, $hrToken] = $this->userWithRole('hr');
        $quiz = $this->makePublishedQuiz($hr);
        [, $userToken] = $this->userWithRole('user');

        $live = $this->withToken($hrToken)
            ->postJson('/api/quizzes/'.$quiz->id.'/sessions', ['mode' => 'live'])
            ->assertCreated()
            ->json();

        $this->getJson('/api/quiz-join/'.$live['join_token'])->assertOk();

        $this->withToken($userToken)
            ->postJson('/api/quiz-sessions/join', ['pin' => $live['pin']])
            ->assertForbidden();
    }

    public function test_hr_can_manage_own_quiz_but_not_another_users(): void
    {
        [$hr, $hrToken] = $this->userWithRole('hr');
        [$other] = $this->userWithRole('user');
        $own = $this->makePublishedQuiz($hr);
        $theirs = $this->makePublishedQuiz($other);

        $this->withToken($hrToken)
            ->patchJson('/api/quizzes/'.$own->id, ['title' => 'Renamed'])
            ->assertOk()
            ->assertJsonPath('title', 'Renamed');
        $this->withToken($hrToken)
            ->patchJson('/api/quizzes/'.$theirs->id, ['title' => 'Hijack'])
            ->assertForbidden();
    }

    public function test_admin_can_manage_another_users_quiz(): void
    {
        [$owner] = $this->userWithRole('user');
        [, $adminToken] = $this->userWithRole('admin');
        $quiz = $this->makePublishedQuiz($owner);

        $this->withToken($adminToken)
            ->patchJson('/api/quizzes/'.$quiz->id, ['title' => 'Admin renamed'])
            ->assertOk()
            ->assertJsonPath('title', 'Admin renamed');
    }
}
