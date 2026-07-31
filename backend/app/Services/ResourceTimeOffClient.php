<?php

namespace App\Services;

use App\Models\Application;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Optional leave lookup against Insan (Resource). No-ops when Insan is not linked.
 * Fail-open on HTTP/errors so attendance reminders still work without Insan.
 */
class ResourceTimeOffClient
{
    private const DEFAULT_TIME_OFFS_COVERING_PATH = '/api/nexus/v1/time-offs/covering';

    private const HTTP_TIMEOUT_SECONDS = 4;

    private const CACHE_SECONDS = 180;

    public function __construct(
        private readonly ResourceAttendanceForwarder $forwarder,
    ) {}

    /**
     * @param  list<int|string>  $nexusUserIds  Brain user ids
     * @return array<string, true>  Map of nexus_user_id => true for users on leave
     */
    public function onLeaveNexusUserIds(string $date, array $nexusUserIds): array
    {
        $nexusUserIds = array_values(array_unique(array_map(
            static fn ($id) => (string) $id,
            array_filter($nexusUserIds, static fn ($id) => $id !== null && $id !== ''),
        )));

        if ($nexusUserIds === []) {
            return [];
        }

        $application = $this->forwarder->resolveResourceApplication();
        if (! $application || ! $application->base_url || ! $application->api_key) {
            return [];
        }

        sort($nexusUserIds);
        $cacheKey = 'resource_time_off_covering:'.$date.':'.md5(implode(',', $nexusUserIds));
        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $onLeave = $this->fetchOnLeave($application, $date, $nexusUserIds);
        // null => fail-open (do not cache empty as success when request failed)
        if ($onLeave === null) {
            return [];
        }

        Cache::put($cacheKey, $onLeave, self::CACHE_SECONDS);

        return $onLeave;
    }

    public function isUserOnLeave(int|string $nexusUserId, string $date): bool
    {
        $map = $this->onLeaveNexusUserIds($date, [(string) $nexusUserId]);

        return isset($map[(string) $nexusUserId]);
    }

    /**
     * @param  list<string>  $nexusUserIds
     * @return array<string, true>|null  null on failure (fail-open)
     */
    private function fetchOnLeave(Application $application, string $date, array $nexusUserIds): ?array
    {
        try {
            $path = self::DEFAULT_TIME_OFFS_COVERING_PATH;
            $namedResource = $this->forwarder->isNamedResourceApplication($application);
            $manifest = $this->forwarder->fetchManifest(rtrim((string) $application->base_url, '/'));

            if (is_array($manifest)) {
                $capabilities = is_array($manifest['capabilities'] ?? null) ? $manifest['capabilities'] : [];
                if (! $namedResource && ! in_array('time_offs.covering', $capabilities, true)) {
                    return [];
                }

                $manifestPath = data_get($manifest, 'endpoints.time_offs_covering');
                if (is_string($manifestPath) && $manifestPath !== '') {
                    $path = $manifestPath;
                }
            } elseif (! $namedResource) {
                return [];
            }

            $url = rtrim((string) $application->base_url, '/').'/'.ltrim($path, '/');
            $apiKey = (string) $application->api_key;
            $now = time();
            $serviceToken = JWT::encode([
                'iss' => config('app.url'),
                'iat' => $now,
                'exp' => $now + 120,
                'sub' => 'system',
                'typ' => 'service',
                'aud' => 'resource-time-offs-covering',
            ], $apiKey, 'HS256');

            $response = Http::timeout(self::HTTP_TIMEOUT_SECONDS)
                ->withToken($serviceToken)
                ->withHeaders([
                    'Accept' => 'application/json',
                    'X-Nexus-Api-Key' => $apiKey,
                ])
                ->get($url, [
                    'date' => $date,
                    'nexus_user_ids' => implode(',', $nexusUserIds),
                ]);

            if (! $response->successful()) {
                Log::warning('Resource time-off covering lookup failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'url' => $url,
                ]);

                return null;
            }

            $rows = $response->json('on_leave');
            if (! is_array($rows)) {
                return [];
            }

            $map = [];
            foreach ($rows as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $id = isset($row['nexus_user_id']) ? (string) $row['nexus_user_id'] : '';
                if ($id !== '') {
                    $map[$id] = true;
                }
            }

            return $map;
        } catch (\Throwable $e) {
            Log::warning('Resource time-off covering client error', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
