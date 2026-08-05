<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeedFocusPostTest extends TestCase
{
    use RefreshDatabase;

    public function test_focus_post_includes_old_post_and_pins_it_first(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($viewer);

        $oldPost = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Old focused post',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
        $oldPost->forceFill(['created_at' => now()->subMonths(6)])->save();

        for ($i = 0; $i < 35; $i++) {
            $post = Post::query()->create([
                'author_user_id' => $author->id,
                'body' => "Recent post {$i}",
                'approval_status' => Post::APPROVAL_APPROVED,
            ]);
            $post->forceFill(['created_at' => now()->subMinutes(35 - $i)])->save();
        }

        $withoutFocus = $this->withToken($token)
            ->getJson('/api/feed?limit=30')
            ->assertOk()
            ->json('items');

        $this->assertFalse(collect($withoutFocus)->contains(
            fn (array $item) => ($item['type'] ?? null) === 'post' && (int) ($item['id'] ?? 0) === $oldPost->id
        ));

        $withFocus = $this->withToken($token)
            ->getJson('/api/feed?limit=30&focus_post='.$oldPost->id)
            ->assertOk()
            ->json('items');

        $this->assertNotEmpty($withFocus);
        $this->assertSame('post', $withFocus[0]['type'] ?? null);
        $this->assertSame($oldPost->id, (int) ($withFocus[0]['id'] ?? 0));
        $this->assertTrue(collect($withFocus)->contains(
            fn (array $item) => ($item['type'] ?? null) === 'post' && (int) ($item['id'] ?? 0) === $oldPost->id
        ));
    }

    public function test_focus_post_pins_recent_post_already_in_page(): void
    {
        $viewer = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = ApiTokenAuth::issueToken($viewer);

        $olderInPage = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Older but still in page',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
        $olderInPage->forceFill(['created_at' => now()->subHour()])->save();

        $newest = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Newest post',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);
        $newest->forceFill(['created_at' => now()])->save();

        $items = $this->withToken($token)
            ->getJson('/api/feed?limit=30&focus_post='.$olderInPage->id)
            ->assertOk()
            ->json('items');

        $this->assertSame($olderInPage->id, (int) ($items[0]['id'] ?? 0));
        $this->assertTrue(collect($items)->contains(
            fn (array $item) => (int) ($item['id'] ?? 0) === $newest->id
        ));
    }
}
