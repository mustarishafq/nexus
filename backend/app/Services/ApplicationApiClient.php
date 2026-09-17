<?php

namespace App\Services;

use App\Models\Application;
use App\Models\User;
use App\Support\ApplicationSsoCredentials;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Throwable;

class ApplicationApiClient
{
    public const DEFAULT_CATALOG_PATH = '/api/mcp-catalog';

    public const HEALTH_TIMEOUT = 5;

    public const HEALTH_CONNECT_TIMEOUT = 3;

    public const DEFAULT_TIMEOUT = 15;

    public const AUTH_MODE_BEARER = 'bearer';

    public const AUTH_MODE_X_API_KEY = 'x-api-key';

    public const ACTING_USER_ID_HEADER = 'X-Nexus-Acting-User-Id';

    public const ACTING_EMAIL_HEADER = 'X-Nexus-Acting-Email';

    public const ACTING_NAME_HEADER = 'X-Nexus-Acting-Name';

    public const ACTING_MODE_HEADER = 'X-Nexus-Acting-Mode';

    public const SSO_TOKEN_HEADER = 'X-Nexus-Sso-Token';

    public const SSO_VERIFY_PATH = '/api/sso/nexus/verify';

    /** @var list<string> */
    public const SSO_VERIFY_PATHS = [
        '/api/sso/nexus/verify',
        '/api/auth/sso/nexus',
        '/api/v1/sso/nexus/verify',
    ];

    /**
     * @var array<string, array{token: ?string, user_id: ?string}>
     */
    private array $userSessions = [];

    /**
     * @var array<int|string, string>
     */
    private array $verifyPathsByApplication = [];

