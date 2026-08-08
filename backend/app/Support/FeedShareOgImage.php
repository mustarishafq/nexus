<?php

namespace App\Support;

use App\Models\Post;
use Illuminate\Support\Facades\Storage;

class FeedShareOgImage
{
    /** WhatsApp Web is stricter than mobile — keep under ~300KB. */
    private const MAX_BYTES = 300_000;

    /** Landscape OG size WhatsApp/Facebook handle reliably. */
    private const OUT_WIDTH = 1200;

    private const OUT_HEIGHT = 630;

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

        // Versioned filename so tall v1 thumbnails are regenerated.
        $cacheRelative = 'share-og/'.$post->id.'-wa.jpg';
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

        $cropped = self::centerCropResize($image, $width, $height, self::OUT_WIDTH, self::OUT_HEIGHT);
        imagedestroy($image);
        if ($cropped === null) {
            return null;
        }

        $quality = 80;
        $binary = null;
        while ($quality >= 40) {
            ob_start();
            imagejpeg($cropped, null, $quality);
            $binary = ob_get_clean() ?: '';
            if (strlen($binary) <= self::MAX_BYTES) {
                break;
            }
            $quality -= 8;
        }

        imagedestroy($cropped);

        if (! is_string($binary) || $binary === '' || strlen($binary) > self::MAX_BYTES) {
            return null;
        }

        return $binary;
    }

    /**
     * @param  \GdImage  $image
     * @return \GdImage|null
     */
    private static function centerCropResize($image, int $width, int $height, int $outW, int $outH)
    {
        $targetRatio = $outW / $outH;
        $srcRatio = $width / $height;

        if ($srcRatio > $targetRatio) {
            // Source too wide — crop sides.
            $cropH = $height;
            $cropW = (int) max(1, round($height * $targetRatio));
            $srcX = (int) max(0, round(($width - $cropW) / 2));
            $srcY = 0;
        } else {
            // Source too tall — crop top/bottom (common phone photos).
            $cropW = $width;
            $cropH = (int) max(1, round($width / $targetRatio));
            $srcX = 0;
            $srcY = (int) max(0, round(($height - $cropH) / 2));
        }

        $out = imagecreatetruecolor($outW, $outH);
        if ($out === false) {
            return null;
        }

        imagecopyresampled($out, $image, 0, 0, $srcX, $srcY, $outW, $outH, $cropW, $cropH);

        return $out;
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
