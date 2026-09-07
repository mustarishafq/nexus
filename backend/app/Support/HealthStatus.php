<?php

namespace App\Support;

class HealthStatus
{
    public const NONE = 'none';

    public const OTHERS = 'others';

    /**
     * @var array<string, string>
     */
    public const CONDITIONS = [
        'none' => 'None',
        'high_blood_pressure' => 'High blood pressure',
        'cholesterol' => 'Cholesterol',
        'kidney' => 'Kidney',
        'migraine' => 'Migraine',
        'gout' => 'Gout',
        'gerd' => 'GERD',
        'gastric' => 'Gastric',
        'others' => 'Others',
    ];

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_keys(self::CONDITIONS);
    }

    /**
     * @return array{conditions: list<string>, others: string}
     */
    public static function empty(): array
    {
        return [
            'conditions' => [],
            'others' => '',
        ];
    }

    /**
     * @return array{conditions: list<string>, others: string|null}|null
     */
    public static function normalize(mixed $value): ?array
    {
        if (! is_array($value)) {
            return null;
        }

        $allowed = self::keys();
        $conditions = collect($value['conditions'] ?? [])
            ->map(fn ($item) => trim((string) $item))
            ->filter(fn (string $item) => in_array($item, $allowed, true))
            ->unique()
            ->values();

        $others = trim((string) ($value['others'] ?? ''));

        if ($conditions->contains(self::NONE)) {
            $conditions = collect([self::NONE]);
            $others = '';
        }

        if (! $conditions->contains(self::OTHERS)) {
            $others = '';
        }

        if ($conditions->isEmpty() && $others === '') {
            return null;
        }

        return [
            'conditions' => $conditions->all(),
            'others' => $others !== '' ? $others : null,
        ];
    }

    public static function isComplete(mixed $value): bool
    {
        $normalized = self::normalize($value);
        if ($normalized === null || $normalized['conditions'] === []) {
            return false;
        }

        if (in_array(self::OTHERS, $normalized['conditions'], true) && ! filled($normalized['others'])) {
            return false;
        }

        return true;
    }

    public static function validationError(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_array($value)) {
            return 'Health status must be an object.';
        }

        $conditions = $value['conditions'] ?? [];
        if (! is_array($conditions)) {
            return 'Select a health status option.';
        }

        foreach ($conditions as $condition) {
            if (! is_string($condition) || ! array_key_exists($condition, self::CONDITIONS)) {
                return 'Invalid health status option.';
            }
        }

        $unique = array_values(array_unique($conditions));
        if (in_array(self::NONE, $unique, true) && count($unique) > 1) {
            return 'None cannot be combined with other health conditions.';
        }

        $others = trim((string) ($value['others'] ?? ''));
        if (in_array(self::OTHERS, $unique, true) && $others === '') {
            return 'Please describe the other health condition.';
        }

        return null;
    }

    /**
     * @return list<string>
     */
    public static function labels(mixed $value): array
    {
        $normalized = self::normalize($value);
        if ($normalized === null) {
            return [];
        }

        $labels = [];
        foreach ($normalized['conditions'] as $key) {
            if ($key === self::OTHERS) {
                $labels[] = filled($normalized['others']) ? (string) $normalized['others'] : 'Others';

                continue;
            }

            $labels[] = self::CONDITIONS[$key];
        }

        return $labels;
    }
}
