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

    public function test_hr_can_list_users_paginated_with_filters(): void
    {
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr', 'full_name' => 'HR Person']);
        User::factory()->create(['is_approved' => true, 'role' => 'user', 'full_name' => 'Alice Example', 'email' => 'alice@example.com']);
        User::factory()->create(['is_approved' => false, 'role' => 'user', 'full_name' => 'Bob Pending', 'email' => 'bob@example.com']);
        $token = $this->issueToken($hr);

        $this->withToken($token)
            ->getJson('/api/users?page=1&per_page=20&q=Alice&status=approved')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.page', 1)
            ->assertJsonPath('data.0.email', 'alice@example.com')
            ->assertJsonStructure([
                'data',
                'meta' => [
                    'total',
                    'page',
                    'per_page',
                    'last_page',
                    'stats' => [
                        'total',
                        'admins',
                        'hr',
                        'approved',
                        'pending',
                        'incomplete_profiles',
                    ],
                ],
            ]);
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

    public function test_admin_can_export_users_csv(): void
    {
        $admin = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'full_name' => 'Admin Exporter',
            'email' => 'admin.export@example.com',
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Export Target',
            'email' => 'export.target@example.com',
            'last_login_at' => null,
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Logged In User',
            'email' => 'logged.in@example.com',
            'last_login_at' => '2026-07-15 08:30:00',
        ]);
        $token = $this->issueToken($admin);

        $response = $this->withToken($token)->get('/api/users/export');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
        $csv = $response->streamedContent();
        $this->assertStringContainsString('Full Name', $csv);
        $this->assertStringContainsString('Last Login', $csv);
        $this->assertStringContainsString('export.target@example.com', $csv);
        $this->assertStringContainsString('Never login', $csv);
        $this->assertStringContainsString('logged.in@example.com', $csv);
        $this->assertStringContainsString('2026-07-15', $csv);
    }

    public function test_admin_can_export_users_csv_filtered_by_never_logged_in(): void
    {
        $admin = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'full_name' => 'Admin Never Filter',
            'email' => 'admin.never.filter@example.com',
            'last_login_at' => '2026-07-10 12:00:00',
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Never Logged In',
            'email' => 'never.logged.in@example.com',
            'last_login_at' => null,
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'Has Logged In',
            'email' => 'has.logged.in@example.com',
            'last_login_at' => '2026-07-15 08:30:00',
        ]);
        $token = $this->issueToken($admin);

        $response = $this->withToken($token)->get('/api/users/export?login=never');

        $response->assertOk();
        $csv = $response->streamedContent();
        $this->assertStringContainsString('never.logged.in@example.com', $csv);
        $this->assertStringContainsString('Never login', $csv);
        $this->assertStringNotContainsString('has.logged.in@example.com', $csv);
        $this->assertStringNotContainsString('admin.never.filter@example.com', $csv);
    }

    public function test_hr_can_export_users_csv(): void
    {
        $hr = User::factory()->create([
            'is_approved' => true,
            'role' => 'hr',
            'full_name' => 'HR Exporter',
            'email' => 'hr.export@example.com',
        ]);
        User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'full_name' => 'HR Export Target',
            'email' => 'hr.export.target@example.com',
        ]);
        $token = $this->issueToken($hr);

        $response = $this->withToken($token)->get('/api/users/export');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
        $csv = $response->streamedContent();
        $this->assertStringContainsString('hr.export.target@example.com', $csv);
    }

    public function test_regular_user_cannot_export_users_csv(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->get('/api/users/export')
            ->assertForbidden();
    }
}