    /**
     * @var array{email: ?string, user_id?: ?string, headers: array<string, string>}
     */
    private array $actingIdentityState = ['email' => null, 'headers' => []];

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
        return $this->send($application, $method, $path, $options);
    }

    /**
     * Call a connected Application on behalf of a Nexus user so list/show
     * endpoints follow that user's system-account visibility.
     *
     * Prefers a short-lived user Bearer token from POST /api/sso/nexus/verify.
     * Falls back to the shared MCP credential plus acting-user headers when
     * the satellite does not expose SSO verify.
     *
     * @param  array<string, mixed>  $options
     */
    public function requestForUser(User $user, Application $application, string $method, string $path, array $options = []): Response
    {
        $requestedEmail = $options['sso_email'] ?? null;
        unset($options['sso_email']);

        $identity = $this->actingIdentity($user, $application, is_string($requestedEmail) ? $requestedEmail : null);
        $email = $identity['email'];
        $session = $this->resolveUserSession($user, $application, $email);
        $userToken = $session['token'] ?? null;
        if (! empty($session['user_id'])) {
            $identity['user_id'] = (string) $session['user_id'];
            $identity['headers'][self::ACTING_USER_ID_HEADER] = (string) $session['user_id'];
        }

        $extraHeaders = $identity['headers'];
        $shared = $this->resolveAuth($application);
        if ($userToken) {
            $extraHeaders['Authorization'] = 'Bearer '.$userToken;
            if ($shared['token']) {
                $extraHeaders['X-API-Key'] = $shared['token'];
            }
        } else {
            $ssoJwt = $this->mintSsoJwt($user, $application, $email);
            if ($ssoJwt) {
                $extraHeaders[self::SSO_TOKEN_HEADER] = $ssoJwt;
            }
        }

        if (strtoupper($method) === 'GET' && ! $this->queryRequestsOrgWide($options['query'] ?? null)) {
            $options['query'] = $this->mergeMineQuery(
                is_array($options['query'] ?? null) ? $options['query'] : [],
                $identity
            );
        }

        $this->actingIdentityState = $identity;

        return $this->send(
            $application,
            $method,
            $path,
            $options,
            $extraHeaders,
            applySharedAuth: $userToken === null,
        );
    }

    /**
     * @param  array<string, mixed>  $options
     * @param  array<string, string>  $extraHeaders
     */
    private function send(
        Application $application,
        string $method,
        string $path,
        array $options = [],
        array $extraHeaders = [],
        bool $applySharedAuth = true,
    ): Response {
        $baseUrl = rtrim((string) $application->base_url, '/');
        $path = '/'.ltrim($path, '/');
        $timeout = (int) ($options['timeout'] ?? self::DEFAULT_TIMEOUT);
        $connectTimeout = (int) ($options['connect_timeout'] ?? min(5, $timeout));

        $request = Http::baseUrl($baseUrl)
            ->timeout($timeout)
            ->connectTimeout($connectTimeout)
            ->acceptJson();

        if ($extraHeaders !== []) {
            $request = $request->withHeaders($extraHeaders);
        }

        if ($applySharedAuth) {
            $request = $this->applyAuth($request, $application);
        }

        return $request->send(strtoupper($method), $path, $options);
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
     * Accept both the documented flat array shape and common wrapper objects
     * returned by connected apps, e.g. {"endpoints": [...]} or {"data": [...]}.
     *
     * @return list<array<string, mixed>>
     */
    public function parseCatalogEndpoints(mixed $payload): array
    {
        if (! is_array($payload)) {
            return [];
        }

        if ($this->looksLikeEndpointList($payload)) {
            return $this->onlyEndpointRecords($payload);
        }

        foreach (['endpoints', 'data', 'items', 'routes', 'apis'] as $key) {
            if (! isset($payload[$key]) || ! is_array($payload[$key])) {
                continue;
            }

            $parsed = $this->parseCatalogEndpoints($payload[$key]);
            if ($parsed !== []) {
                return $parsed;
            }
        }

        return $this->onlyEndpointRecords(array_values($payload));
    }

    /**
     * @param  array<mixed>  $payload
     */
    private function looksLikeEndpointList(array $payload): bool
    {
        if ($payload === []) {
            return true;
        }

        if (! array_is_list($payload)) {
            return false;
        }

        $first = $payload[0] ?? null;

        return is_array($first) && $this->looksLikeEndpointRecord($first);
    }

    /**
     * @param  array<mixed>  $record
     */
    private function looksLikeEndpointRecord(array $record): bool
    {
        return isset($record['path'])
            || isset($record['method'])
            || isset($record['uri'])
            || isset($record['url']);
    }

    /**
     * @param  array<mixed>  $items
     * @return list<array<string, mixed>>
     */
    private function onlyEndpointRecords(array $items): array
    {
        $endpoints = [];

        foreach ($items as $item) {
            if (! is_array($item) || ! $this->looksLikeEndpointRecord($item)) {
                continue;
            }

            if (! isset($item['path'])) {
                if (isset($item['uri'])) {
                    $item['path'] = $item['uri'];
                } elseif (isset($item['url'])) {
                    $item['path'] = $item['url'];
                }
            }

            $endpoints[] = $item;
        }

        return $endpoints;
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

        $endpoints = $this->parseCatalogEndpoints($response->json());

        if ($endpoints === [] && is_array($response->json()) && $response->json() !== []) {
            return [
                'ok' => false,
                'catalog_url' => $catalogUrl,
                'catalog_path' => $path,
                'auth_source' => $auth['source'],
                'http_status' => $response->status(),
                'message' => 'Catalog response was JSON but did not contain a recognizable endpoint list.',
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

    /**
     * @return array{email: ?string, headers: array<string, string>}
     */
    public function actingIdentity(User $user, Application $application, mixed $requestedEmail = null): array
    {
        $email = ApplicationSsoCredentials::resolveLaunchEmail($user, $application, $requestedEmail)
            ?: (trim((string) ($user->email ?? '')) ?: null);

        $headers = [
            self::ACTING_USER_ID_HEADER => (string) $user->id,
            self::ACTING_MODE_HEADER => 'assistant',
        ];

        if (is_string($email) && $email !== '') {
            $headers[self::ACTING_EMAIL_HEADER] = $email;
        }

        $primaryEmail = strtolower(trim((string) ($user->email ?? '')));
        $isPrimaryAccount = is_string($email)
            && $primaryEmail !== ''
            && strtolower(trim($email)) === $primaryEmail;
        $name = trim((string) ($user->name ?? ''));
        if ($isPrimaryAccount && $name !== '') {
            $headers[self::ACTING_NAME_HEADER] = $name;
        }

        return ['email' => $email, 'headers' => $headers];
    }

    /**
     * @return array{token: ?string, user_id: ?string}
     */
    private function resolveUserSession(User $user, Application $application, ?string $email): array
    {
        if (! is_string($email) || $email === '') {
            return ['token' => null, 'user_id' => null];
        }

        $cacheKey = $user->id.'|'.$application->id.'|'.strtolower($email);
        if (array_key_exists($cacheKey, $this->userSessions)) {
            return $this->userSessions[$cacheKey];
        }

        $session = $this->exchangeSsoSession($user, $application, $email);
        $this->userSessions[$cacheKey] = $session;

        return $session;
    }

    /**
     * @return array{token: ?string, user_id: ?string}
     */
    private function exchangeSsoSession(User $user, Application $application, string $email): array
    {
        $ssoJwt = $this->mintSsoJwt($user, $application, $email);
        if (! $ssoJwt) {
            return ['token' => null, 'user_id' => null];
        }

        $paths = self::SSO_VERIFY_PATHS;
        $preferred = $this->verifyPathsByApplication[$application->id] ?? null;
        if (is_string($preferred) && $preferred !== '') {
            $paths = array_values(array_unique([$preferred, ...$paths]));
        }

        foreach ($paths as $path) {
            try {
                $response = $this->send(
                    $application,
                    'POST',
                    $path,
                    [
                        'json' => ['token' => $ssoJwt],
                        'timeout' => 8,
                        'connect_timeout' => 3,
                    ],
                    [],
                    false,
                );
            } catch (Throwable) {
                continue;
            }

            if ($response->failed()) {
                continue;
            }

            $payload = $response->json();
            $token = $this->extractAccessToken($payload);
            if (! is_string($token) || $token === '') {
                continue;
            }

            $this->verifyPathsByApplication[$application->id] = $path;

            return [
                'token' => $token,
                'user_id' => $this->extractActingUserId($payload),
            ];
        }

        return ['token' => null, 'user_id' => null];
    }

    private function mintSsoJwt(User $user, Application $application, ?string $email): ?string
    {
        if (! is_string($email) || $email === '' || ! $application->api_key) {
            return null;
        }

        try {
            return ApplicationSsoCredentials::mintLaunchToken(
                $user,
                $application,
                $email,
                null,
                null,
                ApplicationSsoCredentials::API_TTL_SECONDS,
            );
        } catch (Throwable) {
            return null;
        }
    }

    public function extractAccessToken(mixed $payload): ?string
    {
        if (! is_array($payload)) {
            return null;
        }

        foreach (['token', 'access_token', 'plainTextToken', 'jwt'] as $key) {
            $value = $payload[$key] ?? null;
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        foreach (['data', 'result'] as $wrapper) {
            if (! isset($payload[$wrapper])) {
                continue;
            }

            $nested = $this->extractAccessToken($payload[$wrapper]);
            if ($nested) {
                return $nested;
            }
        }

        return null;
    }

    /**
     * @return array{email: ?string, user_id?: ?string, headers: array<string, string>}
     */
    public function lastActingIdentity(): array
    {
        return $this->actingIdentityState;
    }

    public function extractActingUserId(mixed $payload): ?string
    {
        if (! is_array($payload)) {
            return null;
        }

        $user = $payload['user'] ?? ($payload['data']['user'] ?? null);
        if (is_array($user) && (isset($user['id']) || isset($user['user_id']))) {
            $value = $user['id'] ?? $user['user_id'];
            if (is_int($value) || (is_string($value) && trim($value) !== '')) {
                return (string) $value;
            }
        }

        return null;
    }

    /**
     * Keep list payloads to the acting system account unless the caller asked for org-wide data.
     *
     * @param  array<string, mixed>|list<mixed>|null  $query
     */
    public function scopePayloadToActingUser(mixed $payload, array $identity, string $method, mixed $query = null): mixed
    {
        if (strtoupper($method) !== 'GET' || ! is_array($payload) || $this->queryRequestsOrgWide($query)) {
            return $payload;
        }

        $ids = array_values(array_filter([
            isset($identity['user_id']) ? (string) $identity['user_id'] : null,
        ]));
        $emails = array_values(array_filter([
            isset($identity['email']) ? strtolower(trim((string) $identity['email'])) : null,
        ]));

        if ($ids === [] && $emails === []) {
            return $payload;
        }

        foreach (['data', 'items', 'results', 'tasks', 'records'] as $key) {
            if (! isset($payload[$key]) || ! is_array($payload[$key]) || ! array_is_list($payload[$key])) {
                continue;
            }

            $filtered = $this->filterRecordsForActingUser($payload[$key], $ids, $emails);
            if ($filtered !== null) {
                $payload[$key] = $filtered;
                if (isset($payload['total']) && is_numeric($payload['total'])) {
                    $payload['total'] = count($filtered);
                }
            }
        }

        if (array_is_list($payload) && $payload !== [] && is_array($payload[0] ?? null)) {
            $filtered = $this->filterRecordsForActingUser($payload, $ids, $emails);

            return $filtered ?? $payload;
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>|null  $query
     */
    public function queryRequestsOrgWide(mixed $query): bool
    {
        if (! is_array($query)) {
            return false;
        }

        $scope = strtolower(trim((string) ($query['scope'] ?? $query['view'] ?? '')));

        return in_array($scope, ['all', 'team', 'org', 'organization', 'company', 'everyone'], true);
    }

    /**
     * @param  array<string, mixed>  $query
     * @param  array{email: ?string, user_id?: ?string, headers: array<string, string>}  $identity
     * @return array<string, mixed>
     */
    public function mergeMineQuery(array $query, array $identity): array
    {
        if (! isset($query['scope']) && ! isset($query['view'])) {
            $query['scope'] = 'mine';
        }

        $userId = $identity['user_id'] ?? null;
        if (is_string($userId) && $userId !== '') {
            foreach (['assigned_to', 'assigned_to_id', 'assignee_id', 'user_id'] as $key) {
                if (! array_key_exists($key, $query)) {
                    $query[$key] = $userId;
                }
            }
        }

        $email = $identity['email'] ?? null;
        if (is_string($email) && $email !== '' && ! array_key_exists('email', $query)) {
            $query['email'] = $email;
        }

        return $query;
    }

    /**
     * @param  list<mixed>  $records
     * @param  list<string>  $ids
     * @param  list<string>  $emails
     * @return list<mixed>|null
     */
    private function filterRecordsForActingUser(array $records, array $ids, array $emails): ?array
    {
        $identityKeys = [
            'assigned_to', 'assigned_to_id', 'assignee_id', 'assignee', 'user_id', 'owner_id',
            'task_owner_id', 'created_by_id', 'created_by', 'executor_id', 'email',
            'assigned_to_email', 'user_email', 'owner_email', 'assigned_to_ids',
        ];

        $hasIdentityFields = false;
        foreach ($records as $record) {
            if (! is_array($record)) {
                continue;
            }
            foreach ($identityKeys as $key) {
                if (array_key_exists($key, $record)) {
                    $hasIdentityFields = true;
                    break 2;
                }
            }
        }

        if (! $hasIdentityFields) {
            return null;
        }

        $kept = [];
        foreach ($records as $record) {
            if (! is_array($record) || $this->recordMatchesActingUser($record, $ids, $emails, $identityKeys)) {
                $kept[] = $record;
            }
        }

        return $kept;
    }

    /**
     * @param  array<string, mixed>  $record
     * @param  list<string>  $ids
     * @param  list<string>  $emails
     * @param  list<string>  $identityKeys
     */
    private function recordMatchesActingUser(array $record, array $ids, array $emails, array $identityKeys): bool
    {
        foreach ($identityKeys as $key) {
            if (! array_key_exists($key, $record)) {
                continue;
            }
            $value = $record[$key];
            $values = is_array($value) ? $value : [$value];
            foreach ($values as $item) {
                if (is_array($item)) {
                    $item = $item['id'] ?? $item['email'] ?? $item['user_id'] ?? null;
                }
                if ($item === null || $item === '') {
                    continue;
                }
                $normalized = strtolower(trim((string) $item));
                if (in_array($normalized, array_map('strtolower', $ids), true) || in_array($normalized, $emails, true)) {
                    return true;
                }
            }
        }

        return false;
    }
}
