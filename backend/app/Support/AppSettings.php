<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AppSettings
{
    private const CACHE_KEY = 'app_settings_row';

    private const CACHE_TTL_SECONDS = 300;

    public static function row(): ?object
    {
        if (! Schema::hasTable('app_settings')) {
            return null;
        }

        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function () {
            return DB::table('app_settings')->first();
        });
    }

    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    public static function isAttendanceEnabled(): bool
    {
        $settings = self::row();

        if (! $settings) {
            return true;
        }

        $attendance = AttendanceWatermarkSettings::normalizeConfig((array) $settings);

        return (bool) $attendance['enabled'];
    }

    /**
     * Map admin/user-facing encryption labels to Laravel's SMTP mailer scheme.
     * Symfony Mailer supports "smtp" (STARTTLS) and "smtps" (implicit SSL) only.
     */
    public static function smtpSchemeFromEncryption(?string $encryption): ?string
    {
        return match (strtolower(trim((string) $encryption))) {
            'ssl' => 'smtps',
            'tls', '' => null,
            default => null,
        };
    }
}
