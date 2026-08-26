<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class QuizGameSettings
{
    public const COLUMN = 'games_settings';

    private const CACHE_KEY = 'quiz_game_settings';

    public const DEFAULTS = [
        'live_exp_enabled' => true,
        'rank_1' => 20,
        'rank_2' => 15,
        'rank_3' => 10,
        'rank_4_to_10' => 5,
        'rank_11_plus' => 2,
    ];

    /**
     * @return array{
     *     live_exp_enabled: bool,
     *     rank_1: int,
     *     rank_2: int,
     *     rank_3: int,
     *     rank_4_to_10: int,
     *     rank_11_plus: int
     * }
     */
    public static function current(?object $settings = null): array
    {
        $fromDb = self::fromDatabase($settings);
        if (is_array($fromDb)) {
            return self::normalize($fromDb);
        }

        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached)) {
            return self::normalize($cached);
        }

        return self::normalize([]);
    }

    public static function expForRank(int $rank): int
    {
        if ($rank <= 0) {
            return 0;
        }

        $settings = self::current();
        if (! $settings['live_exp_enabled']) {
            return 0;
        }

        return match (true) {
            $rank === 1 => $settings['rank_1'],
            $rank === 2 => $settings['rank_2'],
            $rank === 3 => $settings['rank_3'],
            $rank <= 10 => $settings['rank_4_to_10'],
            default => $settings['rank_11_plus'],
        };
    }

    /**
     * @return array<string, mixed>
     */
    public static function payload(?object $settings = null): array
    {
        $current = self::current($settings);

        return [
            ...$current,
            'defaults' => self::DEFAULTS,
            'published_exp_enabled' => false,
        ];
    }

    /** @return array<string, mixed> */
    public static function validationRules(): array
    {
        return [
            'live_exp_enabled' => ['present', 'boolean'],
            'rank_1' => ['required', 'integer', 'min:0', 'max:10000'],
            'rank_2' => ['required', 'integer', 'min:0', 'max:10000'],
            'rank_3' => ['required', 'integer', 'min:0', 'max:10000'],
            'rank_4_to_10' => ['required', 'integer', 'min:0', 'max:10000'],
            'rank_11_plus' => ['required', 'integer', 'min:0', 'max:10000'],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function save(array $payload): void
    {
        $normalized = self::normalize($payload);
        Cache::forever(self::CACHE_KEY, $normalized);

        $encoded = json_encode($normalized);
        if (Schema::hasTable('app_settings') && Schema::hasColumn('app_settings', self::COLUMN)) {
            $row = DB::table('app_settings')->first();
            if ($row) {
                DB::table('app_settings')->where('id', $row->id)->update([
                    self::COLUMN => $encoded,
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('app_settings')->insert([
                    'system_name' => config('app.name', 'EMZI Nexus Brain'),
                    self::COLUMN => $encoded,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        AppSettings::forget();
    }

    /**
     * @param  array<string, mixed>  $raw
     * @return array{
     *     live_exp_enabled: bool,
     *     rank_1: int,
     *     rank_2: int,
     *     rank_3: int,
     *     rank_4_to_10: int,
     *     rank_11_plus: int
     * }
     */
    public static function normalize(array $raw): array
    {
        return [
            'live_exp_enabled' => array_key_exists('live_exp_enabled', $raw)
                ? self::asBool($raw['live_exp_enabled'], self::DEFAULTS['live_exp_enabled'])
                : self::DEFAULTS['live_exp_enabled'],
            'rank_1' => self::clampExp($raw['rank_1'] ?? null, self::DEFAULTS['rank_1']),
            'rank_2' => self::clampExp($raw['rank_2'] ?? null, self::DEFAULTS['rank_2']),
            'rank_3' => self::clampExp($raw['rank_3'] ?? null, self::DEFAULTS['rank_3']),
            'rank_4_to_10' => self::clampExp($raw['rank_4_to_10'] ?? null, self::DEFAULTS['rank_4_to_10']),
            'rank_11_plus' => self::clampExp($raw['rank_11_plus'] ?? null, self::DEFAULTS['rank_11_plus']),
        ];
    }

    /** @return array<string, mixed>|null */
    private static function fromDatabase(?object $settings): ?array
    {
        if (! Schema::hasTable('app_settings') || ! Schema::hasColumn('app_settings', self::COLUMN)) {
            return null;
        }

        $settings ??= AppSettings::row();
        if (! $settings) {
            return null;
        }

        $raw = $settings->{self::COLUMN} ?? null;
        if ($raw === null || $raw === '') {
            return null;
        }

        if (is_string($raw)) {
            $decoded = json_decode($raw, true);

            return is_array($decoded) ? $decoded : null;
        }

        return is_array($raw) ? $raw : null;
    }

    private static function asBool(mixed $value, bool $default = true): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_int($value) || is_float($value)) {
            return (int) $value !== 0;
        }

        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            if (in_array($normalized, ['false', '0', 'off', 'no', ''], true)) {
                return false;
            }
            if (in_array($normalized, ['true', '1', 'on', 'yes'], true)) {
                return true;
            }
        }

        return $default;
    }

    private static function clampExp(mixed $value, int $fallback): int
    {
        if (! is_numeric($value)) {
            return $fallback;
        }

        return max(0, min(10000, (int) $value));
    }
}
