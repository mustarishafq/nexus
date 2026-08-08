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
        // Frontend origin path; nginx/Cloudflare must proxy /share to Laravel.
        return rtrim((string) config('app.frontend_url'), '/')."/share/posts/{$postId}";
    }

    public static function absoluteShareImage(int $postId): string
    {
        return FeedShareOgImage::publicUrl('share-og/'.$postId.'.jpg');
    }

    public static function brandFallbackImage(): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/icons/pwa-icon-512.png';
    }
}
