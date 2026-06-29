<?php

namespace App\Support;

use App\Models\User;

class McpUserAccess
{
    public const NONE = 'none';

    public const READ = 'read';

    public const WRITE = 'write';

    public const BOTH = 'both';

    /** @var list<string> */
    public const LEVELS = [self::NONE, self::READ, self::WRITE, self::BOTH];

    public static function effectiveLevel(User $user): string
    {
        if ($user->role === 'admin') {
            return self::BOTH;
        }

        $level = (string) ($user->mcp_access ?? self::NONE);

        return in_array($level, self::LEVELS, true) ? $level : self::NONE;
    }

    public static function canUseMcp(User $user): bool
    {
        return self::effectiveLevel($user) !== self::NONE;
    }

    public static function canRead(User $user): bool
    {
        return in_array(self::effectiveLevel($user), [self::READ, self::BOTH], true);
    }

    public static function canWrite(User $user): bool
    {
        return in_array(self::effectiveLevel($user), [self::WRITE, self::BOTH], true);
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

        if ($toolName !== 'call_application_api') {
            return true;
        }

        $method = strtoupper((string) ($arguments['method'] ?? 'GET'));

        if ($method === 'GET') {
            return self::canRead($user);
        }

        return self::canWrite($user);
    }

    public static function denialMessage(User $user, string $toolName, array $arguments = []): string
    {
        if (! self::canUseMcp($user)) {
            return 'MCP access is disabled for this user.';
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
}
