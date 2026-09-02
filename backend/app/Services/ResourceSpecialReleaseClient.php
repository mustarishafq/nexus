<?php

namespace App\Services;

use App\Models\Application;
use App\Support\SpecialReleasePin;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Approved special-release pin lookup against Insan (Resource).
 * Fail-open on HTTP/errors so Brain keeps using office geofence when Insan is unreachable.
 */
class ResourceSpecialReleaseClient
{
    private const DEFAULT_SPECIAL_RELEASES_COVERING_PATH = '/api/nexus/v1/special-releases/covering';

    private const HTTP_TIMEOUT_SECONDS = 4;

    private const CACHE_SECONDS = 15;

    public function __construct(
        private readonly ResourceAttendanceForwarder $forwarder,
    ) {}

    public function findApprovedForUserOnDate(int|string $nexusUserId, string $date): ?SpecialReleasePin
    {
        $nexusUserId = (string) $nexusUserId;
        if ($nexusUserId === '') {
            return null;
        }

        $map = $this->approvedPinsForDate($date, [$nexusUserId]);

        return $map[$nexusUserId] ?? null;
    }

    /**
     * @param  list<int|string>  $nexusUserIds
     * @return array<string, SpecialReleasePin>
     */
    public function approvedPinsForDate(string $date, array $nexusUserIds): array
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
        $cacheKey = 'resource_special_release_covering:'.$date.':'.md5(implode(',', $nexusUserIds));
        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $this->hydratePins($cached);
        }

        $rows = $this->fetchReleases($application, $date, $nexusUserIds);
        if ($rows === null) {
            return [];
        }

        Cache::put($cacheKey, $rows, self::CACHE_SECONDS);

        return $this->hydratePins($rows);
    }

    /**
     * @param  array<string, array<string, mixed>>  $rows
     * @return array<string, SpecialReleasePin>
     */
    private function hydratePins(array $rows): array
    {
        $map = [];
        foreach ($rows as $nexusUserId => $row) {
            if (! is_array($row)) {
                continue;
            }
            $pin = SpecialReleasePin::fromCoveringRow($row);
            if ($pin) {
                $map[(string) $nexusUserId] = $pin;
            }
        }

        return $map;
    }

    /**
     * @param  list<string>  $nexusUserIds
     * @return array<string, array<string, mixed>>|null  null on failure (fail-open)
     */
    private function fetchReleases(Application $application, string $date, array $nexusUserIds): ?array
    {
        try {
            $path = self::DEFAULT_SPECIAL_RELEASES_COVERING_PATH;
            $namedResource = $this->forwarder->isNamedResourceApplication($application);
            $manifest = $this->forwarder->fetchManifest(rtrim((string) $application->base_url, '/'));

            if (is_array($manifest)) {
                $capabilities = is_array($manifest['capabilities'] ?? null) ? $manifest['capabilities'] : [];
                if (! $namedResource && ! in_array('special_releases.covering', $capabilities, true)) {
                    return [];
                }

                $manifestPath = data_get($manifest, 'endpoints.special_releases_covering');
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
                'aud' => 'resource-special-releases-covering',
            ], $apiKey, 'HS256');

            $response = Http::timeout(self::HTTP_TIMEOUT_SECONDS)
                ->connectTimeout(1)
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
                Log::warning('Resource special-release covering lookup failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'url' => $url,
                ]);

                return null;
            }

            $rows = $response->json('releases');
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
                    $map[$id] = $row;
                }
            }

            return $map;
        } catch (\Throwable $e) {
            Log::warning('Resource special-release covering client error', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
