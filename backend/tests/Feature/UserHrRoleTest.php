<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class UserHrRoleTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('h', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_hr_can_list_users(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->getJson('/api/users')
            ->assertOk()
            ->assertJsonCount(2);
    }

    public function test_hr_can_import_hr_onboarding_csv(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $token = $this->issueToken($hr);

        $csv = implode("\n", [
            'email,full_name,job_title',
            'hr.created@example.com,HR Created,Analyst',
        ]);

        $file = UploadedFile::fake()->createWithContent('hr.csv', $csv);

        $this->withToken($token)
            ->post('/api/users/import-hr-onboarding-csv', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('count', 1);
    }

    public function test_hr_cannot_import_standard_user_csv(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $token = $this->issueToken($hr);

        $csv = "full_name,email,password\nJane Doe,jane@example.com,Password@123";
        $file = UploadedFile::fake()->createWithContent('users.csv', $csv);

        $this->withToken($token)
            ->post('/api/users/import-csv', ['file' => $file])
            ->assertForbidden();
    }

    public function test_hr_cannot_update_admin_user(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin', 'full_name' => 'Admin User']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->patchJson("/api/users/{$admin->id}", ['full_name' => 'Changed Name'])
            ->assertForbidden();
    }

    public function test_hr_can_nudge_incomplete_profiles(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Incomplete User',
            'name' => '',
        ]);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->postJson('/api/users/nudge-incomplete-profiles')
            ->assertOk();
    }

    public function test_hr_can_load_attendance_settings(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->getJson('/api/admin/app-settings')
            ->assertOk()
            ->assertJsonStructure([
                'attendance',
                'attendance_datetime_formats',
                'attendance_watermark_positions',
            ]);
    }

    public function test_hr_can_update_attendance_settings(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->patchJson('/api/admin/app-settings', [
                'attendance_enabled' => true,
                'attendance_watermark_show_user_name' => false,
                'attendance_watermark_position' => 'bottom-right',
            ])
            ->assertOk()
            ->assertJsonPath('attendance.show_user_name', false)
            ->assertJsonPath('attendance.position', 'bottom-right');
    }
}
