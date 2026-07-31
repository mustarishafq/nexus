<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApplicationMyUsageTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('m', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_my_usage_returns_personal_launch_counts(): void
    {
        $user = User::factory()->create(['role' => 'user', 'is_approved' => true]);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'slug' => 'nexus-analytics',
            'visibility' => 'private',
            'created_by_user_id' => $user->id,
        ]);

        $this->createLaunch($user, $application->slug, now()->subDays(2));
        $this->createLaunch($user, $application->slug, now()->subDays(10), 'view');
        $this->createLaunch($user, $application->slug, now()->subDays(45));

        // Other user's launches should not count.
        $other = User::factory()->create();
        $this->createLaunch($other, $application->slug, now()->subDay());

        $this->withToken($token)
            ->getJson("/api/applications/{$application->id}/my-usage")
            ->assertOk()
            ->assertJsonPath('launches_7d', 1)
            ->assertJsonPath('launches_30d', 2)
            ->assertJsonPath('launches_all_time', 3)
            ->assertJsonStructure(['last_opened_at']);
    }

    public function test_my_usage_returns_zeros_when_never_launched(): void
    {
        $user = User::factory()->create(['role' => 'user', 'is_approved' => true]);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'visibility' => 'private',
            'created_by_user_id' => $user->id,
        ]);

        $this->withToken($token)
            ->getJson("/api/applications/{$application->id}/my-usage")
            ->assertOk()
            ->assertJson([
                'last_opened_at' => null,
                'launches_7d' => 0,
                'launches_30d' => 0,
                'launches_all_time' => 0,
            ]);
    }

    public function test_my_usage_forbidden_for_private_app_without_access(): void
    {
        $owner = User::factory()->create(['role' => 'user', 'is_approved' => true]);
        $outsider = User::factory()->create(['role' => 'user', 'is_approved' => true]);
        $token = $this->issueToken($outsider);
        $application = Application::factory()->create([
            'visibility' => 'private',
            'created_by_user_id' => $owner->id,
        ]);

        $this->withToken($token)
            ->getJson("/api/applications/{$application->id}/my-usage")
            ->assertForbidden();
    }

    private function createLaunch(User $user, string $slug, $at, string $action = 'login'): void
    {
        $log = ActivityLog::create([
            'user_id' => (string) $user->id,
            'user_name' => $user->name,
            'system_id' => $slug,
            'action' => $action,
            'description' => 'Launch',
        ]);

        $log->forceFill([
            'created_at' => $at,
            'updated_at' => $at,
        ])->save();
    }
}
