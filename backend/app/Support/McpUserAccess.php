<?php

namespace App\Support;

use App\Models\Application;
use App\Models\User;
use App\Models\UserApplicationMcpAccess;

class McpUserAccess
{
    public const NONE = 'none';

    public const READ = 'read';

    public const WRITE = 'write';

    public const BOTH = 'both';

    /** @var list<string> */
    public const LEVELS = [self::NONE, self::READ, self::WRITE, self::BOTH];

    /** @var array<int, array<int, string>> */
    private static array $overrideCache = [];

    public static function effectiveLevel(User $user): string
    {
        $level = (string) ($user->mcp_access ?? self::NONE);

        return in_array($level, self::LEVELS, true) ? $level : self::NONE;
    }

    public static function effectiveLevelForApplication(User $user, Application $application): string
    {
        $override = self::applicationOverrideLevel($user, $application);

        if ($override !== null) {
            return $override;
        }

        return self::effectiveLevel($user);
    }

    public static function applicationOverrideLevel(User $user, Application $application): ?string
    {
        self::loadOverridesForUser($user);

        $level = self::$overrideCache[$user->id][$application->id] ?? null;

        if ($level === null) {
            return null;
        }

        return in_array($level, self::LEVELS, true) ? $level : null;
    }

    public static function canUseMcp(User $user): bool
    {
        if (self::effectiveLevel($user) !== self::NONE) {
            return true;
        }

        self::loadOverridesForUser($user);

        foreach (self::$overrideCache[$user->id] ?? [] as $level) {
            if ($level !== self::NONE) {
                return true;
            }
        }

        return false;
    }

    public static function canUseMcpForApplication(User $user, Application $application): bool
    {
        return self::effectiveLevelForApplication($user, $application) !== self::NONE;
    }

    public static function canRead(User $user): bool
    {
        if (in_array(self::effectiveLevel($user), [self::READ, self::BOTH], true)) {
            return true;
        }

        return self::userHasAnyApplicationCapability($user, fn (Application $application) => self::canReadForApplication($user, $application));
    }

    public static function canWrite(User $user): bool
    {
        if (in_array(self::effectiveLevel($user), [self::WRITE, self::BOTH], true)) {
            return true;
        }

        return self::userHasAnyApplicationCapability($user, fn (Application $application) => self::canWriteForApplication($user, $application));
    }

    public static function canReadForApplication(User $user, Application $application): bool
    {
        return in_array(self::effectiveLevelForApplication($user, $application), [self::READ, self::BOTH], true);
    }

    public static function canWriteForApplication(User $user, Application $application): bool
    {
        return in_array(self::effectiveLevelForApplication($user, $application), [self::WRITE, self::BOTH], true);
    }

