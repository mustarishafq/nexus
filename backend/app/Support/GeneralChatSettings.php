<?php

namespace App\Support;

use Carbon\Carbon;
use Carbon\CarbonInterface;

class GeneralChatSettings
{
    public const FEATURE = 'general_chat';

    public const PERIOD_DAILY = 'daily';

    public const PERIOD_WEEKLY = 'weekly';

    public const PERIOD_MONTHLY = 'monthly';

    public const PERIODS = [
        self::PERIOD_DAILY,
        self::PERIOD_WEEKLY,
        self::PERIOD_MONTHLY,
    ];

    public const DEFAULT_TOKEN_LIMIT = 100000;

    public const DEFAULT_PERIOD = self::PERIOD_MONTHLY;

    public const DEFAULT_RESET_TIME = '00:00';

    public const DEFAULT_WEEKDAY = 1;

    public const DEFAULT_MONTH_DAY = 1;

    /**
     * @return array{
     *     token_limit: int,
     *     reset_period: string,
     *     reset_time: string,
     *     reset_weekday: int,
     *     reset_month_day: int
     * }
     */
    public static function normalize(?object $settings = null): array
    {
        $settings ??= AppSettings::row();

        $period = strtolower(trim((string) ($settings->general_chat_reset_period ?? self::DEFAULT_PERIOD)));
        if (! in_array($period, self::PERIODS, true)) {
            $period = self::DEFAULT_PERIOD;
        }

        return [
            'token_limit' => max(0, (int) ($settings->general_chat_token_limit ?? self::DEFAULT_TOKEN_LIMIT)),
            'reset_period' => $period,
            'reset_time' => self::normalizeTime($settings->general_chat_reset_time ?? self::DEFAULT_RESET_TIME),
            'reset_weekday' => self::normalizeWeekday($settings->general_chat_reset_weekday ?? self::DEFAULT_WEEKDAY),
            'reset_month_day' => self::normalizeMonthDay($settings->general_chat_reset_month_day ?? self::DEFAULT_MONTH_DAY),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function validationRules(): array
    {
        return [
            'general_chat_token_limit' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
            'general_chat_reset_period' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', self::PERIODS)],
            'general_chat_reset_time' => ['sometimes', 'nullable', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/'],
            'general_chat_reset_weekday' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:7'],
            'general_chat_reset_month_day' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:28'],
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public static function toDatabaseColumns(array $input, ?object $current = null): array
    {
        $merged = self::normalize((object) array_merge((array) ($current ?? []), $input));

        return [
            'general_chat_token_limit' => $merged['token_limit'],
            'general_chat_reset_period' => $merged['reset_period'],
            'general_chat_reset_time' => $merged['reset_time'],
            'general_chat_reset_weekday' => $merged['reset_weekday'],
            'general_chat_reset_month_day' => $merged['reset_month_day'],
        ];
    }

    /**
     * @return array{0: CarbonInterface, 1: CarbonInterface}
     */
    public static function currentWindow(?CarbonInterface $at = null, ?object $settings = null): array
    {
        $at = Carbon::parse($at ?? now())->timezone((string) config('app.timezone'));
        $config = self::normalize($settings);
        [$hour, $minute] = self::parseTime($config['reset_time']);

        return match ($config['reset_period']) {
            self::PERIOD_DAILY => self::dailyWindow($at, $hour, $minute),
            self::PERIOD_WEEKLY => self::weeklyWindow($at, $hour, $minute, $config['reset_weekday']),
            default => self::monthlyWindow($at, $hour, $minute, $config['reset_month_day']),
        };
    }

    public static function payload(?object $settings = null): array
    {
        $config = self::normalize($settings);
        [$startsAt, $resetsAt] = self::currentWindow(null, $settings);

        return [
            'general_chat_token_limit' => $config['token_limit'],
            'general_chat_reset_period' => $config['reset_period'],
            'general_chat_reset_time' => $config['reset_time'],
            'general_chat_reset_weekday' => $config['reset_weekday'],
            'general_chat_reset_month_day' => $config['reset_month_day'],
            'general_chat' => [
                ...$config,
                'period_starts_at' => $startsAt->toIso8601String(),
                'resets_at' => $resetsAt->toIso8601String(),
            ],
        ];
    }

    /**
     * @return array{0: CarbonInterface, 1: CarbonInterface}
     */
    private static function dailyWindow(CarbonInterface $at, int $hour, int $minute): array
    {
        $start = $at->copy()->setTime($hour, $minute, 0);
        if ($at->lt($start)) {
            $start->subDay();
        }

        return [$start, $start->copy()->addDay()];
    }

    /**
     * @return array{0: CarbonInterface, 1: CarbonInterface}
     */
    private static function weeklyWindow(CarbonInterface $at, int $hour, int $minute, int $isoWeekday): array
    {
        $carbonDow = $isoWeekday === 7 ? Carbon::SUNDAY : $isoWeekday;
        $start = $at->copy()->startOfWeek($carbonDow)->setTime($hour, $minute, 0);
        if ($at->lt($start)) {
            $start->subWeek();
        }

        return [$start, $start->copy()->addWeek()];
    }

    /**
     * @return array{0: CarbonInterface, 1: CarbonInterface}
     */
    private static function monthlyWindow(CarbonInterface $at, int $hour, int $minute, int $monthDay): array
    {
        $start = $at->copy()->startOfMonth()->day($monthDay)->setTime($hour, $minute, 0);
        if ($at->lt($start)) {
            $start = $start->copy()->subMonthNoOverflow()->day($monthDay)->setTime($hour, $minute, 0);
        }

        return [$start, $start->copy()->addMonthNoOverflow()->day($monthDay)->setTime($hour, $minute, 0)];
    }

    public static function normalizeTime(mixed $value): string
    {
        $raw = trim((string) $value);
        if (preg_match('/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/', $raw, $matches)) {
            return $matches[1].':'.$matches[2];
        }

        return self::DEFAULT_RESET_TIME;
    }

    public static function normalizeWeekday(mixed $value): int
    {
        $day = (int) $value;

        return $day >= 1 && $day <= 7 ? $day : self::DEFAULT_WEEKDAY;
    }

    public static function normalizeMonthDay(mixed $value): int
    {
        $day = (int) $value;

        return $day >= 1 && $day <= 28 ? $day : self::DEFAULT_MONTH_DAY;
    }

    /**
     * @return array{0: int, 1: int}
     */
    private static function parseTime(string $time): array
    {
        [$hour, $minute] = array_map('intval', explode(':', $time));

        return [$hour, $minute];
    }
}
