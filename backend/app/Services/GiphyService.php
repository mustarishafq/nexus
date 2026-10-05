<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Server-side GIPHY proxy so the API key never reaches the browser. Results
 * are normalized to the few fields the comment GIF picker needs and capped at
 * a G rating for a workplace feed.
 */
class GiphyService
{
    private const BASE_URL = 'https://api.giphy.com/v1/gifs';

    private const RATING = 'g';

    public function isEnabled(): bool
    {
        return filled(config('services.giphy.key'));
    }

    /**
     * @return list<array{id: string, title: string, url: string, preview_url: string, width: ?int, height: ?int}>
     */
    public function trending(int $limit = 24): array
    {
        return $this->cached("giphy:trending:{$limit}", fn () => $this->fetch('trending', [
            'limit' => $limit,
        ]));
    }

    /**
     * @return list<array{id: string, title: string, url: string, preview_url: string, width: ?int, height: ?int}>
     */
    public function search(string $query, int $limit = 24): array
    {
        $query = mb_substr(trim($query), 0, 50);
        $key = 'giphy:search:'.md5(mb_strtolower($query)).":{$limit}";

        return $this->cached($key, fn () => $this->fetch('search', [
            'q' => $query,
            'limit' => $limit,
        ]));
    }

    /**
     * Cache successful lookups only, so a GIPHY timeout or rate limit isn't
     * served back as "no results" for the next 10 minutes.
     *
     * @param  callable(): ?array  $resolve
     * @return list<array<string, mixed>>
     */
    private function cached(string $key, callable $resolve): array
    {
        $cached = Cache::get($key);
        if (is_array($cached)) {
            return $cached;
        }

        $gifs = $resolve();
        if ($gifs === null) {
            return [];
        }

        Cache::put($key, $gifs, now()->addMinutes(10));

        return $gifs;
    }

    /**
     * @param  array<string, mixed>  $params
     * @return list<array<string, mixed>>|null Null when the request failed.
     */
    private function fetch(string $endpoint, array $params): ?array
    {
        try {
            $response = Http::timeout(5)
                ->acceptJson()
                ->get(self::BASE_URL."/{$endpoint}", array_merge($params, [
                    'api_key' => config('services.giphy.key'),
                    'rating' => self::RATING,
                    'bundle' => 'messaging_non_clips',
                ]));
        } catch (Throwable $exception) {
            Log::warning('GIPHY request failed', ['endpoint' => $endpoint, 'error' => $exception->getMessage()]);

            return null;
        }

        if (! $response->successful()) {
            Log::warning('GIPHY request failed', ['endpoint' => $endpoint, 'status' => $response->status()]);

            return null;
        }

        return collect($response->json('data', []))
            ->map(function (array $gif) {
                $full = $gif['images']['fixed_height'] ?? $gif['images']['original'] ?? [];
                $preview = $gif['images']['fixed_width_small'] ?? $gif['images']['fixed_width'] ?? $full;
                $url = $full['url'] ?? null;

                if (! $url) {
                    return null;
                }

                return [
                    'id' => (string) ($gif['id'] ?? ''),
                    'title' => (string) ($gif['title'] ?? ''),
                    'url' => $url,
                    'preview_url' => $preview['url'] ?? $url,
                    'width' => isset($full['width']) ? (int) $full['width'] : null,
                    'height' => isset($full['height']) ? (int) $full['height'] : null,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
}
