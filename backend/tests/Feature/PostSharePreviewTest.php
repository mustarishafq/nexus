<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Support\FeedLinks;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
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

        Storage::fake('public');

        $author = User::factory()->create([
            'is_approved' => true,
            'role' => 'user',
            'name' => 'Nas Ali',
        ]);

        $image = imagecreatetruecolor(800, 600);
        $this->assertNotFalse($image);
        $bg = imagecolorallocate($image, 20, 80, 160);
        imagefilledrectangle($image, 0, 0, 799, 599, $bg);
        ob_start();
        imagejpeg($image, null, 90);
        $raw = ob_get_clean();
        imagedestroy($image);
        Storage::disk('public')->put('post-images/spill.jpg', $raw);

        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Hello @[99|Team] — mop tip with vinegar.',
            'image_urls' => ['/storage/post-images/spill.jpg'],
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $response = $this->get('/share/posts/'.$post->id);

        $response->assertOk();
        $html = $response->getContent();

        $this->assertStringContainsString('property="og:title" content="Nas Ali on EMZI Nexus Brain"', $html);
        $this->assertStringContainsString('property="og:description" content="Hello @Team — mop tip with vinegar."', $html);
        $this->assertStringContainsString(
            'property="og:image" content="https://app.test/storage/share-og/'.$post->id.'.jpg"',
            $html
        );
        $this->assertStringContainsString(
            'property="og:url" content="'.FeedLinks::absoluteShare($post->id).'"',
            $html
        );
        $this->assertTrue(Storage::disk('public')->exists('share-og/'.$post->id.'.jpg'));
        $this->assertLessThanOrEqual(500_000, strlen(Storage::disk('public')->get('share-og/'.$post->id.'.jpg')));
        $this->assertStringContainsString('https://app.test/feed?post='.$post->id, $html);
        $this->assertStringNotContainsString('http-equiv="refresh"', $html);
        $this->assertStringNotContainsString('/og-image', $html);
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

        $response = $this->get('/share/posts/'.$post->id);

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

        $response = $this->get('/share/posts/999999');

        $response->assertOk();
        $html = $response->getContent();

        $this->assertStringContainsString('property="og:title" content="EMZI Nexus Brain"', $html);
        $this->assertStringContainsString('https://app.test/feed', $html);
        $this->assertStringNotContainsString('/feed?post=999999', $html);
        $this->assertStringNotContainsString('/share/posts/999999', $html);
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

        $this->get('/share/posts/'.$post->id)->assertOk();
    }

    public function test_absolute_share_url_uses_frontend_share_path(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        $this->assertSame(
            'https://app.test/share/posts/42',
            FeedLinks::absoluteShare(42)
        );
        $this->assertSame(
            'https://app.test/storage/share-og/42.jpg',
            FeedLinks::absoluteShareImage(42)
        );
    }

    public function test_api_share_path_still_works(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user', 'name' => 'Api Path']);
        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Api path',
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $this->get('/api/share/posts/'.$post->id)
            ->assertOk()
            ->assertSee('Api Path on EMZI Nexus Brain', false);
    }

    public function test_og_image_endpoint_redirects_to_static_storage_jpeg(): void
    {
        config([
            'app.url' => 'https://brainapi.test',
            'app.frontend_url' => 'https://app.test',
        ]);

        Storage::fake('public');

        $author = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $image = imagecreatetruecolor(2000, 1200);
        $this->assertNotFalse($image);
        $bg = imagecolorallocate($image, 20, 80, 160);
        imagefilledrectangle($image, 0, 0, 1999, 1199, $bg);
        ob_start();
        imagejpeg($image, null, 95);
        $raw = ob_get_clean();
        imagedestroy($image);
        Storage::disk('public')->put('post-images/big.jpg', $raw);

        $post = Post::query()->create([
            'author_user_id' => $author->id,
            'body' => 'Has image',
            'image_urls' => ['/storage/post-images/big.jpg'],
            'approval_status' => Post::APPROVAL_APPROVED,
        ]);

        $this->get('/share/posts/'.$post->id.'/og-image')
            ->assertRedirect('https://app.test/storage/share-og/'.$post->id.'.jpg');

        $this->assertTrue(Storage::disk('public')->exists('share-og/'.$post->id.'.jpg'));
        $this->assertLessThanOrEqual(500_000, strlen(Storage::disk('public')->get('share-og/'.$post->id.'.jpg')));
    }
}
