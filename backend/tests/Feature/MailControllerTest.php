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
}
