<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\AppSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FeedPostApprovalTest extends TestCase
{
    use RefreshDatabase;

    private function enableFeedApproval(bool $enabled = true, array $exemptUserIds = []): void
    {
        $settings = DB::table('app_settings')->first();
        $payload = [
            'feed_posts_require_approval' => $enabled,
            'feed_post_approval_exempt_user_ids' => json_encode(array_values(array_map('intval', $exemptUserIds))),
            'updated_at' => now(),
        ];

        if ($settings) {
            DB::table('app_settings')->where('id', $settings->id)->update($payload);
        } else {
            DB::table('app_settings')->insert(array_merge([
                'system_name' => 'EMZI Nexus Brain',
                'created_at' => now(),
            ], $payload));
        }

        AppSettings::forget();
    }

    public function test_regular_user_post_is_pending_when_approval_required(): void
    {
        $this->enableFeedApproval(true);

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $viewerToken = ApiTokenAuth::issueToken($viewer);

        $create = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Needs review'])
            ->assertCreated()
            ->json('item');

        $this->assertSame('pending', $create['approval_status']);
        $this->assertTrue($create['is_pending']);

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $admin->id,
            'category' => 'approval',
            'title' => 'Feed post approval needed',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $hr->id,
            'category' => 'approval',
            'title' => 'Feed post approval needed',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => (string) $author->id,
            'title' => 'Feed post approval needed',
        ]);

        $feed = $this->withToken($viewerToken)
            ->getJson('/api/feed')
            ->assertOk()
            ->json('items');

        $this->assertFalse(collect($feed)->contains(
            fn (array $item) => ($item['type'] ?? null) === 'post' && (int) ($item['id'] ?? 0) === (int) $create['id']
        ));

        $authorFeed = $this->withToken($authorToken)
            ->getJson('/api/feed')
            ->assertOk()
            ->json('items');

        $this->assertTrue(collect($authorFeed)->contains(
            fn (array $item) => ($item['type'] ?? null) === 'post' && (int) ($item['id'] ?? 0) === (int) $create['id']
        ));
    }

    public function test_hr_can_approve_pending_post(): void
    {
        $this->enableFeedApproval(true);

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $hrToken = ApiTokenAuth::issueToken($hr);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Please approve'])
            ->assertCreated()
            ->json('item.id');

        $this->withToken($hrToken)
            ->postJson("/api/posts/{$postId}/approve")
            ->assertOk()
            ->assertJsonPath('item.approval_status', 'approved')
            ->assertJsonPath('item.is_pending', false);

        $this->assertSame(Post::APPROVAL_APPROVED, Post::query()->find($postId)?->approval_status);

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $author->id,
            'category' => 'approval',
            'title' => 'Feed post approved',
        ]);
    }

    public function test_hr_can_reject_pending_post_and_notify_author(): void
    {
        $this->enableFeedApproval(true);

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $hrToken = ApiTokenAuth::issueToken($hr);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Please reject'])
            ->assertCreated()
            ->json('item.id');

        $this->withToken($hrToken)
            ->postJson("/api/posts/{$postId}/reject")
            ->assertNoContent();

        $this->assertDatabaseMissing('posts', ['id' => $postId]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $author->id,
            'category' => 'approval',
            'title' => 'Feed post rejected',
        ]);
    }

    public function test_hr_can_toggle_feed_approval_setting(): void
    {
        $this->enableFeedApproval(false);

        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $token = ApiTokenAuth::issueToken($hr);

        $this->withToken($token)
            ->patchJson('/api/admin/app-settings', [
                'feed_posts_require_approval' => true,
            ])
            ->assertOk()
            ->assertJsonPath('feed_posts_require_approval', true);

        $this->assertTrue(AppSettings::feedPostsRequireApproval());
    }

    public function test_admin_and_hr_posts_publish_immediately_when_approval_required(): void
    {
        $this->enableFeedApproval(true);

        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $token = ApiTokenAuth::issueToken($admin);

        $this->withToken($token)
            ->postJson('/api/posts', ['body' => 'From admin'])
            ->assertCreated()
            ->assertJsonPath('item.approval_status', 'approved')
            ->assertJsonPath('item.is_pending', false);
    }

    public function test_exempt_user_can_post_without_approval(): void
    {
        $exempt = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $other = User::factory()->create(['is_approved' => true, 'role' => 'user']);

        $this->enableFeedApproval(true, [(int) $exempt->id]);

        $exemptToken = ApiTokenAuth::issueToken($exempt);
        $otherToken = ApiTokenAuth::issueToken($other);

        $this->withToken($exemptToken)
            ->postJson('/api/posts', ['body' => 'Trusted poster'])
            ->assertCreated()
            ->assertJsonPath('item.approval_status', 'approved')
            ->assertJsonPath('item.is_pending', false);

        $this->withToken($otherToken)
            ->postJson('/api/posts', ['body' => 'Needs review'])
            ->assertCreated()
            ->assertJsonPath('item.approval_status', 'pending')
            ->assertJsonPath('item.is_pending', true);

        $this->withToken($exemptToken)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('feed_post_requires_approval', false);

        $this->withToken($otherToken)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('feed_post_requires_approval', true);
    }

    public function test_hr_can_save_exempt_users(): void
    {
        $this->enableFeedApproval(true);

        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $trusted = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($hr);

        $this->withToken($token)
            ->patchJson('/api/admin/app-settings', [
                'feed_posts_require_approval' => true,
                'feed_post_approval_exempt_user_ids' => [$trusted->id],
            ])
            ->assertOk()
            ->assertJsonPath('feed_posts_require_approval', true)
            ->assertJsonPath('feed_post_approval_exempt_user_ids.0', $trusted->id)
            ->assertJsonPath('feed_post_approval_exempt_users.0.id', $trusted->id);
    }

    public function test_user_can_create_post_with_multiple_images(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($user);

        $payload = $this->withToken($token)
            ->postJson('/api/posts', [
                'body' => 'Album post',
                'image_urls' => [
                    'https://cdn.example.com/a.jpg',
                    'https://cdn.example.com/b.jpg',
                    'https://cdn.example.com/c.jpg',
                ],
            ])
            ->assertCreated()
            ->json('item');

        $this->assertSame('https://cdn.example.com/a.jpg', $payload['image_url']);
        $this->assertCount(3, $payload['image_urls']);
        $this->assertSame([
            'https://cdn.example.com/a.jpg',
            'https://cdn.example.com/b.jpg',
            'https://cdn.example.com/c.jpg',
        ], $payload['image_urls']);
    }
}
