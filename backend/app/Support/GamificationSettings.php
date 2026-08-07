<?php

namespace App\Support;

class GamificationSettings
{
    public const DEFAULT_EARLY_CLOCK_IN_WINDOW_MINUTES = 60;

    public const DEFAULT_EARLY_CLOCK_IN_CUTOFF_MINUTES = 0;

    /**
     * @return array{
     *     actions: array<string, array{base?: int, daily_cap?: int|null}>,
     *     early_clock_in_window_minutes: int,
     *     early_clock_in_cutoff_minutes: int
     * }
     */
    public static function overrides(?object $settings = null): array
    {
        $settings ??= AppSettings::row();
        $raw = $settings->gamification_overrides ?? null;

        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : [];
        }

        if (! is_array($raw)) {
            $raw = [];
        }

        $window = self::normalizeMinutes(
            $raw['early_clock_in_window_minutes'] ?? null,
            self::DEFAULT_EARLY_CLOCK_IN_WINDOW_MINUTES,
        );
        $cutoff = self::normalizeMinutes(
            $raw['early_clock_in_cutoff_minutes'] ?? null,
            self::DEFAULT_EARLY_CLOCK_IN_CUTOFF_MINUTES,
        );

        // Cutoff cannot exceed the early window or the eligible range is empty.
        $cutoff = min($cutoff, $window);

        return [
            'actions' => self::normalizeActionOverrides($raw['actions'] ?? []),
            'early_clock_in_window_minutes' => $window,
            'early_clock_in_cutoff_minutes' => $cutoff,
        ];
    }

    public static function earlyClockInWindowMinutes(?object $settings = null): int
    {
        return self::overrides($settings)['early_clock_in_window_minutes'];
    }

    public static function earlyClockInCutoffMinutes(?object $settings = null): int
    {
        return self::overrides($settings)['early_clock_in_cutoff_minutes'];
    }

    /**
     * @param  array<string, array{base: int, title: string, description: string, href: string|null, daily_cap: int|null, streak_key: string|null}>  $actions
     * @return array<string, array{base: int, title: string, description: string, href: string|null, daily_cap: int|null, streak_key: string|null}>
     */
    public static function applyToActions(array $actions, ?object $settings = null): array
    {
        $overrides = self::overrides($settings)['actions'];

        foreach ($actions as $actionKey => $definition) {
            if (! isset($overrides[$actionKey])) {
                continue;
            }

            $override = $overrides[$actionKey];
            if (array_key_exists('base', $override)) {
                $actions[$actionKey]['base'] = max(0, (int) $override['base']);
            }
            if (array_key_exists('daily_cap', $override)) {
                $cap = $override['daily_cap'];
                $actions[$actionKey]['daily_cap'] = $cap === null ? null : max(0, (int) $cap);
            }
        }

        return $actions;
    }

    /**
     * Admin editor payload with defaults + effective values.
     *
     * @return array{
     *     actions: list<array<string, mixed>>,
     *     early_clock_in_window_minutes: int,
     *     default_early_clock_in_window_minutes: int,
     *     early_clock_in_cutoff_minutes: int,
     *     default_early_clock_in_cutoff_minutes: int
     * }
     */
    public static function adminPayload(?object $settings = null): array
    {
        $defaults = GamificationCatalog::defaultActions();
        $effective = self::applyToActions($defaults, $settings);
        $rows = [];

        foreach ($defaults as $actionKey => $definition) {
            $rows[] = [
                'action_key' => $actionKey,
                'title' => $definition['title'],
                'description' => $definition['description'],
                'base' => (int) $effective[$actionKey]['base'],
                'daily_cap' => $effective[$actionKey]['daily_cap'],
                'default_base' => (int) $definition['base'],
                'default_daily_cap' => $definition['daily_cap'],
            ];
        }

        return [
            'actions' => $rows,
            'early_clock_in_window_minutes' => self::earlyClockInWindowMinutes($settings),
            'default_early_clock_in_window_minutes' => self::DEFAULT_EARLY_CLOCK_IN_WINDOW_MINUTES,
            'early_clock_in_cutoff_minutes' => self::earlyClockInCutoffMinutes($settings),
            'default_early_clock_in_cutoff_minutes' => self::DEFAULT_EARLY_CLOCK_IN_CUTOFF_MINUTES,
        ];
    }

    /** @return array<string, mixed> */
    public static function validationRules(): array
    {
        return [
            'gamification_overrides' => ['nullable', 'array'],
            'gamification_overrides.actions' => ['nullable', 'array'],
            'gamification_overrides.actions.*' => ['array'],
            'gamification_overrides.actions.*.base' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'gamification_overrides.actions.*.daily_cap' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'gamification_overrides.early_clock_in_window_minutes' => ['nullable', 'integer', 'min:0', 'max:240'],
            'gamification_overrides.early_clock_in_cutoff_minutes' => ['nullable', 'integer', 'min:0', 'max:240'],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array{gamification_overrides: string}
     */
    public static function toDatabaseColumns(array $overrides): array
    {
        $window = self::normalizeMinutes(
            $overrides['early_clock_in_window_minutes'] ?? null,
            self::DEFAULT_EARLY_CLOCK_IN_WINDOW_MINUTES,
        );
        $cutoff = self::normalizeMinutes(
            $overrides['early_clock_in_cutoff_minutes'] ?? null,
            self::DEFAULT_EARLY_CLOCK_IN_CUTOFF_MINUTES,
        );

        $normalized = [
            'actions' => self::normalizeActionOverrides($overrides['actions'] ?? []),
            'early_clock_in_window_minutes' => $window,
            'early_clock_in_cutoff_minutes' => min($cutoff, $window),
        ];

        return [
            'gamification_overrides' => json_encode($normalized),
        ];
    }

    /**
     * @return array<string, array{base?: int, daily_cap?: int|null}>
     */
    public static function normalizeActionOverrides(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $allowed = GamificationCatalog::defaultActions();
        $normalized = [];

        foreach ($value as $actionKey => $override) {
            if (! is_string($actionKey) || ! isset($allowed[$actionKey]) || ! is_array($override)) {
                continue;
            }

            $row = [];
            if (array_key_exists('base', $override) && $override['base'] !== null && $override['base'] !== '') {
                $row['base'] = max(0, (int) $override['base']);
            }
            if (array_key_exists('daily_cap', $override)) {
                $cap = $override['daily_cap'];
                $row['daily_cap'] = $cap === null || $cap === '' ? null : max(0, (int) $cap);
            }

            if ($row !== []) {
                $normalized[$actionKey] = $row;
            }
        }

        return $normalized;
    }

    private static function normalizeMinutes(mixed $value, int $default): int
    {
        if ($value === null || $value === '') {
            return $default;
        }

        return max(0, min(240, (int) $value));
    }
}
