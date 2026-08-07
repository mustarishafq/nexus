<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeedPaginationTest extends TestCase
{
    use RefreshDatabase;

    public function test_feed_paginates_with_before_cursor(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($viewer);

        $createdIds = [];
        for ($i = 0; $i < 45; $i++) {
            $post = Post::query()->create([
                'author_user_id' => $author->id,
                'body' => "Post {$i}",
                'approval_status' => Post::APPROVAL_APPROVED,
            ]);
            $post->forceFill(['created_at' => now()->subMinutes(45 - $i)])->save();
            $createdIds[] = $post->id;
        }

        $page1 = $this->withToken($token)
            ->getJson('/api/feed?limit=30')
            ->assertOk()
            ->assertJsonPath('has_more', true);

        $page1Items = $page1->json('items');
        $this->assertCount(30, $page1Items);
        $this->assertNotEmpty($page1->json('next_before'));

        $page1Ids = collect($page1Items)->pluck('id')->all();
        $this->assertSame(array_slice(array_reverse($createdIds), 0, 30), $page1Ids);

        $page2 = $this->withToken($token)
            ->getJson('/api/feed?limit=30&before='.urlencode($page1->json('next_before')))
            ->assertOk()
            ->assertJsonPath('has_more', false);

        $page2Items = $page2->json('items');
        $this->assertCount(15, $page2Items);
        $this->assertNull($page2->json('next_before'));

        $page2Ids = collect($page2Items)->pluck('id')->all();
        $this->assertSame(array_slice(array_reverse($createdIds), 30, 15), $page2Ids);
        $this->assertEmpty(array_intersect($page1Ids, $page2Ids));
    }

    public function test_feed_first_page_reports_has_more_false_when_short(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($viewer);

        Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Only post',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $this->withToken($token)
            ->getJson('/api/feed?limit=30')
            ->assertOk()
            ->assertJsonPath('has_more', false)
            ->assertJsonPath('next_before', null)
            ->assertJsonCount(1, 'items');
    }
}
