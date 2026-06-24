<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use App\Models\UserTodo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserTodoTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('t', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_notification_creation_creates_user_todo(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        Notification::create([
            'user_id' => (string) $user->id,
            'type' => 'info',
            'priority' => 'medium',
            'category' => 'task',
            'title' => 'Subtask submitted for review',
            'message' => 'Please review the latest subtask.',
            'action_url' => '/applications',
            'system_id' => 'task-manager',
            'is_read' => false,
            'is_broadcast' => false,
            'delivery_channels' => ['in_app'],
        ]);

        $todo = UserTodo::query()->where('user_id', $user->id)->first();

        $this->assertNotNull($todo);
        $this->assertSame('notification', $todo->source_type);
        $this->assertSame('Subtask submitted for review', $todo->title);
        $this->assertSame('task-manager', $todo->system_id);
        $this->assertNull($todo->completed_at);
    }

    public function test_broadcast_notifications_do_not_create_user_todos(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        Notification::create([
            'user_id' => (string) $user->id,
            'type' => 'info',
            'priority' => 'medium',
            'category' => 'announcement',
            'title' => 'Company update',
            'message' => 'All hands tomorrow.',
            'is_read' => false,
            'is_broadcast' => true,
            'delivery_channels' => ['in_app'],
        ]);

        $this->assertSame(0, UserTodo::query()->count());
    }

    public function test_marking_notification_read_completes_user_todo(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        $notification = Notification::create([
            'user_id' => (string) $user->id,
            'type' => 'info',
            'priority' => 'medium',
            'category' => 'calendar',
            'title' => 'Meeting invitation: Weekly sync',
            'message' => 'You were invited to a meeting.',
            'action_url' => '/calendar',
            'is_read' => false,
            'is_broadcast' => false,
            'delivery_channels' => ['in_app'],
            'data' => [
                'kind' => 'calendar_event_created',
                'calendar_event_id' => 42,
            ],
        ]);

        $todo = UserTodo::query()->where('notification_id', $notification->id)->first();
        $this->assertNotNull($todo);

        $notification->update([
            'is_read' => true,
            'read_at' => now(),
        ]);

        $this->assertNotNull($todo->fresh()->completed_at);
    }

    public function test_action_items_endpoint_returns_pending_todos_for_user(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $other = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        $notification = Notification::create([
            'user_id' => (string) $user->id,
            'type' => 'warning',
            'priority' => 'high',
            'category' => 'approval',
            'title' => 'Credential approval needed',
            'message' => 'Review pending SSO credential.',
            'action_url' => '/admin/users?section=sso-links',
            'is_read' => false,
            'is_broadcast' => false,
            'delivery_channels' => ['in_app'],
        ]);

        Notification::create([
            'user_id' => (string) $other->id,
            'type' => 'info',
            'priority' => 'medium',
            'category' => 'task',
            'title' => 'Someone else task',
            'is_read' => false,
            'is_broadcast' => false,
            'delivery_channels' => ['in_app'],
        ]);

        $notification->update(['is_read' => false]);

        $completedNotification = Notification::create([
            'user_id' => (string) $user->id,
            'type' => 'info',
            'priority' => 'medium',
            'category' => 'task',
            'title' => 'Already done',
            'is_read' => true,
            'read_at' => now(),
            'is_broadcast' => false,
            'delivery_channels' => ['in_app'],
        ]);

        UserTodo::query()
            ->where('notification_id', $completedNotification->id)
            ->update(['completed_at' => now()]);

        $response = $this->withToken($token)
            ->getJson('/api/dashboard/action-items')
            ->assertOk()
            ->json();

        $this->assertCount(1, $response);
        $this->assertSame('Credential approval needed', $response[0]['title']);
        $this->assertSame('approval', $response[0]['category']);
    }

    public function test_complete_action_item_marks_todo_and_notification_done(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        $notification = Notification::create([
            'user_id' => (string) $user->id,
            'type' => 'info',
            'priority' => 'medium',
            'category' => 'task',
            'title' => 'Open task manager',
            'action_url' => '/applications',
            'system_id' => 'task-manager',
            'is_read' => false,
            'is_broadcast' => false,
            'delivery_channels' => ['in_app'],
        ]);

        $todo = UserTodo::query()->where('notification_id', $notification->id)->firstOrFail();

        $this->withToken($token)
            ->patchJson("/api/dashboard/action-items/{$todo->id}/complete")
            ->assertOk()
            ->assertJsonPath('completed_at', fn ($value) => filled($value));

        $this->assertTrue($notification->fresh()->is_read);
        $this->assertNotNull($todo->fresh()->completed_at);
    }

    public function test_snoozed_notification_is_hidden_from_action_items(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        Notification::create([
            'user_id' => (string) $user->id,
            'type' => 'info',
            'priority' => 'medium',
            'category' => 'task',
            'title' => 'Snoozed task',
            'is_read' => false,
            'is_broadcast' => false,
            'snoozed_until' => now()->addHour(),
            'delivery_channels' => ['in_app'],
        ]);

        $this->withToken($token)
            ->getJson('/api/dashboard/action-items')
            ->assertOk()
            ->assertJsonCount(0);
    }
}
