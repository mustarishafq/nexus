<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Services\MentionService;
use App\Support\FeedLinks;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PostSharePreviewController extends Controller
{
    private const SITE_NAME = 'EMZI Nexus Brain';

    private const DESCRIPTION_MAX = 160;

    public function __invoke(Request $request, int $post): Response
    {
        $model = Post::query()->with('author')->find($post);
        $frontendFeed = rtrim((string) config('app.frontend_url'), '/').'/feed';
        $shareUrl = $model
            ? FeedLinks::absoluteShare($post)
            : $frontendFeed;
        $redirectUrl = $model
            ? FeedLinks::absolutePost($post)
            : $frontendFeed;

        $meta = $this->buildMeta($model, $shareUrl);

        // Always return 200 HTML with OG tags. Instant 302/meta-refresh causes
        // WhatsApp to follow into the SPA and drop the rich preview.
        return response()
            ->view('share.post', [
                'title' => $meta['title'],
                'description' => $meta['description'],
                'image' => $meta['image'],
                'url' => $meta['url'],
                'siteName' => self::SITE_NAME,
                'redirectUrl' => $redirectUrl,
            ])
            ->header('Content-Type', 'text/html; charset=UTF-8')
            ->header('Cache-Control', 'public, max-age=300');
    }

    /**
     * @return array{title: string, description: string, image: string, url: string}
     */
    private function buildMeta(?Post $post, string $shareUrl): array
    {
        $fallbackImage = FeedLinks::brandFallbackImage();
        $generic = [
            'title' => self::SITE_NAME,
            'description' => 'Shared from the company feed — sign in to view.',
            'image' => $fallbackImage,
            'url' => $shareUrl,
        ];

        if (! $post || ! $post->isApproved()) {
            return $generic;
        }

        $authorName = trim((string) ($post->author?->displayName() ?: 'Someone'));
        $description = $this->plainTextPreview((string) $post->body, self::DESCRIPTION_MAX);
        if ($description === '') {
            $description = $post->resolvedImageUrls() !== []
                ? 'Shared a photo in the company feed.'
                : 'Shared a post in the company feed.';
        }

        $image = $this->absoluteImageUrl($post->resolvedImageUrls()[0] ?? null) ?: $fallbackImage;

        return [
            'title' => "{$authorName} on ".self::SITE_NAME,
            'description' => $description,
            'image' => $image,
            'url' => $shareUrl,
        ];
    }

    private function plainTextPreview(string $body, int $maxLength): string
    {
        $preview = trim(preg_replace(MentionService::TOKEN_PATTERN, '@$2', $body) ?? $body);
        $preview = preg_replace('/<br\s*\/?>/i', ' ', $preview) ?? $preview;
        $preview = preg_replace('/<\/p>/i', ' ', $preview) ?? $preview;
        $preview = trim(html_entity_decode(strip_tags($preview), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $preview = trim(preg_replace('/\s+/u', ' ', $preview) ?? $preview);

        if (mb_strlen($preview) > $maxLength) {
            return mb_substr($preview, 0, $maxLength - 3).'...';
        }

        return $preview;
    }

    private function absoluteImageUrl(?string $url): ?string
    {
        if ($url === null) {
            return null;
        }

        $url = trim($url);
        if ($url === '') {
            return null;
        }

        if (preg_match('#^https?://#i', $url) === 1) {
            return $url;
        }

        $origin = rtrim((string) config('app.url'), '/');

        return str_starts_with($url, '/') ? $origin.$url : $origin.'/'.$url;
    }
}
