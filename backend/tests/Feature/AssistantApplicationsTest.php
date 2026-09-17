<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use App\Models\UserSystemAccess;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssistantApplicationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_role_user_sees_assigned_mcp_enabled_apps_without_enabling_mcp(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'mcp_access' => McpUserAccess::NONE,
            'assistant_access' => McpUserAccess::READ,
        ]);
        $application = Application::factory()->create([
            'name' => 'EMZI Nexus Care',
            'slug' => 'nexus-care',
            'mcp_enabled' => true,
            'visibility' => 'public',
            'is_enabled' => true,
        ]);
        $access = UserSystemAccess::query()->create([
            'user_email' => $user->email,
        ]);
        $access->allowedApplications()->attach($application->id);

        $this->withToken(ApiTokenAuth::issueToken($user))
            ->getJson('/api/assistant/applications')
            ->assertOk()
            ->assertJsonCount(1, 'applications')
            ->assertJsonPath('applications.0.slug', 'nexus-care');
    }
}
