<?php

namespace App\Services;

use App\Models\Application;
use App\Models\SystemEvent;
use Illuminate\Http\Client\ConnectionException;

class ApplicationHealthCheckerService
{
    public const DEFAULT_PATH = '/api/health';

    public const MODE_JSON_OK = 'json_ok';

    public const MODE_HTTP_STATUS = 'http_status';

    public function __construct(
        private readonly ApplicationApiClient $apiClient,
    ) {}

    /**
     * @return array{checked: int, healthy: int, unhealthy: int, skipped: int, results: list<array<string, mixed>>}
     */
    public function checkAll(bool $persist = true): array
    {
        $applications = Application::query()
            ->where('is_enabled', true)
            ->whereNotNull('base_url')
            ->where('base_url', '!=', '')
            ->orderBy('sort_order')
            ->get();

        $summary = [
            'checked' => 0,
            'healthy' => 0,
            'unhealthy' => 0,
            'skipped' => 0,
            'results' => [],
        ];

        foreach ($applications as $application) {
            try {
                $result = $this->check($application, $persist);
            } catch (\Throwable $exception) {
                $result = $this->result(
                    $application,
                    ok: false,
                    message: 'Health check failed unexpectedly: '.$exception->getMessage(),
                );
            }

            $summary['results'][] = $result;

            if ($result['skipped']) {
                $summary['skipped']++;
                continue;
            }

            $summary['checked']++;

            if ($result['ok']) {
                $summary['healthy']++;
            } else {
                $summary['unhealthy']++;
            }
        }

        return $summary;
    }

