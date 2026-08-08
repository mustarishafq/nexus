<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Support\FeedLinks;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostSharePreviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_crawler_gets_rich_og_html_for_approved_post(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        $author = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'name' => 'Nas Ali',
        ]);

        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Hello @[99|Team] — mop tip with vinegar.',
            'image_urls' => ['/storage/post-images/spill.jpg'],
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $response = $this->withHeaders([
            'User-Agent' => 'WhatsApp/2.0',
        ])->get('/share/posts/'.$post->id);

        $response->assertOk();
        $html = $response->getContent();

        $this->assertStringContainsString('property="og:title" content="Nas Ali on EMZI Nexus Brain"', $html);
        $this->assertStringContainsString('property="og:description" content="Hello @Team — mop tip with vinegar."', $html);
        $this->assertStringContainsString(
            'property="og:image" content="https://brainapi.test/storage/post-images/spill.jpg"',
            $html
        );
        $this->assertStringContainsString(
            'property="og:url" content="'.FeedLinks::absolutePost($post->id).'"',
            $html
        );
        $this->assertStringContainsString('https://app.test/feed?post='.$post->id, $html);
    }

    public function test_crawler_gets_generic_og_for_pending_post(): void
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

        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Pending secret body should not leak',
            'image_urls' => ['/storage/post-images/secret.jpg'],
            'approval_status' => Post::APPROVAL_PENDING,
        ]);

        $response = $this->withHeaders([
            'User-Agent' => 'facebookexternalhit/1.1',
        ])->get('/share/posts/'.$post->id);

        $response->assertOk();
        $html = $response->getContent();

        $this->assertStringContainsString('property="og:title" content="EMZI Nexus Brain"', $html);
        $this->assertStringContainsString('sign in to view', $html);
        $this->assertStringNotContainsString('Secret Author', $html);
        $this->assertStringNotContainsString('Pending secret body', $html);
        $this->assertStringNotContainsString('secret.jpg', $html);
        $this->assertStringContainsString(
            'property="og:image" content="https://app.test/icons/pwa-icon-512.png"',
            $html
        );
    }

    public function test_crawler_gets_generic_og_for_missing_post(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        $response = $this->withHeaders([
            'User-Agent' => 'TelegramBot',
        ])->get('/share/posts/999999');

        $response->assertOk();
        $html = $response->getContent();

        $this->assertStringContainsString('property="og:title" content="EMZI Nexus Brain"', $html);
        $this->assertStringContainsString('https://app.test/feed', $html);
        $this->assertStringNotContainsString('/feed?post=999999', $html);
    }

    public function test_browser_is_redirected_to_frontend_feed_post(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Visible post',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $this->withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        ])
            ->get('/share/posts/'.$post->id)
            ->assertRedirect('https://app.test/feed?post='.$post->id);
    }

    public function test_share_preview_is_public_without_auth(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Public preview check',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $this->withHeaders(['User-Agent' => 'Slackbot-LinkExpanding 1.0'])
            ->get('/share/posts/'.$post->id)
            ->assertOk();
    }
}
