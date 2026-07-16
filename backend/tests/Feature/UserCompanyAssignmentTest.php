<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserCompanyAssignmentTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('c', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_hr_can_assign_company_when_updating_user(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $company = Company::query()->create(['name' => 'Emzi Properties']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->patchJson("/api/users/{$user->id}", ['company_id' => $company->id])
            ->assertOk()
            ->assertJsonPath('company_id', $company->id)
            ->assertJsonPath('company', 'Emzi Properties');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'company_id' => $company->id,
        ]);
    }

    public function test_admin_can_create_user_with_company(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $company = Company::query()->create(['name' => 'Nexus Holdings']);
        $token = $this->issueToken($admin);

        $this->withToken($token)
            ->postJson('/api/users', [
                'full_name' => 'New Hire',
                'email' => 'new.hire@example.com',
                'password' => 'Password@123',
                'company_id' => $company->id,
            ])
            ->assertCreated()
            ->assertJsonPath('company_id', $company->id)
            ->assertJsonPath('company', 'Nexus Holdings');
    }

    public function test_regular_user_cannot_list_or_create_companies(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->getJson('/api/companies')
            ->assertForbidden();

        $this->withToken($token)
            ->postJson('/api/companies', ['name' => 'Forbidden Co'])
            ->assertForbidden();
    }

    public function test_regular_user_cannot_self_assign_company_via_me(): void
    {
        $company = Company::query()->create(['name' => 'Self Assign Co']);
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'company_id' => null,
        ]);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->patchJson('/api/me', ['company_id' => $company->id])
            ->assertOk();

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'company_id' => null,
        ]);
    }

    public function test_hr_can_create_company(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->postJson('/api/companies', ['name' => 'HR Created Co'])
            ->assertCreated()
            ->assertJsonPath('name', 'HR Created Co');
    }
}
