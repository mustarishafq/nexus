<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageSharedPostPreviewTest extends TestCase
{
    use RefreshDatabase;

    private function approvedUser(): User
    {
        return User::factory()->create(['is_approved' => true, 'role' => 'user']);
    }

    private function createPost(User $author, array $attrs = []): Post
    {
        return Post::query()->create(array_merge([
            'author_user_id' => $author->id,
            'body' => '<p>Hello <strong>team</strong> @[1|Ali]</p>',
            'image_urls' => ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
            'approval_status' => Post::APPROVAL_APPROVED,
        ], $attrs));
    }

    private function shareBody(Post $post, string $note = 'Check this out'): string
    {
        return "{$note}\n\nhttps://nexus.example.com/share/posts/{$post->id}";
    }

    public function test_shared_post_link_includes_preview_for_recipient(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();
        $author = $this->approvedUser();
        $post = $this->createPost($author);

        $sent = $this->withToken(ApiTokenAuth::issueToken($alice))
            ->postJson('/api/conversations', ['recipient_user_id' => $bob->id, 'body' => $this->shareBody($post)])
            ->assertCreated()
            ->json();

        $this->assertSame($post->id, $sent['message']['shared_post']['id']);
        $this->assertTrue($sent['message']['shared_post']['is_available']);

        $preview = $this->withToken(ApiTokenAuth::issueToken($bob))
            ->getJson("/api/conversations/{$sent['conversation']['id']}/messages")
            ->assertOk()
            ->json('messages.0.shared_post');

        $this->assertTrue($preview['is_available']);
        $this->assertSame($author->id, $preview['author']['id']);
        $this->assertSame('Hello team @Ali', $preview['excerpt']);
        $this->assertSame('https://cdn.example.com/a.jpg', $preview['image_url']);
        $this->assertSame(2, $preview['image_count']);
        $this->assertSame("/feed?post={$post->id}", $preview['path']);
    }

    public function test_deleted_or_hidden_posts_are_marked_unavailable(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();
        $deleted = $this->createPost($alice);
        $deleted->delete();
        $pendingByOther = $this->createPost($alice, ['approval_status' => Post::APPROVAL_PENDING]);
        $aliceToken = ApiTokenAuth::issueToken($alice);

        $conversationId = $this->withToken($aliceToken)
            ->postJson('/api/conversations', ['recipient_user_id' => $bob->id, 'body' => $this->shareBody($deleted)])
            ->assertCreated()
            ->json('conversation.id');
        $this->withToken($aliceToken)
            ->postJson("/api/conversations/{$conversationId}/messages", ['body' => $this->shareBody($pendingByOther)])
            ->assertCreated();

        $messages = $this->withToken(ApiTokenAuth::issueToken($bob))
            ->getJson("/api/conversations/{$conversationId}/messages")
            ->assertOk()
            ->json('messages');

        foreach ($messages as $message) {
            $this->assertFalse($message['shared_post']['is_available']);
            $this->assertArrayNotHasKey('excerpt', $message['shared_post']);
        }
    }

    public function test_plain_messages_have_no_shared_post(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();

        $message = $this->withToken(ApiTokenAuth::issueToken($alice))
            ->postJson('/api/conversations', ['recipient_user_id' => $bob->id, 'body' => 'See https://example.com/docs'])
            ->assertCreated()
            ->json('message');

        $this->assertNull($message['shared_post']);
    }
}
