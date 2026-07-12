<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostCommentInteractionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_reply_to_a_comment(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $replier = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $replierToken = ApiTokenAuth::issueToken($replier);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Hello team'])
            ->assertCreated()
            ->json('item.id');

        // Ensure post is approved for interaction in approval-off default environments.
        Post::query()->whereKey($postId)->update(['approval_status' => Post::APPROVAL_APPROVED]);

        $parentId = $this->withToken($authorToken)
            ->postJson("/api/posts/{$postId}/comments", ['body' => 'Top-level comment'])
            ->assertCreated()
            ->json('comment.id');

        $reply = $this->withToken($replierToken)
            ->postJson("/api/posts/{$postId}/comments", [
                'body' => 'A nested reply',
                'parent_comment_id' => $parentId,
            ])
            ->assertCreated()
            ->json('comment');

        $this->assertSame($parentId, $reply['parent_comment_id']);
        $this->assertSame('A nested reply', $reply['body']);

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $author->id,
            'title' => $replier->displayName().' replied to your comment',
        ]);

        $comments = $this->withToken($replierToken)
            ->getJson("/api/posts/{$postId}/comments")
            ->assertOk()
            ->json('comments');

        $this->assertCount(1, $comments);
        $this->assertCount(1, $comments[0]['replies']);
        $this->assertSame('A nested reply', $comments[0]['replies'][0]['body']);
    }

    public function test_reply_to_a_reply_nests_under_that_reply(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($user);

        $post = Post::query()->create([
            'author_user_id' => $user->id,
            'body' => 'Post',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $parent = PostComment::query()->create([
            'post_id' => $post->id,
            'author_user_id' => $user->id,
            'body' => 'Parent',
        ]);

        $child = PostComment::query()->create([
            'post_id' => $post->id,
            'parent_comment_id' => $parent->id,
            'author_user_id' => $user->id,
            'body' => 'Child',
        ]);

        $reply = $this->withToken($token)
            ->postJson("/api/posts/{$post->id}/comments", [
                'body' => 'Reply to child',
                'parent_comment_id' => $child->id,
            ])
            ->assertCreated()
            ->json('comment');

        $this->assertSame($child->id, $reply['parent_comment_id']);

        $comments = $this->withToken($token)
            ->getJson("/api/posts/{$post->id}/comments")
            ->assertOk()
            ->json('comments');

        $this->assertCount(1, $comments);
        $this->assertSame('Child', $comments[0]['replies'][0]['body']);
        $this->assertSame('Reply to child', $comments[0]['replies'][0]['replies'][0]['body']);
    }

    public function test_user_can_react_to_a_comment(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $reactor = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $authorToken = ApiTokenAuth::issueToken($author);
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

        $reacted = $this->withToken($reactorToken)
            ->postJson("/api/post-comments/{$comment->id}/reactions", ['reaction' => '👍'])
            ->assertOk()
            ->json('comment');

        $this->assertSame('👍', $reacted['my_reaction']['reaction']);
        $this->assertSame(1, $reacted['reaction_counts']['👍']);

        $toggledOff = $this->withToken($reactorToken)
            ->postJson("/api/post-comments/{$comment->id}/reactions", ['reaction' => '👍'])
            ->assertOk()
            ->json('comment');

        $this->assertNull($toggledOff['my_reaction']);
        $this->assertSame(0, $toggledOff['reaction_counts']['👍'] ?? 0);

        $this->withToken($reactorToken)
            ->postJson("/api/post-comments/{$comment->id}/reactions", ['reaction' => '❤️'])
            ->assertOk();

        $switched = $this->withToken($reactorToken)
            ->postJson("/api/post-comments/{$comment->id}/reactions", ['reaction' => '🔥'])
            ->assertOk()
            ->json('comment');

        $this->assertSame('🔥', $switched['my_reaction']['reaction']);
        $this->assertArrayNotHasKey('❤️', array_filter($switched['reaction_counts']));
        $this->assertSame(1, $switched['reaction_counts']['🔥']);

        $removed = $this->withToken($reactorToken)
            ->deleteJson("/api/post-comments/{$comment->id}/reactions")
            ->assertOk()
            ->json('comment');

        $this->assertNull($removed['my_reaction']);
    }
}
