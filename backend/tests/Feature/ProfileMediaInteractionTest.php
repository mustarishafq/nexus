<?php

namespace Tests\Feature;

use App\Models\ProfileMediaComment;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileMediaInteractionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_view_react_and_comment_on_profile_media(): void
    {
        $owner = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'profile_picture' => 'https://example.com/avatar.jpg',
            'cover_picture' => 'https://example.com/cover.jpg',
        ]);
        $reactor = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($reactor);

        $item = $this->withToken($token)
            ->getJson("/api/users/{$owner->id}/profile-media/avatar")
            ->assertOk()
            ->json('item');

        $this->assertSame('avatar', $item['media_type']);
        $this->assertSame('https://example.com/avatar.jpg', $item['image_url']);
        $this->assertSame(0, $item['comments_count']);

        $reacted = $this->withToken($token)
            ->postJson("/api/users/{$owner->id}/profile-media/avatar/reactions", ['reaction' => '👍'])
            ->assertOk()
            ->json('item');

        $this->assertSame(1, $reacted['reaction_counts']['👍']);
        $this->assertSame('👍', $reacted['my_reaction']['reaction']);

        $toggledOff = $this->withToken($token)
            ->postJson("/api/users/{$owner->id}/profile-media/avatar/reactions", ['reaction' => '👍'])
            ->assertOk()
            ->json('item');

        $this->assertSame(0, $toggledOff['reaction_counts']['👍'] ?? 0);
        $this->assertNull($toggledOff['my_reaction']);

        $this->withToken($token)
            ->postJson("/api/users/{$owner->id}/profile-media/cover/reactions", ['reaction' => '🔥'])
            ->assertOk();

        $comment = $this->withToken($token)
            ->postJson("/api/users/{$owner->id}/profile-media/cover/comments", ['body' => 'Nice cover!'])
            ->assertCreated()
            ->json('comment');

        $this->assertSame('Nice cover!', $comment['body']);
        $this->assertSame('cover', $comment['media_type']);

        $reply = $this->withToken($token)
            ->postJson("/api/users/{$owner->id}/profile-media/cover/comments", [
                'body' => 'Thanks!',
                'parent_comment_id' => $comment['id'],
            ])
            ->assertCreated()
            ->json('comment');

        $this->assertSame($comment['id'], $reply['parent_comment_id']);

        $comments = $this->withToken($token)
            ->getJson("/api/users/{$owner->id}/profile-media/cover/comments")
            ->assertOk()
            ->json('comments');

        $this->assertCount(1, $comments);
        $this->assertCount(1, $comments[0]['replies']);

        $this->withToken($token)
            ->postJson("/api/profile-media-comments/{$comment['id']}/reactions", ['reaction' => '❤️'])
            ->assertOk()
            ->assertJsonPath('comment.my_reaction.reaction', '❤️');
    }

    public function test_replacing_profile_or_cover_photo_clears_interactions(): void
    {
        $owner = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'profile_picture' => 'https://example.com/avatar-old.jpg',
            'cover_picture' => 'https://example.com/cover-old.jpg',
        ]);
        $commenter = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $ownerToken = ApiTokenAuth::issueToken($owner);
        $commenterToken = ApiTokenAuth::issueToken($commenter);

        $this->withToken($commenterToken)
            ->postJson("/api/users/{$owner->id}/profile-media/avatar/comments", ['body' => 'Nice avatar'])
            ->assertCreated();

        $this->withToken($commenterToken)
            ->postJson("/api/users/{$owner->id}/profile-media/avatar/reactions", ['reaction' => '👍'])
            ->assertOk();

        $this->withToken($commenterToken)
            ->postJson("/api/users/{$owner->id}/profile-media/cover/comments", ['body' => 'Nice cover'])
            ->assertCreated();

        $this->withToken($commenterToken)
            ->postJson("/api/users/{$owner->id}/profile-media/cover/reactions", ['reaction' => '🔥'])
            ->assertOk();

        $this->withToken($ownerToken)
            ->patchJson('/api/me', ['profile_picture' => 'https://example.com/avatar-new.jpg'])
            ->assertOk();

        $this->assertDatabaseMissing('profile_media_comments', [
            'owner_user_id' => $owner->id,
            'media_type' => 'avatar',
        ]);
        $this->assertDatabaseMissing('profile_media_reactions', [
            'owner_user_id' => $owner->id,
            'media_type' => 'avatar',
        ]);
        $this->assertDatabaseHas('profile_media_comments', [
            'owner_user_id' => $owner->id,
            'media_type' => 'cover',
            'body' => 'Nice cover',
        ]);

        $this->withToken($ownerToken)
            ->patchJson('/api/me', ['cover_picture' => 'https://example.com/cover-new.jpg'])
            ->assertOk();

        $this->assertDatabaseMissing('profile_media_comments', [
            'owner_user_id' => $owner->id,
            'media_type' => 'cover',
        ]);
        $this->assertDatabaseMissing('profile_media_reactions', [
            'owner_user_id' => $owner->id,
            'media_type' => 'cover',
        ]);
    }

    public function test_invalid_media_type_returns_not_found(): void
    {
        $owner = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($viewer);

        $this->withToken($token)
            ->getJson("/api/users/{$owner->id}/profile-media/banner")
            ->assertNotFound();
    }

    public function test_only_author_or_admin_can_delete_comment(): void
    {
        $owner = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $other = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);

        $comment = ProfileMediaComment::query()->create([
            'owner_user_id' => $owner->id,
            'media_type' => 'avatar',
            'author_user_id' => $author->id,
            'body' => 'Hello',
        ]);

        $this->withToken(ApiTokenAuth::issueToken($other))
            ->deleteJson("/api/profile-media-comments/{$comment->id}")
            ->assertForbidden();

        $this->withToken(ApiTokenAuth::issueToken($author))
            ->deleteJson("/api/profile-media-comments/{$comment->id}")
            ->assertNoContent();

        $comment2 = ProfileMediaComment::query()->create([
            'owner_user_id' => $owner->id,
            'media_type' => 'avatar',
            'author_user_id' => $author->id,
            'body' => 'Again',
        ]);

        $this->withToken(ApiTokenAuth::issueToken($admin))
            ->deleteJson("/api/profile-media-comments/{$comment2->id}")
            ->assertNoContent();
    }
}
