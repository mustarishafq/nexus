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

    public function test_share_returns_rich_og_html_for_approved_post(): void
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
            'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        ])->get('/api/share/posts/'.$post->id);

        $response->assertOk();
        $html = $response->getContent();

        $this->assertStringContainsString('property="og:title" content="Nas Ali on EMZI Nexus Brain"', $html);
        $this->assertStringContainsString('property="og:description" content="Hello @Team — mop tip with vinegar."', $html);
        $this->assertStringContainsString(
            'property="og:image" content="'.FeedLinks::absoluteShareImage($post->id).'"',
            $html
        );
        $this->assertStringContainsString(
            'property="og:url" content="'.FeedLinks::absoluteShare($post->id).'"',
            $html
        );
        $this->assertStringContainsString('https://app.test/api/share/posts/'.$post->id, $html);
        $this->assertStringContainsString('https://app.test/feed?post='.$post->id, $html);
        $this->assertStringNotContainsString('http-equiv="refresh"', $html);
    }

    public function test_share_returns_generic_og_for_pending_post(): void
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
        ])->get('/api/share/posts/'.$post->id);

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

    public function test_share_returns_generic_og_for_missing_post(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        $response = $this->withHeaders([
            'User-Agent' => 'TelegramBot',
        ])->get('/api/share/posts/999999');

        $response->assertOk();
        $html = $response->getContent();

        $this->assertStringContainsString('property="og:title" content="EMZI Nexus Brain"', $html);
        $this->assertStringContainsString('https://app.test/feed', $html);
        $this->assertStringNotContainsString('/feed?post=999999', $html);
        $this->assertStringNotContainsString('/api/share/posts/999999', $html);
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

        $this->get('/api/share/posts/'.$post->id)->assertOk();
    }

    public function test_absolute_share_url_uses_frontend_api_path(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        $this->assertSame(
            'https://app.test/api/share/posts/42',
            FeedLinks::absoluteShare(42)
        );
    }

    public function test_legacy_web_share_path_still_works(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user', 'name' => 'Legacy']);
        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Legacy path',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $this->get('/share/posts/'.$post->id)
            ->assertOk()
            ->assertSee('Legacy on EMZI Nexus Brain', false);
    }

    public function test_og_image_endpoint_returns_compressed_jpeg(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Has image',
            'image_urls' => ['/storage/post-images/big.jpg'],
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $image = imagecreatetruecolor(2000, 1200);
        $this->assertNotFalse($image);
        $bg = imagecolorallocate($image, 20, 80, 160);
        imagefilledrectangle($image, 0, 0, 1999, 1199, $bg);
        ob_start();
        imagejpeg($image, null, 95);
        $raw = ob_get_clean();
        imagedestroy($image);
        $this->assertNotFalse($raw);
        \Illuminate\Support\Facades\Storage::disk('public')->put('post-images/big.jpg', $raw);

        $response = $this->get('/api/share/posts/'.$post->id.'/og-image');
        $response->assertOk();
        $response->assertHeader('Content-Type', 'image/jpeg');
        $this->assertLessThanOrEqual(500_000, strlen($response->getContent()));
    }
}
