<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserOrgChartControllerTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('c', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_department_org_chart_stops_at_chief_and_excludes_gceo(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($viewer);

        $department = Department::query()->create(['name' => 'Digital Solution']);

        $gceo = User::factory()->create([
            'full_name' => 'Tuan Haji Mohammad Faizal Bin Zainon',
            'is_approved' => true,
            'department_id' => null,
            'manager_id' => null,
        ]);

        $chief = User::factory()->create([
            'full_name' => 'Muhammad Zahran Bin Yahya',
            'is_approved' => true,
            'department_id' => null,
            'manager_id' => $gceo->id,
        ]);

        $report = User::factory()->create([
            'full_name' => 'Mustari Shafiq',
            'is_approved' => true,
            'department_id' => $department->id,
            'manager_id' => $chief->id,
            'job_title' => 'Digital Solutions Executive',
        ]);

        $response = $this->withToken($token)
            ->getJson("/api/users/org-chart?department_id={$department->id}")
            ->assertOk()
            ->assertJsonPath('department.name', 'Digital Solution')
            ->assertJsonCount(1, 'tree')
            ->assertJsonPath('tree.0.user.id', $chief->id)
            ->assertJsonPath('tree.0.reports.0.user.id', $report->id);

        $treeUserIds = $this->collectTreeUserIds($response->json('tree'));
        $this->assertContains($chief->id, $treeUserIds);
        $this->assertContains($report->id, $treeUserIds);
        $this->assertNotContains($gceo->id, $treeUserIds);
    }

    public function test_department_org_chart_includes_direct_reports_outside_department(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($viewer);

        $department = Department::query()->create(['name' => 'Digital Solution']);

        $manager = User::factory()->create([
            'full_name' => 'Mustari Shafiq',
            'is_approved' => true,
            'department_id' => $department->id,
            'manager_id' => null,
        ]);

        $report = User::factory()->create([
            'full_name' => 'Direct Report',
            'is_approved' => true,
            'department_id' => null,
            'manager_id' => $manager->id,
        ]);

        $this->withToken($token)
            ->getJson("/api/users/org-chart?department_id={$department->id}")
            ->assertOk()
            ->assertJsonPath('tree.0.user.id', $manager->id)
            ->assertJsonPath('tree.0.reports.0.user.id', $report->id);
    }

    public function test_company_org_chart_shows_full_chain_to_gceo(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($viewer);

        $department = Department::query()->create(['name' => 'Digital Solution']);

        $gceo = User::factory()->create([
            'full_name' => 'Tuan Haji Mohammad Faizal Bin Zainon',
            'is_approved' => true,
            'manager_id' => null,
        ]);

        $chief = User::factory()->create([
            'full_name' => 'Muhammad Zahran Bin Yahya',
            'is_approved' => true,
            'manager_id' => $gceo->id,
        ]);

        $report = User::factory()->create([
            'name' => 'Mustari Shafiq',
            'full_name' => 'Mustari Shafiq',
            'is_approved' => true,
            'department_id' => $department->id,
            'manager_id' => $chief->id,
        ]);

        $response = $this->withToken($token)
            ->getJson('/api/users/org-chart')
            ->assertOk();

        $gceoBranch = collect($response->json('tree'))->firstWhere('user.id', $gceo->id);

        $this->assertNotNull($gceoBranch);
        $this->assertSame($chief->id, $gceoBranch['reports'][0]['user']['id']);
        $mustariBranch = collect($gceoBranch['reports'][0]['reports'])->firstWhere('user.id', $report->id);
        $this->assertNotNull($mustariBranch);
        $this->assertSame('Mustari Shafiq', $mustariBranch['user']['name']);
    }

    public function test_company_org_chart_hides_users_without_manager_or_reports(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($viewer);

        $orphan = User::factory()->create([
            'full_name' => 'Unassigned Colleague',
            'is_approved' => true,
            'manager_id' => null,
        ]);

        $gceo = User::factory()->create([
            'full_name' => 'Tuan Haji Mohammad Faizal Bin Zainon',
            'is_approved' => true,
            'manager_id' => null,
        ]);

        User::factory()->create([
            'full_name' => 'Muhammad Zahran Bin Yahya',
            'is_approved' => true,
            'manager_id' => $gceo->id,
        ]);

        $response = $this->withToken($token)
            ->getJson('/api/users/org-chart')
            ->assertOk();

        $treeUserIds = $this->collectTreeUserIds($response->json('tree'));

        $this->assertContains($gceo->id, $treeUserIds);
        $this->assertNotContains($orphan->id, $treeUserIds);
        $this->assertNotContains($viewer->id, $treeUserIds);
    }

    /**
     * @param  array<int, array<string, mixed>>  $tree
     * @return array<int, int>
     */
    private function collectTreeUserIds(array $tree): array
    {
        $ids = [];

        foreach ($tree as $branch) {
            if (isset($branch['user']['id'])) {
                $ids[] = $branch['user']['id'];
            }

            if (! empty($branch['reports'])) {
                $ids = array_merge($ids, $this->collectTreeUserIds($branch['reports']));
            }
        }

        return $ids;
    }
}
