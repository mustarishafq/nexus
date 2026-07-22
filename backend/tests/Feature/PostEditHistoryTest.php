<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostEdit;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostEditHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_author_can_edit_post_and_history_is_recorded(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($author);

        $create = $this->withToken($token)
            ->postJson('/api/posts', ['body' => '<p><strong>Salam bos</strong></p>'])
            ->assertCreated();

        $postId = $create->json('item.id');
        $this->assertNotEmpty($postId);
        $this->assertFalse($create->json('item.is_edited'));
        $this->assertTrue($create->json('item.can_edit'));

        $this->withToken($token)
            ->putJson("/api/posts/{$postId}", [
                'body' => '<p><strong>Salam bos</strong></p><p>checklist harini</p><ol><li><p>one</p></li></ol>',
            ])
            ->assertOk()
            ->assertJsonPath('item.is_edited', true)
            ->assertJsonPath('item.edits_count', 1);

        $this->assertDatabaseHas('post_edits', [
            'post_id' => $postId,
            'editor_user_id' => $author->id,
            'body' => '<p><strong>Salam bos</strong></p>',
        ]);

        $this->withToken($token)
            ->getJson("/api/posts/{$postId}/edits")
            ->assertOk()
            ->assertJsonCount(1, 'edits')
            ->assertJsonPath('edits.0.body', '<p><strong>Salam bos</strong></p>');
    }

    public function test_non_author_cannot_edit_post(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $other = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $authorToken = ApiTokenAuth::issueToken($author);
        $otherToken = ApiTokenAuth::issueToken($other);

        $postId = $this->withToken($authorToken)
            ->postJson('/api/posts', ['body' => 'Original'])
            ->assertCreated()
            ->json('item.id');

        Post::query()->whereKey($postId)->update(['approval_status' => Post::APPROVAL_APPROVED]);

        $this->withToken($otherToken)
            ->putJson("/api/posts/{$postId}", ['body' => 'Hacked'])
            ->assertForbidden();

        $this->assertSame(0, PostEdit::query()->count());
        $this->assertDatabaseHas('posts', [
            'id' => $postId,
            'body' => 'Original',
        ]);
    }
}
