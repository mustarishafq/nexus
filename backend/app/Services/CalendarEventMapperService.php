<?php

namespace App\Services;

use App\Models\Application;
use App\Support\CalendarEventMapping;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

class CalendarEventMapperService
{
    public function map(Application $application, array $event, ?array $configOverride = null): array
    {
        $config = CalendarEventMapping::normalize(
            $configOverride ?? $application->calendar_config
        );
        $fieldMappings = $config['field_mappings'];
        $defaults = $config['defaults'];

        $title = $this->resolveField(
            $event,
            $this->pathsFor($fieldMappings, 'title', ['title', 'subject', 'summary'])
        );
        $action = $this->resolveAction(
            $event,
            $this->pathsFor($fieldMappings, 'action', ['action', 'event', 'event_type']),
            $config['action_rules']
        );
        $externalEventId = $this->resolveField(
            $event,
            $this->pathsFor($fieldMappings, 'external_event_id', ['external_event_id', 'id', 'event_id'])
        );

        if ($action !== 'cancelled') {
            if (! filled($title)) {
                throw new InvalidArgumentException('Event is missing title');
            }

            $startAt = $this->resolveField(
                $event,
                $this->pathsFor($fieldMappings, 'start_at', ['start_at', 'starts_at', 'start'])
            );
            $endAt = $this->resolveField(
                $event,
                $this->pathsFor($fieldMappings, 'end_at', ['end_at', 'ends_at', 'end'])
            );

            if (! filled($startAt) || ! filled($endAt)) {
                throw new InvalidArgumentException('Event is missing start_at or end_at');
            }
        }

        if (! filled($externalEventId)) {
            throw new InvalidArgumentException('Event is missing external_event_id');
        }

        $payload = [
            'title' => filled($title) ? mb_substr((string) $title, 0, 255) : null,
            'description' => $this->nullableString($this->resolveField(
                $event,
                $this->pathsFor($fieldMappings, 'description', ['description', 'body', 'details'])
            )),
            'location' => $this->nullableString($this->resolveField(
                $event,
                $this->pathsFor($fieldMappings, 'location', ['location', 'venue'])
            )),
            'start_at' => isset($startAt) && filled($startAt) ? $this->parseDateTime($startAt) : null,
            'end_at' => isset($endAt) && filled($endAt) ? $this->parseDateTime($endAt) : null,
            'is_all_day' => $this->resolveBoolean(
                $this->resolveField(
                    $event,
                    $this->pathsFor($fieldMappings, 'is_all_day', ['is_all_day', 'all_day'])
                ),
                (bool) ($defaults['is_all_day'] ?? false)
            ),
            'attendee_emails' => $this->resolveEmailList($this->resolveField(
                $event,
                $this->pathsFor($fieldMappings, 'attendee_emails', ['attendee_emails', 'attendees', 'invitees'])
            )),
            'action' => $action,
            'external_event_id' => mb_substr((string) $externalEventId, 0, 255),
            'created_by' => $this->nullableString($this->resolveField(
                $event,
                $this->pathsFor($fieldMappings, 'created_by', ['created_by', 'organizer_email', 'organizer'])
            )),
            'source_system_id' => $application->slug,
        ];

        if ($payload['action'] !== 'cancelled' && $payload['start_at'] && $payload['end_at']) {
            if ($payload['end_at']->lt($payload['start_at'])) {
                throw new InvalidArgumentException('end_at must be after or equal to start_at');
            }
        }

        return array_filter(
            $payload,
            static fn ($value) => $value !== null && $value !== '' && $value !== []
        );
    }

    public function shouldAutoSync(Application $application): bool
    {
        $config = CalendarEventMapping::normalize($application->calendar_config);

        return (bool) $config['auto_sync'];
    }

    /**
     * @param  array<string, array<int, string>>  $fieldMappings
     * @param  array<int, string>  $fallback
     * @return array<int, string>
     */
    private function pathsFor(array $fieldMappings, string $field, array $fallback): array
    {
        $paths = $fieldMappings[$field] ?? $fallback;

        return $paths === [] ? $fallback : $paths;
    }

    /**
     * @param  array<int, string>  $paths
     */
    private function resolveField(array $event, array $paths): mixed
    {
        foreach ($paths as $path) {
            $value = $this->valueAtPath($event, $path);

            if ($value !== null && $value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function valueAtPath(array $event, string $path): mixed
    {
        if ($path === '') {
            return null;
        }

        if (! str_contains($path, '.')) {
            return array_key_exists($path, $event) ? $event[$path] : null;
        }

        $current = $event;

        foreach (explode('.', $path) as $segment) {
            if (! is_array($current) || ! array_key_exists($segment, $current)) {
                return null;
            }

            $current = $current[$segment];
        }

        return $current;
    }

    /**
     * @param  array<int, array{prefix: string, action: string}>  $rules
     */
    private function resolveAction(array $event, array $paths, array $rules): string
    {
        foreach ($paths as $path) {
            $value = $this->valueAtPath($event, $path);

            if ($value === null || $value === '') {
                continue;
            }

            $actionName = strtolower((string) $value);

            foreach ($rules as $rule) {
                $prefix = strtolower($rule['prefix']);
                $barePrefix = rtrim($prefix, '.');

                if (
                    str_starts_with($actionName, $prefix)
                    || ($barePrefix !== '' && $actionName === $barePrefix)
                ) {
                    return $rule['action'];
                }
            }

            if (in_array($actionName, ['created', 'updated', 'rescheduled', 'cancelled'], true)) {
                return $actionName;
            }
        }

        return 'created';
    }

    private function parseDateTime(mixed $value): Carbon
    {
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            throw new InvalidArgumentException('Invalid date/time value in event payload');
        }
    }

    private function resolveBoolean(mixed $value, bool $fallback): bool
    {
        if ($value === null || $value === '') {
            return $fallback;
        }

        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * @return array<int, string>|null
     */
    private function resolveEmailList(mixed $value): ?array
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_string($value)) {
            $value = preg_split('/[\s,;]+/', $value) ?: [];
        }

        if (! is_array($value)) {
            return null;
        }

        $emails = collect($value)
            ->map(function ($item) {
                if (is_string($item)) {
                    return strtolower(trim($item));
                }

                if (is_array($item)) {
                    foreach (['email', 'address', 'value'] as $key) {
                        if (isset($item[$key]) && is_string($item[$key])) {
                            return strtolower(trim($item[$key]));
                        }
                    }
                }

                return null;
            })
            ->filter()
            ->unique()
            ->values()
            ->all();

        return $emails === [] ? null : $emails;
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (string) $value;
    }
}
