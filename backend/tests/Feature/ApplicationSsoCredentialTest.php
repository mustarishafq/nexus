<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationSsoCredential;
use App\Models\Notification;
use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApplicationSsoCredentialTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('s', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_user_submitted_sso_credential_starts_pending(): void
    {
        $user = User::factory()->create(['email' => 'primary@example.com', 'role' => 'admin']);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'auth_mode' => 'jwt',
            'visibility' => 'public',
        ]);

        $this->withToken($token)
            ->postJson("/api/applications/{$application->id}/sso-credentials", [
                'email' => 'alt@example.com',
                'label' => 'Admin account',
            ])
            ->assertCreated()
            ->assertJson([
                'email' => 'alt@example.com',
                'label' => 'Admin account',
                'status' => 'pending',
            ]);

        $this->assertDatabaseHas('application_sso_credentials', [
            'user_id' => $user->id,
            'application_id' => $application->id,
            'email' => 'alt@example.com',
            'status' => 'pending',
        ]);
    }

    public function test_pending_sso_credential_is_not_available_for_launch(): void
    {
        $user = User::factory()->create(['email' => 'primary@example.com', 'role' => 'admin']);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'auth_mode' => 'jwt',
            'visibility' => 'public',
        ]);

        ApplicationSsoCredential::create([
            'user_id' => $user->id,
            'application_id' => $application->id,
            'email' => 'alt@example.com',
            'label' => 'Alt account',
            'status' => ApplicationSsoCredential::STATUS_PENDING,
        ]);

        $this->withToken($token)
            ->getJson("/api/applications/{$application->id}/sso-credentials")
            ->assertOk()
            ->assertJsonPath('primary_email', 'primary@example.com')
            ->assertJsonCount(1, 'credentials')
            ->assertJsonPath('credentials.0.status', 'pending')
            ->assertJsonCount(1, 'launch_options');
    }

    public function test_launch_uses_approved_sso_email_in_token(): void
    {
        $user = User::factory()->create(['email' => 'primary@example.com', 'role' => 'admin']);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'auth_mode' => 'jwt',
            'api_key' => 'test-api-key-with-at-least-32-characters',
            'base_url' => 'https://app.example.com',
            'visibility' => 'public',
        ]);

        ApplicationSsoCredential::create([
            'user_id' => $user->id,
            'application_id' => $application->id,
            'email' => 'alt@example.com',
            'label' => 'Alt account',
            'status' => ApplicationSsoCredential::STATUS_APPROVED,
        ]);

        $response = $this->withToken($token)
            ->postJson("/api/applications/{$application->id}/launch", [
                'sso_email' => 'alt@example.com',
            ])
            ->assertOk();

        $jwt = $response->json('token');
        $payload = (array) JWT::decode($jwt, new Key($application->api_key, 'HS256'));

        $this->assertSame('alt@example.com', $payload['email']);
        $this->assertArrayNotHasKey('name', $payload);
    }

    public function test_launch_includes_name_for_primary_sso_email(): void
    {
        $user = User::factory()->create([
            'email' => 'primary@example.com',
            'name' => 'Primary User',
            'role' => 'admin',
        ]);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'auth_mode' => 'jwt',
            'api_key' => 'test-api-key-with-at-least-32-characters',
            'base_url' => 'https://app.example.com',
            'visibility' => 'public',
        ]);

        $response = $this->withToken($token)
            ->postJson("/api/applications/{$application->id}/launch")
            ->assertOk();

        $jwt = $response->json('token');
        $payload = (array) JWT::decode($jwt, new Key($application->api_key, 'HS256'));

        $this->assertSame('primary@example.com', $payload['email']);
        $this->assertSame('Primary User', $payload['name']);
    }

    public function test_launch_rejects_unapproved_sso_email(): void
    {
        $user = User::factory()->create(['email' => 'primary@example.com', 'role' => 'admin']);
        $token = $this->issueToken($user);
        $application = Application::factory()->create([
            'auth_mode' => 'jwt',
            'api_key' => 'test-api-key-with-at-least-32-characters',
            'base_url' => 'https://app.example.com',
            'visibility' => 'public',
        ]);

        ApplicationSsoCredential::create([
            'user_id' => $user->id,
            'application_id' => $application->id,
            'email' => 'alt@example.com',
            'status' => ApplicationSsoCredential::STATUS_PENDING,
        ]);

        $this->withToken($token)
            ->postJson("/api/applications/{$application->id}/launch", [
                'sso_email' => 'alt@example.com',
            ])
            ->assertStatus(422);
    }

    public function test_admin_can_approve_pending_sso_credential(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $user = User::factory()->create(['email' => 'staff@example.com']);
        $application = Application::factory()->create(['auth_mode' => 'jwt', 'visibility' => 'public']);
        $credential = ApplicationSsoCredential::create([
            'user_id' => $user->id,
            'application_id' => $application->id,
            'email' => 'alt@example.com',
            'status' => ApplicationSsoCredential::STATUS_PENDING,
        ]);

        $this->withToken($this->issueToken($admin))
            ->patchJson("/api/admin/sso-credentials/{$credential->id}", [
                'status' => 'approved',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('application_sso_credentials', [
            'id' => $credential->id,
            'status' => 'approved',
            'reviewed_by_user_id' => $admin->id,
        ]);
    }

    public function test_non_admin_cannot_review_sso_credentials(): void
    {
        $user = User::factory()->create(['role' => 'user']);
        $credential = ApplicationSsoCredential::create([
            'user_id' => $user->id,
            'application_id' => Application::factory()->create()->id,
            'email' => 'alt@example.com',
            'status' => ApplicationSsoCredential::STATUS_PENDING,
        ]);

        $this->withToken($this->issueToken($user))
            ->patchJson("/api/admin/sso-credentials/{$credential->id}", [
                'status' => 'approved',
            ])
            ->assertForbidden();
    }

    public function test_sso_request_notifies_approved_admins(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_approved' => true]);
        $user = User::factory()->create(['email' => 'staff@example.com', 'role' => 'user', 'is_approved' => true]);
        $application = Application::factory()->create([
            'auth_mode' => 'jwt',
            'visibility' => 'private',
            'created_by_user_id' => $user->id,
            'name' => 'Payroll',
        ]);

        $this->withToken($this->issueToken($user))
            ->postJson("/api/applications/{$application->id}/sso-credentials", [
                'email' => 'alt@example.com',
                'label' => 'Work account',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $admin->id,
            'category' => 'approval',
            'title' => 'SSO account approval needed',
            'action_url' => '/admin/users?section=sso-links',
        ]);

        $notification = Notification::query()
            ->where('user_id', (string) $admin->id)
            ->where('category', 'approval')
            ->first();

        $this->assertNotNull($notification);
        $this->assertSame('sso_credential_pending', $notification->data['kind'] ?? null);
    }

    public function test_sso_review_notifies_requesting_user(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_approved' => true]);
        $user = User::factory()->create(['email' => 'staff@example.com', 'role' => 'user', 'is_approved' => true]);
        $application = Application::factory()->create([
            'auth_mode' => 'jwt',
            'visibility' => 'private',
            'created_by_user_id' => $user->id,
            'name' => 'Payroll',
        ]);
        $credential = ApplicationSsoCredential::create([
            'user_id' => $user->id,
            'application_id' => $application->id,
            'email' => 'alt@example.com',
            'status' => ApplicationSsoCredential::STATUS_PENDING,
        ]);

        $this->withToken($this->issueToken($admin))
            ->patchJson("/api/admin/sso-credentials/{$credential->id}", [
                'status' => 'approved',
            ])
            ->assertOk();

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $user->id,
            'category' => 'approval',
            'title' => 'SSO account approved',
            'action_url' => '/applications',
        ]);
    }
}
