<?php

namespace Tests\Feature;

use App\Models\PlatformReleaseNote;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformReleaseNoteTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_publish_and_users_see_unread(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $adminToken = ApiTokenAuth::issueToken($admin);
        $userToken = ApiTokenAuth::issueToken($user);

        $note = $this->withToken($adminToken)
            ->postJson('/api/platform-release-notes', [
                'title' => 'Nexus calendar widgets',
                'items' => [
                    [
                        'category' => 'feature',
                        'body' => 'Weekly calendar is now on the dashboard.',
                    ],
                    [
                        'category' => 'improvement',
                        'body' => 'Faster widget loading.',
                    ],
                ],
                'version' => '2.1.0',
                'is_published' => true,
            ])
            ->assertCreated()
            ->json();

        $this->assertSame('Nexus calendar widgets', $note['title']);
        $this->assertCount(2, $note['items']);
        $this->assertSame('feature', $note['items'][0]['category']);
        $this->assertFalse($note['is_read']);

        $this->withToken($userToken)
            ->getJson('/api/platform-release-notes/unread-count')
            ->assertOk()
            ->assertJson(['count' => 1]);

        $listed = $this->withToken($userToken)
            ->getJson('/api/platform-release-notes')
            ->assertOk()
            ->json();

        $this->assertCount(1, $listed);
        $this->assertFalse($listed[0]['is_read']);

        $this->withToken($userToken)
            ->postJson('/api/platform-release-notes/mark-read')
            ->assertOk()
            ->assertJson(['marked' => 1]);

        $this->withToken($userToken)
            ->getJson('/api/platform-release-notes/unread-count')
            ->assertOk()
            ->assertJson(['count' => 0]);
    }

    public function test_non_admin_cannot_create_or_see_drafts(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $adminToken = ApiTokenAuth::issueToken($admin);
        $userToken = ApiTokenAuth::issueToken($user);

        $this->withToken($userToken)
            ->postJson('/api/platform-release-notes', [
                'title' => 'Nope',
            ])
            ->assertForbidden();

        $draft = PlatformReleaseNote::create([
            'created_by_user_id' => $admin->id,
            'title' => 'Draft only',
            'is_published' => false,
            'published_at' => null,
        ]);
        $draft->syncItems([
            ['category' => 'fix', 'body' => 'Draft detail'],
        ]);

        $live = PlatformReleaseNote::create([
            'created_by_user_id' => $admin->id,
            'title' => 'Live note',
            'is_published' => true,
            'published_at' => now(),
        ]);
        $live->syncItems([
            ['category' => 'feature', 'body' => 'Live detail'],
        ]);

        $userList = $this->withToken($userToken)
            ->getJson('/api/platform-release-notes')
            ->assertOk()
            ->json();

        $this->assertCount(1, $userList);
        $this->assertSame('Live note', $userList[0]['title']);

        $adminList = $this->withToken($adminToken)
            ->getJson('/api/platform-release-notes')
            ->assertOk()
            ->json();

        $this->assertCount(2, $adminList);
    }
}
