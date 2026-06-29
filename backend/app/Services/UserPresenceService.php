<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class UserPresenceService
{
    public const ONLINE_TTL_SECONDS = 180;

    public const TOUCH_THROTTLE_SECONDS = 30;

    private const ACTIVE_USERS_KEY = 'user_presence:active';

    private function presenceKey(int $userId): string
    {
        return "user_presence:{$userId}";
    }

    private function throttleKey(int $userId): string
    {
        return "user_presence_touch:{$userId}";
    }

    public function touch(int $userId): void
    {
        Cache::put($this->presenceKey($userId), now()->toISOString(), self::ONLINE_TTL_SECONDS);

        $active = Cache::get(self::ACTIVE_USERS_KEY, []);
        $active[$userId] = now()->timestamp;

        $cutoff = now()->subSeconds(self::ONLINE_TTL_SECONDS)->timestamp;
        $active = array_filter($active, fn (int $timestamp) => $timestamp >= $cutoff);

        Cache::put(self::ACTIVE_USERS_KEY, $active, self::ONLINE_TTL_SECONDS * 2);
    }

    public function touchIfNeeded(int $userId): void
    {
        if (Cache::has($this->throttleKey($userId))) {
            return;
        }

        $this->touch($userId);
        Cache::put($this->throttleKey($userId), true, self::TOUCH_THROTTLE_SECONDS);
    }

    public function isOnline(int $userId): bool
    {
        return Cache::has($this->presenceKey($userId));
    }

    /**
     * @param  array<int, int|string>  $userIds
     * @return array<int, bool>
     */
    public function onlineMapFor(array $userIds): array
    {
        $ids = collect($userIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return [];
        }

        $keys = $ids->mapWithKeys(fn (int $id) => [$this->presenceKey($id) => $id])->all();
        $cached = Cache::many(array_keys($keys));

        $map = [];
        foreach ($keys as $cacheKey => $id) {
            $map[$id] = ($cached[$cacheKey] ?? null) !== null;
        }

        return $map;
    }

    /**
     * @return array<int, int>
     */
    public function onlineUserIds(): array
    {
        $active = Cache::get(self::ACTIVE_USERS_KEY, []);
        $cutoff = now()->subSeconds(self::ONLINE_TTL_SECONDS)->timestamp;

        return collect($active)
            ->filter(fn (int $timestamp) => $timestamp >= $cutoff)
            ->keys()
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function enrichPayload(array $payload): array
    {
        $id = (int) ($payload['id'] ?? 0);
        if ($id > 0) {
            $payload['is_online'] = $this->isOnline($id);
        }

        if (isset($payload['manager']) && is_array($payload['manager'])) {
            $payload['manager'] = $this->enrichPayload($payload['manager']);
        }

        return $payload;
    }

    /**
     * @param  iterable<array<string, mixed>>  $payloads
     * @return list<array<string, mixed>>
     */
    public function enrichPayloads(iterable $payloads): array
    {
        $items = collect($payloads)->values();
        $ids = $items->pluck('id')->filter()->map(fn ($id) => (int) $id)->all();
        $onlineMap = $this->onlineMapFor($ids);

        return $items
            ->map(function (array $payload) use ($onlineMap) {
                $id = (int) ($payload['id'] ?? 0);
                if ($id > 0) {
                    $payload['is_online'] = $onlineMap[$id] ?? false;
                }

                return $payload;
            })
            ->all();
    }
}