    /**
     * @return list<string>
     */
    public static function allowedHttpMethods(User $user): array
    {
        $methods = [];

        if (self::canRead($user)) {
            $methods['GET'] = true;
        }

        if (self::canWrite($user)) {
            foreach (['POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
                $methods[$method] = true;
            }
        }

        foreach (UserApplicationAccess::accessibleMcpApplicationsQuery($user)->get() as $application) {
            foreach (self::allowedHttpMethodsForApplication($user, $application) as $method) {
                $methods[$method] = true;
            }
        }

        return array_keys($methods);
    }

    /**
     * @return list<string>
     */
    public static function allowedHttpMethodsForApplication(User $user, Application $application): array
    {
        $methods = [];

        if (self::canReadForApplication($user, $application)) {
            $methods[] = 'GET';
        }

        if (self::canWriteForApplication($user, $application)) {
            array_push($methods, 'POST', 'PUT', 'PATCH', 'DELETE');
        }

        return $methods;
    }

    /**
     * @param  list<array<string, mixed>>  $endpoints
     * @return list<array<string, mixed>>
     */
    public static function filterCatalogEndpoints(User $user, array $endpoints): array
    {
        return self::filterCatalogEndpointsForMethods($endpoints, self::allowedHttpMethods($user));
    }

    /**
     * @param  list<array<string, mixed>>  $endpoints
     * @return list<array<string, mixed>>
     */
    public static function filterCatalogEndpointsForApplication(User $user, Application $application, array $endpoints): array
    {
        return self::filterCatalogEndpointsForMethods(
            $endpoints,
            self::allowedHttpMethodsForApplication($user, $application)
        );
    }

    public static function canListTool(User $user, string $toolName): bool
    {
        return match ($toolName) {
            'list_applications', 'describe_application_api' => self::canRead($user),
            'call_application_api' => self::canRead($user) || self::canWrite($user),
            default => false,
        };
    }

    /**
     * @param  array<string, mixed>  $arguments
     */
    public static function canCallTool(User $user, string $toolName, array $arguments = []): bool
    {
        if (! self::canListTool($user, $toolName)) {
            return false;
        }

        if (! in_array($toolName, ['call_application_api', 'describe_application_api'], true)) {
            return true;
        }

        $slug = trim((string) ($arguments['slug'] ?? ''));
        if ($slug === '') {
            return true;
        }

        try {
            $application = UserApplicationAccess::findMcpApplicationForUser($user, $slug);
        } catch (\Throwable) {
            if ($toolName === 'call_application_api') {
                $method = strtoupper((string) ($arguments['method'] ?? 'GET'));

                return $method === 'GET'
                    ? self::canRead($user)
                    : self::canWrite($user);
            }

            return false;
        }

        if (! self::canUseMcpForApplication($user, $application)) {
            return false;
        }

        if ($toolName === 'describe_application_api') {
            return self::canReadForApplication($user, $application)
                || self::canWriteForApplication($user, $application);
        }

        $method = strtoupper((string) ($arguments['method'] ?? 'GET'));

        if ($method === 'GET') {
            return self::canReadForApplication($user, $application);
        }

        return self::canWriteForApplication($user, $application);
    }

    /**
     * @param  array<string, mixed>  $arguments
     */
    public static function denialMessage(User $user, string $toolName, array $arguments = []): string
    {
        if (! self::canUseMcp($user)) {
            return 'MCP access is disabled for this user.';
        }

        $slug = trim((string) ($arguments['slug'] ?? ''));

        if ($slug !== '' && in_array($toolName, ['call_application_api', 'describe_application_api'], true)) {
            try {
                $application = UserApplicationAccess::findMcpApplicationForUser($user, $slug);
            } catch (\Throwable $e) {
                if ($toolName === 'call_application_api') {
                    $method = strtoupper((string) ($arguments['method'] ?? 'GET'));

                    if ($method === 'GET' && ! self::canRead($user)) {
                        return 'This user only has MCP write access.';
                    }

                    if ($method !== 'GET' && ! self::canWrite($user)) {
                        return 'This user only has MCP read access.';
                    }
                }

                return $e->getMessage();
            }

            if (! self::canUseMcpForApplication($user, $application)) {
                return "MCP access is disabled for {$slug}.";
            }

            if ($toolName === 'describe_application_api') {
                return "MCP read or write access is required for {$slug}.";
            }

            $method = strtoupper((string) ($arguments['method'] ?? 'GET'));

            if ($method === 'GET' && ! self::canReadForApplication($user, $application)) {
                return "This user only has MCP write access for {$slug}.";
            }

            if ($method !== 'GET' && ! self::canWriteForApplication($user, $application)) {
                return "This user only has MCP read access for {$slug}.";
            }
        }

        if ($toolName === 'call_application_api') {
            $method = strtoupper((string) ($arguments['method'] ?? 'GET'));

            if ($method === 'GET' && ! self::canRead($user)) {
                return 'This user only has MCP write access.';
            }

            if ($method !== 'GET' && ! self::canWrite($user)) {
                return 'This user only has MCP read access.';
            }
        }

        return 'Insufficient MCP permissions for this tool.';
    }

    /**
     * @param  array<int, array{application_id: int, mcp_access: string|null}>  $overrides
     */
    public static function syncApplicationOverrides(User $user, array $overrides): void
    {
        foreach ($overrides as $override) {
            $applicationId = (int) ($override['application_id'] ?? 0);
            $level = $override['mcp_access'] ?? null;

            if ($applicationId <= 0) {
                continue;
            }

            if ($level === null || $level === 'inherit' || $level === '') {
                UserApplicationMcpAccess::query()
                    ->where('user_id', $user->id)
                    ->where('application_id', $applicationId)
                    ->delete();

                continue;
            }

            if (! in_array($level, self::LEVELS, true)) {
                continue;
            }

            UserApplicationMcpAccess::query()->updateOrCreate(
                [
                    'user_id' => $user->id,
                    'application_id' => $applicationId,
                ],
                ['mcp_access' => $level]
            );
        }

        unset(self::$overrideCache[$user->id]);
    }

    public static function forgetCachedOverrides(User $user): void
    {
        unset(self::$overrideCache[$user->id]);
    }

    public static function resetOverrideCache(): void
    {
        self::$overrideCache = [];
    }

    private static function loadOverridesForUser(User $user): void
    {
        if (array_key_exists($user->id, self::$overrideCache)) {
            return;
        }

        if ($user->relationLoaded('applicationMcpAccess')) {
            self::$overrideCache[$user->id] = $user->applicationMcpAccess
                ->pluck('mcp_access', 'application_id')
                ->all();

            return;
        }

        self::$overrideCache[$user->id] = UserApplicationMcpAccess::query()
            ->where('user_id', $user->id)
            ->pluck('mcp_access', 'application_id')
            ->all();
    }

    /**
     * @param  callable(Application): bool  $checker
     */
    private static function userHasAnyApplicationCapability(User $user, callable $checker): bool
    {
        foreach (UserApplicationAccess::accessibleMcpApplicationsQuery($user)->get() as $application) {
            if ($checker($application)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<array<string, mixed>>  $endpoints
     * @param  list<string>  $allowedMethods
     * @return list<array<string, mixed>>
     */
    private static function filterCatalogEndpointsForMethods(array $endpoints, array $allowedMethods): array
    {
        $allowed = array_flip($allowedMethods);

        return array_values(array_filter(
            $endpoints,
            function ($endpoint) use ($allowed) {
                if (! is_array($endpoint)) {
                    return false;
                }

                $method = strtoupper((string) ($endpoint['method'] ?? 'GET'));

                return isset($allowed[$method]);
            }
        ));
    }
}
