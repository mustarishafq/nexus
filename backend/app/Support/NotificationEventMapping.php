<?php

namespace App\Support;

class NotificationEventMapping
{
    public const DEFAULT_FIELD_MAPPINGS = [
        'title' => ['title', 'subject'],
        'message' => ['message', 'body'],
        'user_id' => ['user_id'],
        'action_url' => ['action_url', 'url', 'link'],
        'event_name' => ['event'],
        'severity' => ['severity', 'level'],
        'data' => ['data'],
    ];

    public const DEFAULT_CATEGORY_PREFIX_RULES = [
        ['prefix' => 'booking.', 'category' => 'booking'],
        ['prefix' => 'order.', 'category' => 'booking'],
        ['prefix' => 'hr.', 'category' => 'hr'],
        ['prefix' => 'inventory.', 'category' => 'inventory'],
        ['prefix' => 'finance.', 'category' => 'finance'],
        ['prefix' => 'security.', 'category' => 'security'],
        ['prefix' => 'approval.', 'category' => 'approval'],
        ['prefix' => 'task.', 'category' => 'task'],
    ];

    public static function defaults(): array
    {
        return [
            'auto_notify' => false,
            'webhook_secret' => null,
            'field_mappings' => self::DEFAULT_FIELD_MAPPINGS,
            'category_prefix_rules' => self::DEFAULT_CATEGORY_PREFIX_RULES,
            'defaults' => [
                'type' => 'info',
                'priority' => 'medium',
                'category' => 'other',
                'delivery_channels' => ['in_app'],
            ],
        ];
    }

    public static function normalize(?array $config): array
    {
        $defaults = self::defaults();

        if (! is_array($config)) {
            return $defaults;
        }

        return [
            'auto_notify' => (bool) ($config['auto_notify'] ?? $defaults['auto_notify']),
            'webhook_secret' => filled($config['webhook_secret'] ?? null)
                ? (string) $config['webhook_secret']
                : null,
            'field_mappings' => self::normalizeFieldMappings($config['field_mappings'] ?? null),
            'category_prefix_rules' => self::normalizeCategoryRules($config['category_prefix_rules'] ?? null),
            'defaults' => array_merge(
                $defaults['defaults'],
                array_filter((array) ($config['defaults'] ?? []), static fn ($value) => $value !== null)
            ),
        ];
    }

    /**
     * @return array<string, array<int, string>>
     */
    private static function normalizeFieldMappings(?array $mappings): array
    {
        if (! is_array($mappings)) {
            return self::DEFAULT_FIELD_MAPPINGS;
        }

        $normalized = self::DEFAULT_FIELD_MAPPINGS;

        foreach ($mappings as $target => $sources) {
            if (! is_string($target) || $target === '') {
                continue;
            }

            if (is_string($sources)) {
                $normalized[$target] = [$sources];

                continue;
            }

            if (is_array($sources)) {
                $normalized[$target] = array_values(array_filter(
                    $sources,
                    static fn ($source) => is_string($source) && $source !== ''
                ));

                if ($normalized[$target] === [] && isset(self::DEFAULT_FIELD_MAPPINGS[$target])) {
                    $normalized[$target] = self::DEFAULT_FIELD_MAPPINGS[$target];
                }
            }
        }

        return $normalized;
    }

    /**
     * @return array<int, array{prefix: string, category: string}>
     */
    private static function normalizeCategoryRules(?array $rules): array
    {
        if (! is_array($rules) || $rules === []) {
            return self::DEFAULT_CATEGORY_PREFIX_RULES;
        }

        $normalized = [];

        foreach ($rules as $rule) {
            if (! is_array($rule)) {
                continue;
            }

            $prefix = $rule['prefix'] ?? null;
            $category = $rule['category'] ?? null;

            if (! is_string($prefix) || ! is_string($category) || $prefix === '' || $category === '') {
                continue;
            }

            $normalized[] = [
                'prefix' => $prefix,
                'category' => $category,
            ];
        }

        return $normalized !== [] ? $normalized : self::DEFAULT_CATEGORY_PREFIX_RULES;
    }
}
