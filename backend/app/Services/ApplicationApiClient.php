<?php

namespace App\Services;

use App\Models\Application;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class ApplicationApiClient
{
    public const DEFAULT_CATALOG_PATH = '/api/mcp-catalog';

    public const HEALTH_TIMEOUT = 5;

    public const HEALTH_CONNECT_TIMEOUT = 3;

    public const DEFAULT_TIMEOUT = 15;

    public const AUTH_MODE_BEARER = 'bearer';

    public const AUTH_MODE_X_API_KEY = 'x-api-key';

    /**
     * Call a connected Application's API using the credentials Nexus already
     * holds for it, so callers never need their own System A credentials.
     *
     * Picks the auth secret in order: mcp_api_key (set explicitly for MCP/M2M
     * calls via the admin UI) > notification_config.webhook_secret (the
     * shared secret already used for the incoming-webhook direction in
     * ApplicationEventWebhookController) > api_key (used for SSO JWT
     * signing, last resort for systems with nothing else configured).
     */
    public function request(Application $application, string $method, string $path, array $options = []): Response
    {
        $baseUrl = rtrim((string) $application->base_url, '/');
        $path = '/'.ltrim($path, '/');
        $timeout = (int) ($options['timeout'] ?? self::DEFAULT_TIMEOUT);
        $connectTimeout = (int) ($options['connect_timeout'] ?? min(5, $timeout));

        $request = Http::baseUrl($baseUrl)
            ->timeout($timeout)
            ->connectTimeout($connectTimeout)
            ->acceptJson();

        return $this->applyAuth($request, $application)->send(strtoupper($method), $path, $options);
    }

    public function catalogPath(Application $application): string
    {
        return $application->mcp_catalog_path ?: self::DEFAULT_CATALOG_PATH;
    }

    public function catalogUrl(Application $application): ?string
    {
        $baseUrl = rtrim((string) $application->base_url, '/');

        if ($baseUrl === '') {
            return null;
        }

        return $baseUrl.$this->catalogPath($application);
    }

    /**
     * @return array{token: ?string, source: ?string, mode: string}
     */
    public function resolveAuth(Application $application): array
    {
        $mode = $this->authMode($application);

        if ($application->mcp_api_key) {
            return ['token' => $application->mcp_api_key, 'source' => 'mcp_api_key', 'mode' => $mode];
        }

        $webhookSecret = $application->notification_config['webhook_secret'] ?? null;

        if ($webhookSecret) {
            return ['token' => $webhookSecret, 'source' => 'webhook_secret', 'mode' => $mode];
        }

        if ($application->api_key) {
            return ['token' => $application->api_key, 'source' => 'api_key', 'mode' => $mode];
        }

        return ['token' => null, 'source' => null, 'mode' => $mode];
    }

    public function authMode(Application $application): string
    {
        $mode = (string) ($application->mcp_auth_mode ?? self::AUTH_MODE_BEARER);

        return in_array($mode, [self::AUTH_MODE_BEARER, self::AUTH_MODE_X_API_KEY], true)
            ? $mode
            : self::AUTH_MODE_BEARER;
    }

    /**
     * @param  \Illuminate\Http\Client\PendingRequest  $request
     * @return \Illuminate\Http\Client\PendingRequest
     */
    private function applyAuth($request, Application $application)
    {
        $auth = $this->resolveAuth($application);

        if (! $auth['token']) {
            return $request;
        }

        if ($auth['mode'] === self::AUTH_MODE_X_API_KEY) {
            return $request->withHeaders(['X-API-Key' => $auth['token']]);
        }

        return $request->withToken($auth['token']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    public function testCatalog(Application $application, array $overrides = []): array
    {
        $app = $this->applicationWithOverrides($application, $overrides);
        $catalogUrl = $this->catalogUrl($app);
        $auth = $this->resolveAuth($app);
        $path = $this->catalogPath($app);

        if ($catalogUrl === null) {
            return [
                'ok' => false,
                'catalog_url' => null,
                'catalog_path' => $path,
                'auth_source' => $auth['source'],
                'message' => 'Base URL is required before Nexus can reach the MCP catalog.',
            ];
        }

        if (! $auth['token']) {
            return [
                'ok' => false,
                'catalog_url' => $catalogUrl,
                'catalog_path' => $path,
                'auth_source' => null,
                'message' => 'No API credential configured. Set an MCP API key, webhook secret, or SSO API key.',
            ];
        }

        $response = $this->request($app, 'GET', $path);

        if ($response->failed()) {
            return [
                'ok' => false,
                'catalog_url' => $catalogUrl,
                'catalog_path' => $path,
                'auth_source' => $auth['source'],
                'http_status' => $response->status(),
                'message' => "Catalog request failed with HTTP {$response->status()}.",
            ];
        }

        $endpoints = $response->json();

        if (! is_array($endpoints)) {
            return [
                'ok' => false,
                'catalog_url' => $catalogUrl,
                'catalog_path' => $path,
                'auth_source' => $auth['source'],
                'http_status' => $response->status(),
                'message' => 'Catalog response must be a JSON array of endpoints.',
            ];
        }

        return [
            'ok' => true,
            'catalog_url' => $catalogUrl,
            'catalog_path' => $path,
            'auth_source' => $auth['source'],
            'http_status' => $response->status(),
            'endpoint_count' => count($endpoints),
            'endpoints' => array_slice($endpoints, 0, 5),
            'message' => count($endpoints) === 0
                ? 'Catalog is reachable but returned no endpoints.'
                : 'Catalog is reachable.',
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function applicationWithOverrides(Application $application, array $overrides): Application
    {
        $app = $application->replicate();

        foreach (['base_url', 'mcp_catalog_path', 'mcp_api_key', 'mcp_auth_mode', 'api_key'] as $key) {
            if (array_key_exists($key, $overrides)) {
                $app->{$key} = $overrides[$key];
            }
        }

        if (array_key_exists('notification_config', $overrides)) {
            $app->notification_config = $overrides['notification_config'];
        }

        return $app;
    }
}
