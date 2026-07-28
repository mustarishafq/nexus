<?php

namespace App\Support;

/**
 * Request-scoped flag so inbound policy ingest does not echo a push back to the peer.
 */
class AttendancePolicySyncGuard
{
    private static bool $skipPush = false;

    public static function skipPush(): bool
    {
        return self::$skipPush;
    }

    public static function runWithoutPush(callable $callback): mixed
    {
        $previous = self::$skipPush;
        self::$skipPush = true;

        try {
            return $callback();
        } finally {
            self::$skipPush = $previous;
        }
    }
}