    /**
     * @return array<string, mixed>
     */
    public function check(Application $application, bool $persist = true): array
    {
        if (! $application->health_check_enabled) {
            return $this->result($application, skipped: true, message: 'Health check is disabled for this application.');
        }

        if ($application->status === 'maintenance') {
            return $this->result($application, skipped: true, message: 'Application is in maintenance mode; automatic checks are skipped.');
        }

        $baseUrl = rtrim((string) $application->base_url, '/');

        if ($baseUrl === '') {
            return $this->result($application, skipped: true, message: 'Base URL is required before Nexus can probe health.');
        }

        if ($this->isSelfReferential($application)) {
            return $this->result(
                $application,
                skipped: true,
                message: 'Skipped: base URL points to Nexus itself, which would block the server while probing.',
            );
        }

        $probe = $this->probe($application);
        $previousStatus = $application->status;

        if ($persist) {
            $this->persistResult($application, $probe, $previousStatus);
        }

        return $this->result(
            $application,
            ok: $probe['ok'],
            httpStatus: $probe['http_status'] ?? null,
            responseTimeMs: $probe['response_time_ms'] ?? null,
            healthUrl: $probe['health_url'],
            healthPath: $probe['health_path'],
            healthMode: $probe['health_mode'],
            message: $probe['message'],
            persisted: $persist,
            previousStatus: $previousStatus,
            nextStatus: $persist ? $application->fresh()?->status : $this->resolveNextStatus($application, $probe['ok'], $previousStatus),
        );
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    public function test(Application $application, array $overrides = []): array
    {
        $app = $this->applicationWithOverrides($application, $overrides);
        $probe = $this->probe($app);

        return [
            'ok' => $probe['ok'],
            'health_url' => $probe['health_url'],
            'health_path' => $probe['health_path'],
            'health_mode' => $probe['health_mode'],
            'http_status' => $probe['http_status'] ?? null,
            'response_time_ms' => $probe['response_time_ms'] ?? null,
            'message' => $probe['message'],
            'body' => $probe['body'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function probe(Application $application): array
    {
        $path = $this->healthPath($application);
        $mode = $this->healthMode($application);
        $healthUrl = $this->healthUrl($application, $path);

        if ($healthUrl === null) {
            return [
                'ok' => false,
                'health_url' => null,
                'health_path' => $path,
                'health_mode' => $mode,
                'message' => 'Base URL is required before Nexus can probe health.',
            ];
        }

        $startedAt = microtime(true);

        try {
            $response = $this->apiClient->request($application, 'GET', $path, [
                'timeout' => ApplicationApiClient::HEALTH_TIMEOUT,
                'connect_timeout' => ApplicationApiClient::HEALTH_CONNECT_TIMEOUT,
            ]);
        } catch (ConnectionException) {
            return [
                'ok' => false,
                'health_url' => $healthUrl,
                'health_path' => $path,
                'health_mode' => $mode,
                'response_time_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                'message' => 'Could not connect to the application.',
            ];
        }

        $responseTimeMs = (int) round((microtime(true) - $startedAt) * 1000);
        $httpStatus = $response->status();

        if ($response->failed()) {
            return [
                'ok' => false,
                'health_url' => $healthUrl,
                'health_path' => $path,
                'health_mode' => $mode,
                'http_status' => $httpStatus,
                'response_time_ms' => $responseTimeMs,
                'message' => "Health check failed with HTTP {$httpStatus}.",
            ];
        }

        if ($mode === self::MODE_HTTP_STATUS) {
            return [
                'ok' => true,
                'health_url' => $healthUrl,
                'health_path' => $path,
                'health_mode' => $mode,
                'http_status' => $httpStatus,
                'response_time_ms' => $responseTimeMs,
                'message' => 'Application responded with a successful HTTP status.',
            ];
        }

        $body = $response->json();

        if (! is_array($body) || ! array_key_exists('ok', $body)) {
            return [
                'ok' => false,
                'health_url' => $healthUrl,
                'health_path' => $path,
                'health_mode' => $mode,
                'http_status' => $httpStatus,
                'response_time_ms' => $responseTimeMs,
                'body' => $body,
                'message' => 'Health response must be JSON with an "ok" field.',
            ];
        }

        if ($body['ok'] !== true) {
            return [
                'ok' => false,
                'health_url' => $healthUrl,
                'health_path' => $path,
                'health_mode' => $mode,
                'http_status' => $httpStatus,
                'response_time_ms' => $responseTimeMs,
                'body' => $body,
                'message' => 'Health response returned ok=false.',
            ];
        }

        return [
            'ok' => true,
            'health_url' => $healthUrl,
            'health_path' => $path,
            'health_mode' => $mode,
            'http_status' => $httpStatus,
            'response_time_ms' => $responseTimeMs,
            'body' => $body,
            'message' => 'Application health check passed.',
        ];
    }

    private function persistResult(Application $application, array $probe, string $previousStatus): void
    {
        $nextStatus = $this->resolveNextStatus($application, $probe['ok'], $previousStatus);

        $application->update([
            'last_heartbeat' => now(),
            'status' => $nextStatus,
        ]);

        $this->recordSystemEvent($application, $probe, $previousStatus, $nextStatus);
    }

    private function resolveNextStatus(Application $application, bool $healthy, string $previousStatus): string
    {
        if ($application->status === 'maintenance') {
            return 'maintenance';
        }

        if ($healthy) {
            return 'online';
        }

        return $previousStatus === 'degraded' ? 'degraded' : 'offline';
    }

    private function recordSystemEvent(Application $application, array $probe, string $previousStatus, string $nextStatus): void
    {
        $healthy = (bool) $probe['ok'];
        $statusChanged = $previousStatus !== $nextStatus;

        if ($healthy && ! $statusChanged) {
            return;
        }

        SystemEvent::query()->create([
            'system_id' => $application->slug,
            'event_type' => 'health_check',
            'title' => $healthy
                ? "{$application->name} recovered"
                : "{$application->name} health check failed",
            'payload' => [
                'ok' => $healthy,
                'health_url' => $probe['health_url'] ?? null,
                'health_path' => $probe['health_path'] ?? null,
                'health_mode' => $probe['health_mode'] ?? null,
                'http_status' => $probe['http_status'] ?? null,
                'response_time_ms' => $probe['response_time_ms'] ?? null,
                'previous_status' => $previousStatus,
                'next_status' => $nextStatus,
                'message' => $probe['message'] ?? null,
            ],
            'status' => $healthy ? 'processed' : 'failed',
            'severity' => $healthy ? 1 : ($nextStatus === 'offline' ? 4 : 3),
        ]);
    }

    public function healthPath(Application $application): string
    {
        $path = trim((string) ($application->health_check_path ?: self::DEFAULT_PATH));

        return '/'.ltrim($path, '/');
    }

    public function healthMode(Application $application): string
    {
        $mode = (string) ($application->health_check_mode ?? self::MODE_JSON_OK);

        return in_array($mode, [self::MODE_JSON_OK, self::MODE_HTTP_STATUS], true)
            ? $mode
            : self::MODE_JSON_OK;
    }

    public function healthUrl(Application $application, ?string $path = null): ?string
    {
        $baseUrl = rtrim((string) $application->base_url, '/');

        if ($baseUrl === '') {
            return null;
        }

        return $baseUrl.($path ?? $this->healthPath($application));
    }

    public function isSelfReferential(Application $application): bool
    {
        $target = $this->normalizeOrigin((string) $application->base_url);

        if ($target === null) {
            return false;
        }

        $origins = array_unique(array_filter([
            $this->normalizeOrigin((string) config('app.url')),
            $this->normalizeOrigin(url('/')),
        ]));

        return in_array($target, $origins, true);
    }

    private function normalizeOrigin(string $url): ?string
    {
        $url = trim($url);

        if ($url === '') {
            return null;
        }

        $parts = parse_url($url);

        if ($parts === false || empty($parts['host'])) {
            return null;
        }

        $host = strtolower($parts['host']);
        $scheme = strtolower($parts['scheme'] ?? 'http');
        $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);

        if (($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443)) {
            return "{$scheme}://{$host}";
        }

        return "{$scheme}://{$host}:{$port}";
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function applicationWithOverrides(Application $application, array $overrides): Application
    {
        $app = $application->replicate();

        foreach (['base_url', 'health_check_path', 'health_check_mode', 'health_check_enabled', 'mcp_api_key', 'mcp_auth_mode', 'api_key'] as $key) {
            if (array_key_exists($key, $overrides)) {
                $app->{$key} = $overrides[$key];
            }
        }

        if (array_key_exists('notification_config', $overrides)) {
            $app->notification_config = $overrides['notification_config'];
        }

        return $app;
    }

    /**
     * @return array<string, mixed>
     */
    private function result(
        Application $application,
        bool $ok = false,
        bool $skipped = false,
        ?int $httpStatus = null,
        ?int $responseTimeMs = null,
        ?string $healthUrl = null,
        ?string $healthPath = null,
        ?string $healthMode = null,
        ?string $message = null,
        bool $persisted = false,
        ?string $previousStatus = null,
        ?string $nextStatus = null,
    ): array {
        return [
            'application_id' => $application->id,
            'slug' => $application->slug,
            'name' => $application->name,
            'ok' => $ok,
            'skipped' => $skipped,
            'http_status' => $httpStatus,
            'response_time_ms' => $responseTimeMs,
            'health_url' => $healthUrl ?? $this->healthUrl($application),
            'health_path' => $healthPath ?? $this->healthPath($application),
            'health_mode' => $healthMode ?? $this->healthMode($application),
            'message' => $message,
            'persisted' => $persisted,
            'previous_status' => $previousStatus ?? $application->status,
            'next_status' => $nextStatus ?? $application->status,
        ];
    }
}
