<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileNudgeControllerTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('p', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_profile_nudge_requires_admin(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $target = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->postJson("/api/users/{$target->id}/profile-nudge")
            ->assertForbidden();
    }

    public function test_admin_can_nudge_user_with_incomplete_profile(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $target = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Incomplete User',
            'name' => '',
        ]);
        $token = $this->issueToken($admin);

        $this->withToken($token)
            ->postJson("/api/users/{$target->id}/profile-nudge")
            ->assertOk()
            ->assertJsonPath('completeness.percent', fn ($value) => $value < 100);

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $target->id,
            'category' => 'hr',
            'action_url' => '/profile',
        ]);

        $target->refresh();
        $this->assertNotNull($target->last_profile_nudge_at);
    }

    public function test_profile_nudge_is_rate_limited(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $target = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Incomplete User',
            'name' => '',
            'last_profile_nudge_at' => now(),
        ]);
        $token = $this->issueToken($admin);

        $this->withToken($token)
            ->postJson("/api/users/{$target->id}/profile-nudge")
            ->assertStatus(422)
            ->assertJsonPath('message', 'A profile reminder was sent recently. Try again later.');
    }

    public function test_admin_can_bulk_nudge_incomplete_profiles(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Incomplete User',
            'name' => '',
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Complete User',
            'name' => 'Display Name',
            'profile_picture' => 'https://example.com/p.jpg',
            'cover_picture' => 'https://example.com/c.jpg',
            'bio' => 'Bio',
            'department_id' => null,
            'work_phone' => '123',
            'date_of_birth' => '1990-01-01',
            'joined_at' => '2020-01-01',
        ]);
        $token = $this->issueToken($admin);

        $response = $this->withToken($token)
            ->postJson('/api/users/nudge-incomplete-profiles')
            ->assertOk();

        $this->assertGreaterThanOrEqual(1, $response->json('sent'));
        $this->assertGreaterThan(0, Notification::query()->where('category', 'hr')->count());
    }

    public function test_user_index_includes_profile_completeness(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        User::factory()->create(['is_approved' => true, 'role' => 'user', 'full_name' => 'Test User', 'name' => '']);
        $token = $this->issueToken($admin);

        $response = $this->withToken($token)
            ->getJson('/api/users')
            ->assertOk();

        $this->assertArrayHasKey('profile_completeness', $response->json('0'));
        $this->assertArrayHasKey('percent', $response->json('0.profile_completeness'));
    }
}
