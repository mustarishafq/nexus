<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Services\MentionService;
use App\Support\FeedLinks;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\View\View;

class PostSharePreviewController extends Controller
{
    private const SITE_NAME = 'EMZI Nexus Brain';

    private const DESCRIPTION_MAX = 160;

    /** @var list<string> */
    private const CRAWLER_USER_AGENTS = [
        'whatsapp',
        'facebookexternalhit',
        'facebot',
        'twitterbot',
        'linkedinbot',
        'slackbot',
        'discordbot',
        'telegrambot',
        'skypeuripreview',
        'applebot',
        'googlebot',
        'bingbot',
        'embedly',
        'quora link preview',
        'pinterest',
        'redditbot',
        'vkshare',
        'baiduspider',
        'duckduckbot',
    ];

    public function __invoke(Request $request, int $post): RedirectResponse|Response|View
    {
        $model = Post::query()->with('author')->find($post);
        $frontendFeed = rtrim((string) config('app.frontend_url'), '/').'/feed';
        $canonicalUrl = $model ? FeedLinks::absolutePost($post) : $frontendFeed;
        $redirectUrl = $canonicalUrl;

        $meta = $this->buildMeta($model, $canonicalUrl);

        if (! $this->isLinkPreviewCrawler($request)) {
            return redirect()->away($redirectUrl);
        }

        return response()
            ->view('share.post', [
                'title' => $meta['title'],
                'description' => $meta['description'],
                'image' => $meta['image'],
                'url' => $meta['url'],
                'siteName' => self::SITE_NAME,
                'redirectUrl' => $redirectUrl,
            ])
            ->header('Content-Type', 'text/html; charset=UTF-8');
    }

    /**
     * @return array{title: string, description: string, image: string, url: string}
     */
    private function buildMeta(?Post $post, string $canonicalUrl): array
    {
        $fallbackImage = FeedLinks::brandFallbackImage();
        $generic = [
            'title' => self::SITE_NAME,
            'description' => 'Shared from the company feed — sign in to view.',
            'image' => $fallbackImage,
            'url' => $canonicalUrl,
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
            'url' => $canonicalUrl,
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

    private function isLinkPreviewCrawler(Request $request): bool
    {
        $ua = strtolower((string) $request->userAgent());
        if ($ua === '') {
            // Empty UA: serve HTML so scrapers without a UA still get OG tags.
            return true;
        }

        foreach (self::CRAWLER_USER_AGENTS as $needle) {
            if (str_contains($ua, $needle)) {
                return true;
            }
        }

        return false;
    }
}
