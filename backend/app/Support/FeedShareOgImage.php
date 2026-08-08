<?php

namespace App\Support;

use App\Models\Post;
use Illuminate\Support\Facades\Storage;

class FeedShareOgImage
{
    private const MAX_BYTES = 500_000;

    private const MAX_WIDTH = 1200;

    /**
     * Ensure a WhatsApp-safe JPEG exists on the public disk and return its absolute URL.
     */
    public static function absoluteUrlFor(Post $post): ?string
    {
        if (! $post->isApproved()) {
            return null;
        }

        $sourceUrl = $post->resolvedImageUrls()[0] ?? null;
        if (! is_string($sourceUrl) || trim($sourceUrl) === '') {
            return null;
        }

        $cacheRelative = 'share-og/'.$post->id.'.jpg';
        $disk = Storage::disk('public');

        if (! $disk->exists($cacheRelative)) {
            $binary = self::buildJpegThumbnail(trim($sourceUrl));
            if ($binary === null) {
                return null;
            }
            $disk->put($cacheRelative, $binary);
        }

        return self::publicUrl($cacheRelative);
    }

    public static function publicUrl(string $relativePath): string
    {
        $relativePath = ltrim($relativePath, '/');
        // Prefer frontend host — /storage is already proxied there for post images.
        $origin = rtrim((string) config('app.frontend_url'), '/');
        if ($origin === '') {
            $origin = rtrim((string) config('app.url'), '/');
        }

        return $origin.'/storage/'.$relativePath;
    }

    private static function buildJpegThumbnail(string $sourceUrl): ?string
    {
        $raw = self::readSourceBytes($sourceUrl);
        if ($raw === null || $raw === '') {
            return null;
        }

        // Already small enough and JPEG — store as-is when under the WhatsApp limit.
        if (strlen($raw) <= self::MAX_BYTES && self::isJpeg($raw)) {
            return $raw;
        }

        if (! function_exists('imagecreatefromstring')) {
            return null;
        }

        $image = @imagecreatefromstring($raw);
        if ($image === false) {
            return null;
        }

        $width = imagesx($image);
        $height = imagesy($image);
        if ($width < 1 || $height < 1) {
            imagedestroy($image);

            return null;
        }

        if ($width > self::MAX_WIDTH) {
            $newWidth = self::MAX_WIDTH;
            $newHeight = (int) max(1, round($height * ($newWidth / $width)));
            $resized = imagecreatetruecolor($newWidth, $newHeight);
            if ($resized === false) {
                imagedestroy($image);

                return null;
            }
            imagecopyresampled($resized, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            imagedestroy($image);
            $image = $resized;
        }

        $quality = 82;
        $binary = null;
        while ($quality >= 40) {
            ob_start();
            imagejpeg($image, null, $quality);
            $binary = ob_get_clean() ?: '';
            if (strlen($binary) <= self::MAX_BYTES) {
                break;
            }
            $quality -= 8;
        }

        imagedestroy($image);

        if (! is_string($binary) || $binary === '' || strlen($binary) > self::MAX_BYTES) {
            return null;
        }

        return $binary;
    }

    private static function isJpeg(string $raw): bool
    {
        return str_starts_with($raw, "\xFF\xD8\xFF");
    }

    private static function readSourceBytes(string $sourceUrl): ?string
    {
        $relative = null;

        if (preg_match('#/storage/(.+)$#', $sourceUrl, $matches) === 1) {
            $relative = $matches[1];
        } elseif (str_starts_with($sourceUrl, 'post-images/')) {
            $relative = $sourceUrl;
        }

        if (is_string($relative) && $relative !== '') {
            $disk = Storage::disk('public');
            if ($disk->exists($relative)) {
                $contents = $disk->get($relative);

                return is_string($contents) ? $contents : null;
            }
        }

        if (preg_match('#^https?://#i', $sourceUrl) !== 1) {
            return null;
        }

        try {
            $contents = @file_get_contents($sourceUrl);

            return is_string($contents) ? $contents : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
