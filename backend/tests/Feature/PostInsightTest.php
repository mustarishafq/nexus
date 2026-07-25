<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Post;
use App\Models\PostReach;
use App\Models\PostView;
use App\Models\User;
use App\Services\PushNotificationService;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;

class PostInsightTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_feed_includes_seen_reach_and_can_view_insights(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $viewerToken = ApiTokenAuth::issueToken($viewer);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Hello feed'])
            ->assertCreated()
            ->json('item.id');

        PostView::query()->create([
            'post_id' => $postId,
            'user_id' => $viewer->id,
            'seen_at' => now(),
        ]);
        PostReach::query()->create([
            'post_id' => $postId,
            'user_id' => $viewer->id,
            'reached_at' => now(),
        ]);

        $authorFeedItem = collect($this->withToken($authorToken)->getJson('/api/feed')->assertOk()->json('items'))
            ->first(fn (array $item) => ($item['type'] ?? null) === 'post' && (int) $item['id'] === (int) $postId);

        $this->assertNotNull($authorFeedItem);
        $this->assertSame(1, $authorFeedItem['seen_count']);
        $this->assertSame(1, $authorFeedItem['reach_count']);
        $this->assertTrue($authorFeedItem['can_view_insights']);

        $viewerFeedItem = collect($this->withToken($viewerToken)->getJson('/api/feed')->assertOk()->json('items'))
            ->first(fn (array $item) => ($item['type'] ?? null) === 'post' && (int) $item['id'] === (int) $postId);

        $this->assertNotNull($viewerFeedItem);
        $this->assertSame(1, $viewerFeedItem['seen_count']);
        $this->assertSame(1, $viewerFeedItem['reach_count']);
        $this->assertFalse($viewerFeedItem['can_view_insights']);
    }

    public function test_mark_seen_is_idempotent_and_skips_author(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $viewerToken = ApiTokenAuth::issueToken($viewer);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Seen test'])
            ->assertCreated()
            ->json('item.id');

        $this->withToken($authorToken)
            ->postJson("/api/posts/{$postId}/seen")
            ->assertOk()
            ->assertJsonPath('marked', false);

        $this->assertSame(0, PostView::query()->where('post_id', $postId)->count());

        $this->withToken($viewerToken)
            ->postJson('/api/posts/seen', ['post_ids' => [$postId, $postId]])
            ->assertOk()
            ->assertJsonPath('marked_post_ids.0', $postId);

        $this->assertSame(1, PostView::query()->where('post_id', $postId)->count());

        $this->withToken($viewerToken)
            ->postJson("/api/posts/{$postId}/seen")
            ->assertOk()
            ->assertJsonPath('marked', true);

        $this->assertSame(1, PostView::query()->where('post_id', $postId)->count());
    }

    public function test_pending_post_is_not_marked_seen(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $viewerToken = ApiTokenAuth::issueToken($viewer);

        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Pending',
            'approval_status' => Post::APPROVAL_PENDING,
        ]);

        $this->withToken($viewerToken)
            ->postJson("/api/posts/{$post->id}/seen")
            ->assertNotFound();

        $this->assertSame(0, PostView::query()->count());
    }

    public function test_seen_list_allowed_for_author_hr_admin_forbidden_for_others(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $viewerToken = ApiTokenAuth::issueToken($viewer);
        $hrToken = ApiTokenAuth::issueToken($hr);
        $adminToken = ApiTokenAuth::issueToken($admin);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Insights'])
            ->assertCreated()
            ->json('item.id');

        PostView::query()->create([
            'post_id' => $postId,
            'user_id' => $viewer->id,
            'seen_at' => now(),
        ]);

        $this->withToken($viewerToken)
            ->getJson("/api/posts/{$postId}/seen")
            ->assertForbidden();

        $this->withToken($authorToken)
            ->getJson("/api/posts/{$postId}/seen")
            ->assertOk()
            ->assertJsonCount(1, 'views')
            ->assertJsonPath('views.0.user.id', $viewer->id);

        $this->withToken($hrToken)
            ->getJson("/api/posts/{$postId}/seen")
            ->assertOk()
            ->assertJsonCount(1, 'views');

        $this->withToken($adminToken)
            ->getJson("/api/posts/{$postId}/reaches")
            ->assertOk()
            ->assertJsonPath('total', 0);
    }

    public function test_publish_records_reach_for_successful_push_recipients(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user', 'name' => 'Author']);
        $recipient = User::factory()->create(['is_approved' => true, 'role' => 'user', 'name' => 'Recipient']);
        $noPush = User::factory()->create(['is_approved' => true, 'role' => 'user', 'name' => 'No Push']);
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

        $pushMock = Mockery::mock(PushNotificationService::class);
        $pushMock->shouldReceive('sendNotification')
            ->andReturnUsing(function (Notification $notification) {
                return [(int) $notification->user_id];
            });
        $this->app->instance(PushNotificationService::class, $pushMock);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Published with push'])
            ->assertCreated()
            ->json('item.id');

        $this->assertDatabaseHas('post_reaches', [
            'post_id' => $postId,
            'user_id' => $recipient->id,
        ]);
        $this->assertDatabaseMissing('post_reaches', [
            'post_id' => $postId,
            'user_id' => $noPush->id,
        ]);
        $this->assertDatabaseMissing('post_reaches', [
            'post_id' => $postId,
            'user_id' => $author->id,
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $recipient->id,
            'title' => 'New feed post',
        ]);

        $this->withToken($authorToken)
            ->getJson("/api/posts/{$postId}/reaches")
            ->assertOk()
            ->assertJsonCount(1, 'reaches')
            ->assertJsonPath('reaches.0.user.id', $recipient->id);
    }

    public function test_hr_can_view_insights_flag_on_others_posts(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $hrToken = ApiTokenAuth::issueToken($hr);

        $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'HR insights'])
            ->assertCreated();

        $item = collect($this->withToken($hrToken)->getJson('/api/feed')->assertOk()->json('items'))
            ->first(fn (array $row) => ($row['type'] ?? null) === 'post');

        $this->assertNotNull($item);
        $this->assertTrue($item['can_view_insights']);
    }
}
