<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\ReactionEmojis;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostReactionCollectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_react_with_collection_emoji_on_post(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $reactor = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $reactorToken = ApiTokenAuth::issueToken($reactor);

        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Post',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $item = $this->withToken($reactorToken)
            ->postJson("/api/posts/{$post->id}/reactions", ['reaction' => '🚀'])
            ->assertOk()
            ->json('item');

        $this->assertSame('🚀', $item['my_reaction']['reaction']);
        $this->assertSame(1, $item['reaction_counts']['🚀']);
        $this->assertSame(ReactionEmojis::QUICK, $item['available_reactions']);
    }

    public function test_unknown_reaction_emoji_is_rejected(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $reactor = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $reactorToken = ApiTokenAuth::issueToken($reactor);

        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Post',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $this->withToken($reactorToken)
            ->postJson("/api/posts/{$post->id}/reactions", ['reaction' => 'not-an-emoji'])
            ->assertStatus(422);
    }

    public function test_user_can_react_with_collection_emoji_on_comment(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $reactor = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $reactorToken = ApiTokenAuth::issueToken($reactor);

        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Post',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $comment = PostComment::query()->create([
            'post_id' => $post->id,
            'author_user_id' => $author->id,
            'body' => 'Comment',
        ]);

        $payload = $this->withToken($reactorToken)
            ->postJson("/api/post-comments/{$comment->id}/reactions", ['reaction' => '🚀'])
            ->assertOk()
            ->json('comment');

        $this->assertSame('🚀', $payload['my_reaction']['reaction']);
        $this->assertSame(1, $payload['reaction_counts']['🚀']);
    }
}
