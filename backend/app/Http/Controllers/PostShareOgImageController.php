<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Support\FeedLinks;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class PostShareOgImageController extends Controller
{
    private const MAX_BYTES = 500_000;

    private const MAX_WIDTH = 1200;

    public function __invoke(Request $request, int $post): BinaryFileResponse|RedirectResponse
    {
        $model = Post::query()->find($post);
        if (! $model || ! $model->isApproved()) {
            return $this->fallbackRedirect();
        }

        $sourceUrl = $model->resolvedImageUrls()[0] ?? null;
        if (! is_string($sourceUrl) || trim($sourceUrl) === '') {
            return $this->fallbackRedirect();
        }

        $cacheRelative = "share-og/{$model->id}.jpg";
        $disk = Storage::disk('public');

        if (! $disk->exists($cacheRelative)) {
            $binary = $this->buildJpegThumbnail($sourceUrl);
            if ($binary === null) {
                return $this->fallbackRedirect();
            }
            $disk->put($cacheRelative, $binary);
        }

        $absolute = $disk->path($cacheRelative);

        return response()->file($absolute, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    private function fallbackRedirect(): RedirectResponse
    {
        return redirect()->away(FeedLinks::brandFallbackImage());
    }

    private function buildJpegThumbnail(string $sourceUrl): ?string
    {
        $raw = $this->readSourceBytes($sourceUrl);
        if ($raw === null || $raw === '') {
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

    private function readSourceBytes(string $sourceUrl): ?string
    {
        $sourceUrl = trim($sourceUrl);
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
