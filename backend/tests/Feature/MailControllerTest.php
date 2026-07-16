<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MailControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_mail_status_requires_authentication(): void
    {
        $this->getJson('/api/mail/status')
            ->assertUnauthorized();
    }

    public function test_mail_status_reports_unconfigured_server(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->getJson('/api/mail/status')
            ->assertOk()
            ->assertJson([
                'configured' => false,
                'reachable' => false,
                'connected' => false,
                'email' => $user->email,
                'accounts' => [],
            ])
            ->assertJsonStructure([
                'folders' => [
                    ['id', 'label'],
                ],
            ]);
    }

    public function test_mail_status_reports_configured_server(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = ApiTokenAuth::issueToken($user);

        DB::table('app_settings')->insert([
            'system_name' => 'Nexus',
            'smtp_host' => 'mail.example.com',
            'smtp_port' => 587,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withToken($token)
            ->getJson('/api/mail/status')
            ->assertOk()
            ->assertJson([
                'configured' => true,
                'connected' => false,
            ]);
    }

    public function test_user_can_have_multiple_mail_credentials(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        DB::table('user_mail_credentials')->insert([
            [
                'user_id' => $user->id,
                'email' => 'primary@example.com',
                'label' => 'Primary',
                'is_primary' => true,
                'password' => 'encrypted-one',
                'verified_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'user_id' => $user->id,
                'email' => 'secondary@example.com',
                'label' => 'Secondary',
                'is_primary' => false,
                'password' => 'encrypted-two',
                'verified_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->assertDatabaseCount('user_mail_credentials', 2);
        $this->assertSame(2, DB::table('user_mail_credentials')->where('user_id', $user->id)->count());
    }
}
