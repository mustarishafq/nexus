<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeedPostSoftDeleteTest extends TestCase
{
    use RefreshDatabase;

    private function createApprovedPost(User $author, string $body = 'Live post'): Post
    {
        return Post::query()->create([
            'author_user_id' => $author->id,
            'body' => $body,
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
    }

    private function feedContainsPost(?array $payload, int $postId): bool
    {
        return collect($payload['items'] ?? [])->contains(
            fn (array $item) => ($item['type'] ?? null) === 'post' && (int) ($item['id'] ?? 0) === $postId
        );
    }

    private function feedPost(?array $payload, int $postId): ?array
    {
        return collect($payload['items'] ?? [])->first(
            fn (array $item) => ($item['type'] ?? null) === 'post' && (int) ($item['id'] ?? 0) === $postId
        );
    }

    public function test_admin_and_hr_see_deleted_posts_in_feed_with_restore_flag(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $post = $this->createApprovedPost($author, 'Please keep me');
        $post->delete();

        foreach ([$admin, $hr] as $moderator) {
            $feed = $this->withToken(ApiTokenAuth::issueToken($moderator))
                ->getJson('/api/feed')
                ->assertOk()
                ->json();

            $item = $this->feedPost($feed, (int) $post->id);
            $this->assertNotNull($item);
            $this->assertTrue($item['is_deleted']);
            $this->assertTrue($item['can_restore']);
            $this->assertFalse($item['can_delete']);
            $this->assertFalse($item['can_edit']);
            $this->assertNotEmpty($item['deleted_at']);
        }
    }

    public function test_author_sees_own_deleted_post_and_can_restore_it(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($author);
        $post = $this->createApprovedPost($author, 'Oops');
        $post->delete();

        $feed = $this->withToken($token)
            ->getJson('/api/feed')
            ->assertOk()
            ->json();

        $item = $this->feedPost($feed, (int) $post->id);
        $this->assertNotNull($item);
        $this->assertTrue($item['is_deleted']);
        $this->assertTrue($item['can_restore']);

        $restored = $this->withToken($token)
            ->postJson("/api/posts/{$post->id}/restore")
            ->assertOk()
            ->json('item');

        $this->assertFalse($restored['is_deleted']);
        $this->assertNull($restored['deleted_at']);
        $this->assertFalse($restored['can_restore']);
        $this->assertDatabaseHas('posts', [
            'id' => $post->id,
            'deleted_at' => null,
        ]);
    }

    public function test_other_regular_users_do_not_see_deleted_posts(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $post = $this->createApprovedPost($author);
        $post->delete();

        $feed = $this->withToken(ApiTokenAuth::issueToken($viewer))
            ->getJson('/api/feed')
            ->assertOk()
            ->json();

        $this->assertFalse($this->feedContainsPost($feed, (int) $post->id));
    }

    public function test_exclude_deleted_omits_deleted_posts_for_moderators(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $live = $this->createApprovedPost($author, 'Still here');
        $deleted = $this->createApprovedPost($author, 'Gone');
        $deleted->delete();

        $feed = $this->withToken(ApiTokenAuth::issueToken($admin))
            ->getJson('/api/feed?exclude_deleted=1')
            ->assertOk()
            ->json();

        $this->assertTrue($this->feedContainsPost($feed, (int) $live->id));
        $this->assertFalse($this->feedContainsPost($feed, (int) $deleted->id));
    }

    public function test_comment_and_react_on_deleted_post_return_unprocessable(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $token = ApiTokenAuth::issueToken($admin);
        $post = $this->createApprovedPost($author);
        PostComment::query()->create([
            'post_id' => $post->id,
            'author_user_id' => $author->id,
            'body' => 'Keep this comment',
        ]);
        $post->delete();

        $this->withToken($token)
            ->postJson("/api/posts/{$post->id}/comments", ['body' => 'Nope'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This post has been deleted.');

        $this->withToken($token)
            ->postJson("/api/posts/{$post->id}/reactions", ['reaction' => '👍'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This post has been deleted.');

        $comments = $this->withToken($token)
            ->getJson("/api/posts/{$post->id}/comments")
            ->assertOk()
            ->json('comments');

        $this->assertCount(1, $comments);
        $this->assertSame('Keep this comment', $comments[0]['body']);
    }

    public function test_hr_can_restore_deleted_post_and_it_reappears_for_everyone(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $hr = User::factory()->create(['is_approved' => true, 'role' => 'hr']);
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $post = $this->createApprovedPost($author, 'Bring me back');
        $post->delete();

        $this->withToken(ApiTokenAuth::issueToken($hr))
            ->postJson("/api/posts/{$post->id}/restore")
            ->assertOk()
            ->assertJsonPath('item.is_deleted', false)
            ->assertJsonPath('item.can_restore', false);

        $viewerFeed = $this->withToken(ApiTokenAuth::issueToken($viewer))
            ->getJson('/api/feed')
            ->assertOk()
            ->json();

        $item = $this->feedPost($viewerFeed, (int) $post->id);
        $this->assertNotNull($item);
        $this->assertFalse($item['is_deleted']);
    }

    public function test_non_author_without_moderate_cannot_restore(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $other = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $post = $this->createApprovedPost($author);
        $post->delete();

        $this->withToken(ApiTokenAuth::issueToken($other))
            ->postJson("/api/posts/{$post->id}/restore")
            ->assertForbidden();
    }

    public function test_share_preview_does_not_leak_deleted_post(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        $author = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'name' => 'Secret Author',
        ]);
        $post = $this->createApprovedPost($author, 'Deleted secret body should not leak');
        $post->delete();

        $response = $this->get('/share/posts/'.$post->id);

        $response->assertOk();
        $html = $response->getContent();
        $this->assertStringContainsString('property="og:title" content="EMZI Nexus Brain"', $html);
        $this->assertStringNotContainsString('Secret Author', $html);
        $this->assertStringNotContainsString('Deleted secret body', $html);
    }

    public function test_deleted_posts_are_excluded_from_active_discussions(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $post = $this->createApprovedPost($author, 'Hot but deleted');
        PostComment::query()->create([
            'post_id' => $post->id,
            'author_user_id' => $author->id,
            'body' => 'Comment',
        ]);
        $post->delete();

        $items = $this->withToken(ApiTokenAuth::issueToken($admin))
            ->getJson('/api/feed/active')
            ->assertOk()
            ->json('items');

        $this->assertFalse(collect($items)->contains(
            fn (array $item) => (int) ($item['id'] ?? 0) === (int) $post->id
        ));
    }
}
