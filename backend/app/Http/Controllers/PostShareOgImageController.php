<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Support\FeedLinks;
use App\Support\FeedShareOgImage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class PostShareOgImageController extends Controller
{
    /**
     * Legacy/convenience endpoint — redirects to the static public JPEG.
     * Prefer /storage/share-og/{id}.jpg in og:image (no PHP on every crawl).
     */
    public function __invoke(Request $request, int $post): RedirectResponse|Response
    {
        $model = Post::query()->find($post);
        if (! $model || ! $model->isApproved()) {
            return redirect()->away(FeedLinks::brandFallbackImage());
        }

        $url = FeedShareOgImage::absoluteUrlFor($model);
        if ($url) {
            return redirect()->away($url);
        }

        $cacheRelative = 'share-og/'.$model->id.'.jpg';
        if (Storage::disk('public')->exists($cacheRelative)) {
            $binary = Storage::disk('public')->get($cacheRelative);
            if (is_string($binary) && $binary !== '') {
                return response($binary, 200, [
                    'Content-Type' => 'image/jpeg',
                    'Cache-Control' => 'public, max-age=86400',
                ]);
            }
        }

        return redirect()->away(FeedLinks::brandFallbackImage());
    }
}
