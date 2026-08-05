<?php

namespace Tests\Feature;

use App\Models\Broadcast;
use App\Models\Post;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeedAuthorFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_author_filter_returns_only_that_users_visible_posts(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $other = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($viewer);

        $authorPost = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Author post',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
        $otherPost = Post::query()->create([
            'author_user_id' => $other->id,
            'body' => 'Other post',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
        $pendingOwn = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Pending author post',
            'approval_status' => Post::APPROVAL_PENDING,
        ]);

        Broadcast::create([
            'title' => 'Company broadcast',
            'message' => 'Should not appear on profile feed',
            'audience_type' => Broadcast::AUDIENCE_ALL,
        ]);

        $items = $this->withToken($token)
            ->getJson('/api/feed?author_user_id='.$author->id)
            ->assertOk()
            ->json('items');

        $ids = collect($items)->pluck('id')->map(fn ($id) => (int) $id)->all();
        $types = collect($items)->pluck('type')->unique()->values()->all();

        $this->assertSame(['post'], $types);
        $this->assertContains($authorPost->id, $ids);
        $this->assertNotContains($otherPost->id, $ids);
        $this->assertNotContains($pendingOwn->id, $ids);
        $this->assertFalse(collect($items)->contains(
            fn (array $item) => ($item['type'] ?? null) === 'broadcast'
        ));
    }

    public function test_author_can_see_own_pending_posts_on_profile_feed(): void
    {
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($author);

        $pending = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'My pending post',
            'approval_status' => Post::APPROVAL_PENDING,
        ]);

        $items = $this->withToken($token)
            ->getJson('/api/feed?author_user_id='.$author->id)
            ->assertOk()
            ->json('items');

        $this->assertTrue(collect($items)->contains(
            fn (array $item) => ($item['type'] ?? null) === 'post' && (int) ($item['id'] ?? 0) === $pending->id
        ));
    }

    public function test_author_filter_rejects_unknown_user(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($viewer);

        $this->withToken($token)
            ->getJson('/api/feed?author_user_id=999999')
            ->assertStatus(422);
    }

    public function test_company_feed_still_rejects_limit_over_fifty(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($viewer);

        $this->withToken($token)
            ->getJson('/api/feed?limit=100')
            ->assertStatus(422);
    }

    public function test_author_filter_allows_limit_up_to_one_hundred(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($viewer);

        $this->withToken($token)
            ->getJson('/api/feed?author_user_id='.$author->id.'&limit=100')
            ->assertOk();
    }
}
