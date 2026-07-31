<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostComment;
use App\Models\PostReaction;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeedActiveDiscussionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_discussions_ranks_by_engagement_and_excludes_quiet_or_stale_posts(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $reactor = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($viewer);

        $hotPost = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Hot discussion',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
        $hotPost->forceFill(['created_at' => now()->subDays(2)])->save();

        $warmPost = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Warm discussion',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
        $warmPost->forceFill(['created_at' => now()->subDays(1)])->save();

        $quietRecent = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Quiet this week',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
        $quietRecent->forceFill(['created_at' => now()->subDays(1)])->save();

        $oldQuiet = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Old and quiet',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
        $oldQuiet->forceFill(['created_at' => now()->subDays(20)])->save();

        $oldRevived = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Old but revived',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
        $oldRevived->forceFill(['created_at' => now()->subDays(20)])->save();

        PostReaction::query()->create([
            'post_id' => $hotPost->id,
            'user_id' => $reactor->id,
            'reaction' => '🔥',
        ]);
        PostReaction::query()->create([
            'post_id' => $hotPost->id,
            'user_id' => $viewer->id,
            'reaction' => '👍',
        ]);
        PostComment::query()->create([
            'post_id' => $hotPost->id,
            'author_user_id' => $reactor->id,
            'body' => 'Nice!',
        ]);
        PostComment::query()->create([
            'post_id' => $hotPost->id,
            'author_user_id' => $viewer->id,
            'body' => 'Agreed',
        ]);

        PostReaction::query()->create([
            'post_id' => $warmPost->id,
            'user_id' => $reactor->id,
            'reaction' => '👏',
        ]);

        $revivedReaction = PostReaction::query()->create([
            'post_id' => $oldRevived->id,
            'user_id' => $reactor->id,
            'reaction' => '❤️',
        ]);
        $revivedReaction->forceFill(['created_at' => now()->subDay()])->save();

        $items = $this->withToken($token)
            ->getJson('/api/feed/active?limit=5')
            ->assertOk()
            ->json('items');

        $ids = collect($items)->pluck('id')->map(fn ($id) => (int) $id)->all();

        $this->assertSame([(int) $hotPost->id, (int) $warmPost->id, (int) $oldRevived->id], $ids);
        $this->assertSame(4, (int) $items[0]['reactions_count'] + (int) $items[0]['comments_count']);
        $this->assertSame(1, (int) $items[1]['reactions_count'] + (int) $items[1]['comments_count']);
        $this->assertSame(1, (int) $items[2]['reactions_count'] + (int) $items[2]['comments_count']);
        $this->assertNotContains((int) $quietRecent->id, $ids);
        $this->assertNotContains((int) $oldQuiet->id, $ids);
    }

    public function test_active_discussions_requires_auth(): void
    {
        $this->getJson('/api/feed/active')->assertUnauthorized();
    }
}
