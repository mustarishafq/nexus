<?php

namespace Tests\Feature;

use App\Models\Broadcast;
use App\Models\Department;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BroadcastAudienceTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        return ApiTokenAuth::issueToken($user);
    }

    public function test_scope_filters_individual_audience_in_database(): void
    {
        $included = User::factory()->create(['is_approved' => true]);
        $excluded = User::factory()->create(['is_approved' => true]);

        $broadcast = Broadcast::create([
            'title' => 'Private update',
            'audience_type' => Broadcast::AUDIENCE_INDIVIDUAL,
        ]);
        $broadcast->assignedUsers()->sync([$included->id]);

        $excludedCount = Broadcast::query()
            ->where('id', $broadcast->id)
            ->where(function ($query) use ($excluded) {
                \App\Support\BroadcastAudience::scopeVisibleToUser($query, $excluded);
            })
            ->count();

        $this->assertSame(0, $excludedCount);
    }

    public function test_active_broadcasts_are_filtered_by_individual_audience(): void
    {
        $included = User::factory()->create(['is_approved' => true]);
        $excluded = User::factory()->create(['is_approved' => true]);

        $broadcast = Broadcast::create([
            'title' => 'Private update',
            'message' => 'For selected users only',
            'audience_type' => Broadcast::AUDIENCE_INDIVIDUAL,
        ]);
        $broadcast->assignedUsers()->sync([$included->id]);

        $this->assertSame('individual', $broadcast->fresh()->audience_type);
        $this->assertDatabaseCount('broadcast_users', 1);

        $includedResponse = $this->withToken($this->issueToken($included))
            ->getJson('/api/broadcasts?active_only=1')
            ->assertOk();

        $this->assertCount(1, $includedResponse->json());
        $this->assertSame($broadcast->id, $includedResponse->json('0.id'));

        $excludedResponse = $this->withToken($this->issueToken($excluded))
            ->getJson('/api/broadcasts?active_only=1')
            ->assertOk();

        $this->assertCount(0, $excludedResponse->json());
    }

    public function test_active_broadcasts_are_filtered_by_department_audience(): void
    {
        $department = Department::query()->create(['name' => 'Engineering']);
        $otherDepartment = Department::query()->create(['name' => 'Finance']);

        $included = User::factory()->create([
            'is_approved' => true,
            'department_id' => $department->id,
        ]);
        $excluded = User::factory()->create([
            'is_approved' => true,
            'department_id' => $otherDepartment->id,
        ]);

        $broadcast = Broadcast::create([
            'title' => 'Engineering update',
            'audience_type' => Broadcast::AUDIENCE_DEPARTMENT,
        ]);
        $broadcast->assignedDepartments()->sync([$department->id]);

        $includedResponse = $this->withToken($this->issueToken($included))
            ->getJson('/api/broadcasts?active_only=1')
            ->assertOk();

        $this->assertCount(1, $includedResponse->json());

        $excludedResponse = $this->withToken($this->issueToken($excluded))
            ->getJson('/api/broadcasts?active_only=1')
            ->assertOk();

        $this->assertCount(0, $excludedResponse->json());
    }

    public function test_admin_list_includes_all_broadcasts_without_audience_filter(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create(['is_approved' => true]);

        $broadcast = Broadcast::create([
            'title' => 'Private update',
            'audience_type' => Broadcast::AUDIENCE_INDIVIDUAL,
        ]);
        $broadcast->assignedUsers()->sync([$user->id]);

        $response = $this->withToken($this->issueToken($admin))
            ->getJson('/api/broadcasts')
            ->assertOk();

        $this->assertCount(1, $response->json());
        $this->assertSame('individual', $response->json('0.audience_type'));
    }

    public function test_store_requires_users_for_individual_audience(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $this->withToken($this->issueToken($admin))
            ->postJson('/api/broadcasts', [
                'title' => 'Targeted update',
                'audience_type' => Broadcast::AUDIENCE_INDIVIDUAL,
                'user_ids' => [],
            ])
            ->assertUnprocessable();
    }
}
