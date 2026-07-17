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
            'name' => 'Alice Anderson',
            'full_name' => 'Alice Marie Anderson',
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
            ->assertJsonPath('0.name', 'Alice Anderson');
    }

    public function test_search_matches_full_name_when_display_name_differs(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($viewer);

        User::factory()->create([
            'name' => 'Alex',
            'full_name' => 'Alexander Hamilton',
            'email' => 'alex@example.com',
            'is_approved' => true,
        ]);

        $this->withToken($token)
            ->getJson('/api/users/search?q=Hamilton')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Alex');
    }

    public function test_directory_matches_full_name_when_display_name_differs(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($viewer);

        User::factory()->create([
            'name' => 'Alex',
            'full_name' => 'Alexander Hamilton',
            'email' => 'alex@example.com',
            'is_approved' => true,
        ]);

        $this->withToken($token)
            ->getJson('/api/users/directory?q=Hamilton')
            ->assertOk()
            ->assertJsonPath('users.0.name', 'Alex')
            ->assertJsonCount(1, 'users');
    }

    public function test_profile_returns_public_profile(): void
    {
        $viewer = User::factory()->create(['is_approved' => true]);
        $target = User::factory()->create([
            'name' => 'Preview Target',
            'full_name' => 'Preview Target Legal',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($viewer);

        $this->withToken($token)
            ->getJson("/api/users/{$target->id}/profile")
            ->assertOk()
            ->assertJsonPath('user.name', 'Preview Target')
            ->assertJsonMissingPath('user.full_name')
            ->assertJsonStructure(['user']);
    }

    public function test_admin_profile_returns_private_fields(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $target = User::factory()->create([
            'name' => 'Admin View Target',
            'full_name' => 'Admin View Legal Name',
            'ic_number' => '900101-01-1234',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($viewer);

        $this->withToken($token)
            ->getJson("/api/users/{$target->id}/profile")
            ->assertOk()
            ->assertJsonPath('user.full_name', 'Admin View Legal Name')
            ->assertJsonPath('user.ic_number', '900101-01-1234');
    }

    public function test_hr_profile_returns_private_fields(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $target = User::factory()->create([
            'name' => 'HR View Target',
            'full_name' => 'HR View Legal Name',
            'epf_number' => 'EPF-12345',
            'is_approved' => true,
        ]);
        $token = $this->issueToken($viewer);

        $this->withToken($token)
            ->getJson("/api/users/{$target->id}/profile")
            ->assertOk()
            ->assertJsonPath('user.full_name', 'HR View Legal Name')
            ->assertJsonPath('user.epf_number', 'EPF-12345');
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
