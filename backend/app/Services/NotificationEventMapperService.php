<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Notification;
use App\Support\NotificationEventMapping;
use InvalidArgumentException;

class NotificationEventMapperService
{
    public function map(Application $application, array $event): array
    {
        $config = NotificationEventMapping::normalize($application->notification_config);
        $fieldMappings = $config['field_mappings'];

        $title = $this->resolveField($event, $fieldMappings['title'] ?? ['title', 'subject']);
        if (! filled($title)) {
            throw new InvalidArgumentException('Event is missing title');
        }

        $eventName = strtolower((string) $this->resolveField(
            $event,
            $fieldMappings['event_name'] ?? ['event']
        ));
        $severity = $this->resolveSeverity($event, $fieldMappings['severity'] ?? ['severity', 'level']);

        $message = $this->resolveField($event, $fieldMappings['message'] ?? ['message', 'body']);
        $userId = $this->resolveField($event, $fieldMappings['user_id'] ?? ['user_id']);
        $actionUrl = $this->resolveField($event, $fieldMappings['action_url'] ?? ['action_url', 'url', 'link']);
        $data = $this->resolveData($event, $fieldMappings['data'] ?? ['data'], $eventName);

        $defaults = $config['defaults'];

        $payload = [
            'title' => mb_substr((string) $title, 0, 255),
            'message' => filled($message) ? (string) $message : null,
            'type' => $this->mapType($severity, $eventName, (string) ($defaults['type'] ?? 'info')),
            'priority' => $this->mapPriority($severity, $eventName, (string) ($defaults['priority'] ?? 'medium')),
            'category' => $this->mapCategory($eventName, $config['category_prefix_rules'], (string) ($defaults['category'] ?? 'other')),
            'system_id' => $application->slug,
            'user_id' => filled($userId) ? (string) $userId : null,
            'action_url' => filled($actionUrl) ? (string) $actionUrl : null,
            'data' => $data,
            'delivery_channels' => $defaults['delivery_channels'] ?? ['in_app'],
        ];

        return array_filter(
            $payload,
            static fn ($value) => $value !== null && $value !== '' && $value !== []
        );
    }

    public function createNotification(Application $application, array $event): Notification
    {
        $payload = $this->map($application, $event);
        $notification = Notification::create($payload);

        $shouldSendPush = ! (
            $notification->is_broadcast
            && $notification->broadcast_starts_at
            && $notification->broadcast_starts_at->isFuture()
        );

        if ($shouldSendPush) {
            app(PushNotificationService::class)->sendNotification($notification);
        }

        return $notification;
    }

    public function shouldAutoNotify(Application $application): bool
    {
        $config = NotificationEventMapping::normalize($application->notification_config);

        return (bool) $config['auto_notify'];
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
     * @param  array<int, string>  $paths
     */
    private function resolveSeverity(array $event, array $paths): string
    {
        foreach ($paths as $path) {
            $value = $this->valueAtPath($event, $path);

            if ($value === null || $value === '') {
                continue;
            }

            if (is_numeric($value)) {
                return $this->numericSeverityLabel((int) $value);
            }

            return strtolower((string) $value);
        }

        if (isset($event['severity']) && is_numeric($event['severity'])) {
            return $this->numericSeverityLabel((int) $event['severity']);
        }

        if (isset($event['event_type']) && is_string($event['event_type'])) {
            return strtolower($event['event_type']);
        }

        return 'info';
    }

    private function numericSeverityLabel(int $severity): string
    {
        return match (true) {
            $severity >= 9 => 'critical',
            $severity >= 7 => 'error',
            $severity >= 5 => 'warning',
            $severity >= 3 => 'info',
            default => 'info',
        };
    }

    /**
     * @param  array<int, string>  $paths
     * @return array<string, mixed>
     */
    private function resolveData(array $event, array $paths, string $eventName): array
    {
        foreach ($paths as $path) {
            $value = $this->valueAtPath($event, $path);

            if (is_array($value)) {
                return $value;
            }
        }

        return array_filter([
            'event' => $eventName !== '' ? $eventName : ($event['event'] ?? null),
            'source' => $event['source'] ?? null,
        ], static fn ($value) => $value !== null && $value !== '');
    }

    private function mapType(string $severity, string $eventName, string $fallback): string
    {
        return match (true) {
            in_array($severity, ['critical', 'fatal'], true) => 'critical',
            in_array($severity, ['error', 'danger'], true) => 'error',
            in_array($severity, ['warn', 'warning'], true) => 'warning',
            in_array($severity, ['success', 'ok'], true) => 'success',
            str_contains($eventName, '.failed'), str_contains($eventName, '.error') => 'error',
            str_contains($eventName, '.completed'), str_contains($eventName, '.success') => 'success',
            default => in_array($fallback, ['info', 'success', 'warning', 'error', 'critical'], true)
                ? $fallback
                : 'info',
        };
    }

    private function mapPriority(string $severity, string $eventName, string $fallback): string
    {
        return match (true) {
            in_array($severity, ['critical', 'fatal'], true) => 'critical',
            in_array($severity, ['error', 'danger'], true) => 'high',
            in_array($severity, ['warn', 'warning'], true) => 'medium',
            str_contains($eventName, '.failed'), str_contains($eventName, '.urgent') => 'high',
            default => in_array($fallback, ['low', 'medium', 'high', 'critical'], true)
                ? $fallback
                : 'medium',
        };
    }

    /**
     * @param  array<int, array{prefix: string, category: string}>  $rules
     */
    private function mapCategory(string $eventName, array $rules, string $fallback): string
    {
        foreach ($rules as $rule) {
            $prefix = strtolower($rule['prefix']);

            if ($prefix !== '' && str_starts_with($eventName, $prefix)) {
                return $rule['category'];
            }
        }

        return in_array($fallback, [
            'booking',
            'hr',
            'inventory',
            'finance',
            'security',
            'system',
            'task',
            'approval',
            'announcement',
            'other',
        ], true) ? $fallback : 'system';
    }
}
