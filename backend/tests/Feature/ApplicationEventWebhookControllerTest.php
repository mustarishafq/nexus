<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Notification;
use App\Models\SystemEvent;
use App\Support\NotificationEventMapping;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApplicationEventWebhookControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_webhook_skips_notification_when_auto_notify_disabled(): void
    {
        $application = Application::factory()->create([
            'notification_config' => NotificationEventMapping::normalize([
                'auto_notify' => false,
                'webhook_secret' => 'test-secret',
            ]),
        ]);

        $this->postJson("/api/applications/{$application->id}/event-webhook", [
            'title' => 'Order placed',
            'message' => 'A new order was created.',
        ], ['X-Webhook-Secret' => 'test-secret'])
            ->assertAccepted()
            ->assertJson([
                'ok' => true,
                'notification' => null,
            ]);

        $this->assertSame(0, Notification::query()->count());
        $this->assertSame(1, SystemEvent::query()->count());
        $this->assertDatabaseHas('system_events', [
            'system_id' => $application->slug,
            'status' => 'acknowledged',
            'title' => 'Order placed',
        ]);
    }

    public function test_webhook_creates_notification_when_auto_notify_enabled(): void
    {
        $application = Application::factory()->create([
            'notification_config' => NotificationEventMapping::normalize([
                'auto_notify' => true,
                'webhook_secret' => 'test-secret',
            ]),
        ]);

        $this->postJson("/api/applications/{$application->id}/event-webhook", [
            'title' => 'Order placed',
            'message' => 'A new order was created.',
        ], ['X-Webhook-Secret' => 'test-secret'])
            ->assertCreated()
            ->assertJsonPath('notification.title', 'Order placed');

        $this->assertSame(1, Notification::query()->count());
        $this->assertDatabaseHas('system_events', [
            'system_id' => $application->slug,
            'status' => 'processed',
        ]);
    }
}
