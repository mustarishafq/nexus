<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserSearchControllerTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('a', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_search_requires_authentication(): void
    {
        $this->getJson('/api/users/search?q=alice')
            ->assertUnauthorized();
    }

    public function test_search_returns_matching_approved_users(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($viewer);

        User::factory()->create([
            'full_name' => 'Alice Anderson',
            'email' => 'alice@example.com',
            'is_approved' => true,
        ]);
        User::factory()->create([
            'full_name' => 'Bob Builder',
            'email' => 'bob@example.com',
            'is_approved' => true,
        ]);
        User::factory()->create([
            'full_name' => 'Pending User',
            'email' => 'pending@example.com',
            'is_approved' => false,
        ]);

        $this->withToken($token)
            ->getJson('/api/users/search?q=alice')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.full_name', 'Alice Anderson');
    }

    public function test_profile_returns_public_profile(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $target = User::factory()->create([
            'full_name' => 'Preview Target',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($viewer);

        $this->withToken($token)
            ->getJson("/api/users/{$target->id}/profile")
            ->assertOk()
            ->assertJsonPath('user.full_name', 'Preview Target')
            ->assertJsonStructure(['user']);
    }

    public function test_profile_rejects_unapproved_user(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $target = User::factory()->create(['is_approved' => false]);
        $token = $this->issueToken($viewer);

        $this->withToken($token)
            ->getJson("/api/users/{$target->id}/profile")
            ->assertNotFound();
    }
}
