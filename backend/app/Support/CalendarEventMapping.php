<?php

namespace App\Support;

class CalendarEventMapping
{
    public const DEFAULT_FIELD_MAPPINGS = [
        'title' => ['title', 'subject', 'summary'],
        'description' => ['description', 'body', 'details'],
        'location' => ['location', 'venue'],
        'start_at' => ['start_at', 'starts_at', 'start'],
        'end_at' => ['end_at', 'ends_at', 'end'],
        'is_all_day' => ['is_all_day', 'all_day'],
        'attendee_emails' => ['attendee_emails', 'attendees', 'invitees'],
        'action' => ['action', 'event', 'event_type'],
        'external_event_id' => ['external_event_id', 'id', 'event_id'],
        'created_by' => ['created_by', 'organizer_email', 'organizer'],
    ];

    public const DEFAULT_ACTION_RULES = [
        ['prefix' => 'calendar.cancelled', 'action' => 'cancelled'],
        ['prefix' => 'calendar.rescheduled', 'action' => 'rescheduled'],
        ['prefix' => 'calendar.created', 'action' => 'created'],
        ['prefix' => 'calendar.updated', 'action' => 'updated'],
        ['prefix' => 'event.cancelled', 'action' => 'cancelled'],
        ['prefix' => 'event.deleted', 'action' => 'cancelled'],
        ['prefix' => 'event.rescheduled', 'action' => 'rescheduled'],
        ['prefix' => 'event.created', 'action' => 'created'],
        ['prefix' => 'event.updated', 'action' => 'updated'],
        ['prefix' => 'meeting.cancelled', 'action' => 'cancelled'],
        ['prefix' => 'meeting.rescheduled', 'action' => 'rescheduled'],
        ['prefix' => 'meeting.created', 'action' => 'created'],
        ['prefix' => 'meeting.updated', 'action' => 'updated'],
        ['prefix' => 'cancelled', 'action' => 'cancelled'],
        ['prefix' => 'rescheduled', 'action' => 'rescheduled'],
        ['prefix' => 'created', 'action' => 'created'],
        ['prefix' => 'updated', 'action' => 'updated'],
    ];

    public static function defaults(): array
    {
        return [
            'auto_sync' => false,
            'webhook_secret' => null,
            'field_mappings' => self::DEFAULT_FIELD_MAPPINGS,
            'action_rules' => self::DEFAULT_ACTION_RULES,
            'defaults' => [
                'is_all_day' => false,
            ],
        ];
    }

    public static function normalize(?array $config): array
    {
        return self::normalizeConfig($config, mergeFieldDefaults: true);
    }

    public static function normalizeForStorage(?array $config): array
    {
        return self::normalizeConfig($config, mergeFieldDefaults: false);
    }

    private static function normalizeConfig(?array $config, bool $mergeFieldDefaults): array
    {
        $defaults = self::defaults();

        if (! is_array($config)) {
            return $defaults;
        }

        $fieldMappings = self::sanitizeFieldMappings($config['field_mappings'] ?? null);

        if ($mergeFieldDefaults) {
            $fieldMappings = array_merge(self::DEFAULT_FIELD_MAPPINGS, $fieldMappings);
        }

        return [
            'auto_sync' => (bool) ($config['auto_sync'] ?? $defaults['auto_sync']),
            'webhook_secret' => filled($config['webhook_secret'] ?? null)
                ? (string) $config['webhook_secret']
                : null,
            'field_mappings' => $fieldMappings,
            'action_rules' => self::normalizeActionRules($config['action_rules'] ?? null),
            'defaults' => array_merge(
                $defaults['defaults'],
                array_filter((array) ($config['defaults'] ?? []), static fn ($value) => $value !== null)
            ),
        ];
    }

    /**
     * @return array<string, array<int, string>>
     */
    private static function sanitizeFieldMappings(?array $mappings): array
    {
        if (! is_array($mappings)) {
            return [];
        }

        $normalized = [];

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
            }
        }

        return $normalized;
    }

    /**
     * @return array<int, array{prefix: string, action: string}>
     */
    private static function normalizeActionRules(?array $rules): array
    {
        if (! is_array($rules) || $rules === []) {
            return self::DEFAULT_ACTION_RULES;
        }

        $normalized = [];

        foreach ($rules as $rule) {
            if (! is_array($rule)) {
                continue;
            }

            $prefix = $rule['prefix'] ?? null;
            $action = $rule['action'] ?? null;

            if (! is_string($prefix) || ! is_string($action) || $prefix === '' || $action === '') {
                continue;
            }

            $normalized[] = [
                'prefix' => strtolower($prefix),
                'action' => strtolower($action),
            ];
        }

        return $normalized !== [] ? $normalized : self::DEFAULT_ACTION_RULES;
    }
}
