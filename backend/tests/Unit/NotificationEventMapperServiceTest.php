<?php

namespace Tests\Unit;

use App\Models\Application;
use App\Services\NotificationEventMapperService;
use App\Support\NotificationEventMapping;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class NotificationEventMapperServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_maps_external_event_to_notification_payload(): void
    {
        $application = Application::factory()->create([
            'slug' => 'reservation-system',
            'notification_config' => NotificationEventMapping::defaults(),
        ]);

        $payload = app(NotificationEventMapperService::class)->map($application, [
            'event' => 'order.created',
            'title' => 'New order #1234',
            'message' => 'John Doe placed an order for RM 250.00',
            'user_id' => '42',
            'action_url' => 'https://example.com/orders/1234',
            'severity' => 'info',
            'data' => ['order_id' => 1234],
        ]);

        $this->assertSame('New order #1234', $payload['title']);
        $this->assertSame('John Doe placed an order for RM 250.00', $payload['message']);
        $this->assertSame('info', $payload['type']);
        $this->assertSame('medium', $payload['priority']);
        $this->assertSame('booking', $payload['category']);
        $this->assertSame('reservation-system', $payload['system_id']);
        $this->assertSame('42', $payload['user_id']);
        $this->assertSame('https://example.com/orders/1234', $payload['action_url']);
        $this->assertSame(['order_id' => 1234], $payload['data']);
    }

    public function test_uses_custom_field_mappings_from_notification_config(): void
    {
        $application = Application::factory()->create([
            'slug' => 'crm',
            'notification_config' => NotificationEventMapping::normalize([
                'field_mappings' => [
                    'title' => ['subject_line'],
                    'message' => ['details'],
                    'event_name' => ['type'],
                    'severity' => ['priority_level'],
                ],
            ]),
        ]);

        $payload = app(NotificationEventMapperService::class)->map($application, [
            'type' => 'hr.leave.approved',
            'subject_line' => 'Leave approved',
            'details' => 'Your leave request was approved.',
            'priority_level' => 'success',
        ]);

        $this->assertSame('Leave approved', $payload['title']);
        $this->assertSame('Your leave request was approved.', $payload['message']);
        $this->assertSame('success', $payload['type']);
        $this->assertSame('hr', $payload['category']);
    }

    public function test_requires_title_after_mapping(): void
    {
        $application = Application::factory()->create([
            'slug' => 'missing-title',
            'notification_config' => NotificationEventMapping::defaults(),
        ]);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Event is missing title');

        app(NotificationEventMapperService::class)->map($application, [
            'event' => 'system.health',
            'message' => 'No title provided',
        ]);
    }

    public function test_falls_back_to_default_title_paths_when_mapping_is_empty(): void
    {
        $application = Application::factory()->create([
            'slug' => 'fallback-title',
            'notification_config' => NotificationEventMapping::normalize([
                'field_mappings' => [
                    'title' => [],
                ],
            ]),
        ]);

        $payload = app(NotificationEventMapperService::class)->map($application, [
            'title' => 'Recovered title',
            'event' => 'system.health',
        ]);

        $this->assertSame('Recovered title', $payload['title']);
    }

    public function test_storage_normalization_preserves_custom_mappings_without_default_merge(): void
    {
        $stored = NotificationEventMapping::normalizeForStorage([
            'auto_notify' => true,
            'webhook_secret' => 'secret123',
            'field_mappings' => [
                'title' => ['data.title'],
                'message' => ['data.message'],
                'severity' => [],
                'action_url' => [],
            ],
        ]);

        $this->assertSame(['data.title'], $stored['field_mappings']['title']);
        $this->assertSame(['data.message'], $stored['field_mappings']['message']);
        $this->assertSame([], $stored['field_mappings']['severity']);
        $this->assertSame([], $stored['field_mappings']['action_url']);
        $this->assertArrayNotHasKey('user_id', $stored['field_mappings']);
    }
}
