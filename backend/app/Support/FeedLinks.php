<?php

namespace App\Support;

class FeedLinks
{
    public static function post(int $postId, bool $expandComments = false): string
    {
        $url = "/feed?post={$postId}";

        if ($expandComments) {
            $url .= '&comments=1';
        }

        return $url;
    }

    public static function absolutePost(int $postId, bool $expandComments = false): string
    {
        return rtrim((string) config('app.frontend_url'), '/').self::post($postId, $expandComments);
    }

    public static function absoluteShare(int $postId): string
    {
        // Use the frontend origin + /api path so existing same-origin /api
        // reverse-proxy serves OG HTML (no extra Apache SetEnv needed).
        return rtrim((string) config('app.frontend_url'), '/')."/api/share/posts/{$postId}";
    }

    public static function absoluteShareImage(int $postId): string
    {
        return self::absoluteShare($postId).'/og-image';
    }

    public static function brandFallbackImage(): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/icons/pwa-icon-512.png';
    }
}
