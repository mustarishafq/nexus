<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Post;
use App\Models\User;
use App\Services\PushNotificationService;
use App\Support\ApiTokenAuth;
use App\Support\AppSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;

class FeedNotificationPreferenceTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function mockPushSuccess(): void
    {
        $pushMock = Mockery::mock(PushNotificationService::class);
        $pushMock->shouldReceive('sendNotification')
            ->andReturnUsing(function (Notification $notification) {
                return [(int) $notification->user_id];
            });
        $this->app->instance(PushNotificationService::class, $pushMock);
    }

    private function enableFeedApproval(bool $enabled = true): void
    {
        $settings = DB::table('app_settings')->first();
        $payload = [
            'feed_posts_require_approval' => $enabled,
            'feed_post_approval_exempt_user_ids' => json_encode([]),
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

    public function test_me_includes_notification_settings(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'notification_settings' => [
                'feed_posts' => false,
                'feed_comments' => true,
                'feed_mentions' => false,
            ],
        ]);
        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('notification_settings.feed_posts', false)
            ->assertJsonPath('notification_settings.feed_comments', true)
            ->assertJsonPath('notification_settings.feed_mentions', false);
    }

    public function test_feed_comments_off_skips_comment_notification(): void
    {
        $this->mockPushSuccess();

        $author = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'notification_settings' => ['feed_comments' => false],
        ]);
        $commenter = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $commenterToken = ApiTokenAuth::issueToken($commenter);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Hello team'])
            ->assertCreated()
            ->json('item.id');

        Post::query()->whereKey($postId)->update(['approval_status' => Post::APPROVAL_APPROVED]);

        $this->withToken($commenterToken)
            ->postJson("/api/posts/{$postId}/comments", ['body' => 'Nice post'])
            ->assertCreated();

        $this->assertDatabaseMissing('notifications', [
            'user_id' => (string) $author->id,
            'title' => $commenter->displayName().' commented on your post',
        ]);
    }

    public function test_feed_comments_on_creates_comment_notification(): void
    {
        $this->mockPushSuccess();

        $author = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'notification_settings' => ['feed_comments' => true],
        ]);
        $commenter = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $commenterToken = ApiTokenAuth::issueToken($commenter);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Hello team'])
            ->assertCreated()
            ->json('item.id');

        Post::query()->whereKey($postId)->update(['approval_status' => Post::APPROVAL_APPROVED]);

        $this->withToken($commenterToken)
            ->postJson("/api/posts/{$postId}/comments", ['body' => 'Nice post'])
            ->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $author->id,
            'title' => $commenter->displayName().' commented on your post',
        ]);
    }

    public function test_feed_comments_off_skips_reply_notification(): void
    {
        $this->mockPushSuccess();

        $author = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'notification_settings' => ['feed_comments' => false],
        ]);
        $replier = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $replierToken = ApiTokenAuth::issueToken($replier);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Hello team'])
            ->assertCreated()
            ->json('item.id');

        Post::query()->whereKey($postId)->update(['approval_status' => Post::APPROVAL_APPROVED]);

        $parentId = $this->withToken($authorToken)
            ->postJson("/api/posts/{$postId}/comments", ['body' => 'Top-level'])
            ->assertCreated()
            ->json('comment.id');

        $this->withToken($replierToken)
            ->postJson("/api/posts/{$postId}/comments", [
                'body' => 'A reply',
                'parent_comment_id' => $parentId,
            ])
            ->assertCreated();

        $this->assertDatabaseMissing('notifications', [
            'user_id' => (string) $author->id,
            'title' => $replier->displayName().' replied to your comment',
        ]);
    }

    public function test_feed_mentions_off_skips_mention_notification(): void
    {
        $this->mockPushSuccess();

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $mentioned = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'name' => 'Mentioned User',
            'notification_settings' => ['feed_mentions' => false],
        ]);
        $authorToken = ApiTokenAuth::issueToken($author);

        $this->withToken($authorToken)
            ->postJson('/api/posts', [
                'body' => "Hello @[{$mentioned->id}|Mentioned User]",
            ])
            ->assertCreated();

        $this->assertDatabaseMissing('notifications', [
            'user_id' => (string) $mentioned->id,
            'title' => $author->displayName().' mentioned you in a post',
        ]);
    }

    public function test_feed_mentions_on_creates_mention_notification(): void
    {
        $this->mockPushSuccess();

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $mentioned = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'name' => 'Mentioned User',
            'notification_settings' => ['feed_mentions' => true],
        ]);
        $authorToken = ApiTokenAuth::issueToken($author);

        $this->withToken($authorToken)
            ->postJson('/api/posts', [
                'body' => "Hello @[{$mentioned->id}|Mentioned User]",
            ])
            ->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $mentioned->id,
            'title' => $author->displayName().' mentioned you in a post',
        ]);
    }

    public function test_feed_posts_off_skips_published_notification_and_reach(): void
    {
        $this->mockPushSuccess();

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user', 'name' => 'Author']);
        $recipient = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'name' => 'Recipient',
            'notification_settings' => ['feed_posts' => false],
        ]);
        $authorToken = ApiTokenAuth::issueToken($author);

        DB::table('push_subscriptions')->insert([
            'user_id' => $recipient->id,
            'endpoint' => 'https://push.example.test/subscription/recipient',
            'public_key' => str_repeat('a', 87),
            'auth_token' => str_repeat('b', 22),
            'content_encoding' => 'aes128gcm',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Published with push'])
            ->assertCreated()
            ->json('item.id');

        $this->assertDatabaseMissing('notifications', [
            'user_id' => (string) $recipient->id,
            'title' => 'New feed post',
        ]);
        $this->assertDatabaseMissing('post_reaches', [
            'post_id' => $postId,
            'user_id' => $recipient->id,
        ]);
    }

    public function test_moderation_still_notifies_when_feed_prefs_off(): void
    {
        $this->mockPushSuccess();
        $this->enableFeedApproval(true);

        $author = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'notification_settings' => [
                'feed_posts' => false,
                'feed_comments' => false,
                'feed_mentions' => false,
            ],
        ]);
        $admin = User::factory()->create([
            'is_approved' => true,
            'role' => 'admin',
            'notification_settings' => [
                'feed_posts' => false,
                'feed_comments' => false,
                'feed_mentions' => false,
            ],
        ]);
        $authorToken = ApiTokenAuth::issueToken($author);
        $adminToken = ApiTokenAuth::issueToken($admin);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Needs review'])
            ->assertCreated()
            ->json('item.id');

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $admin->id,
            'category' => 'approval',
            'title' => 'Feed post approval needed',
        ]);

        $this->withToken($adminToken)
            ->postJson("/api/posts/{$postId}/approve")
            ->assertOk();

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $author->id,
            'category' => 'approval',
            'title' => 'Feed post approved',
        ]);
    }
}
