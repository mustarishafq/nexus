<?php

namespace App\Support;

class GamificationSettings
{
    /**
     * @return array{actions: array<string, array{base?: int, daily_cap?: int|null}>}
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

        return [
            'actions' => self::normalizeActionOverrides($raw['actions'] ?? []),
        ];
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
     * @return array{actions: list<array<string, mixed>>}
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

        return ['actions' => $rows];
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
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array{gamification_overrides: string}
     */
    public static function toDatabaseColumns(array $overrides): array
    {
        $normalized = [
            'actions' => self::normalizeActionOverrides($overrides['actions'] ?? []),
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
}
