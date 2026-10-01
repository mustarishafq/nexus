<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use App\Models\UserTodo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationControllerTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('n', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/notifications')
            ->assertUnauthorized();
    }

    public function test_user_only_sees_their_own_notifications(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $otherUser = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        $mine = Notification::create([
            'user_id' => (string) $user->id,
            'title' => 'My notification',
            'type' => 'info',
        ]);
        Notification::create([
            'user_id' => (string) $otherUser->id,
            'title' => 'Someone else notification',
            'type' => 'info',
        ]);

        $response = $this->withToken($token)
            ->getJson('/api/notifications?exclude_broadcasts=1')
            ->assertOk();

        $this->assertCount(1, $response->json());
        $this->assertSame($mine->id, $response->json('0.id'));
    }

    public function test_admin_only_sees_their_own_notifications(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $otherUser = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($admin);

        Notification::create([
            'user_id' => (string) $admin->id,
            'title' => 'Admin notification',
            'type' => 'info',
        ]);
        Notification::create([
            'user_id' => (string) $otherUser->id,
            'title' => 'Other user notification',
            'type' => 'info',
        ]);

        $response = $this->withToken($token)
            ->getJson('/api/notifications?exclude_broadcasts=1')
            ->assertOk();

        $this->assertCount(1, $response->json());
        $this->assertSame('Admin notification', $response->json('0.title'));
    }

    public function test_user_can_match_notifications_by_email(): void
    {
        $user = User::factory()->create([
            'is_approved' => true,
            'email' => 'target@example.com',
        ]);
        $token = $this->issueToken($user);

        Notification::create([
            'user_id' => 'target@example.com',
            'title' => 'Email-targeted notification',
            'type' => 'info',
        ]);

        $response = $this->withToken($token)
            ->getJson('/api/notifications?exclude_broadcasts=1')
            ->assertOk();

        $this->assertCount(1, $response->json());
        $this->assertSame('Email-targeted notification', $response->json('0.title'));
    }

    public function test_user_cannot_update_someone_elses_notification(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $otherUser = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        $notification = Notification::create([
            'user_id' => (string) $otherUser->id,
            'title' => 'Private notification',
            'type' => 'info',
        ]);

        $this->withToken($token)
            ->patchJson("/api/notifications/{$notification->id}", ['is_read' => true])
            ->assertForbidden();
    }

    public function test_unread_count_is_not_capped_by_list_page_size(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $otherUser = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        foreach (range(1, 60) as $i) {
            Notification::create(['user_id' => (string) $user->id, 'title' => "Unread {$i}", 'type' => 'info']);
        }
        Notification::create(['user_id' => (string) $user->id, 'title' => 'Read', 'type' => 'info', 'is_read' => true]);
        Notification::create(['user_id' => (string) $user->id, 'title' => 'DM', 'type' => 'info', 'data' => ['kind' => 'direct_message']]);
        Notification::create(['user_id' => (string) $otherUser->id, 'title' => 'Not mine', 'type' => 'info']);
        Notification::create(['title' => 'Broadcast', 'type' => 'info', 'is_broadcast' => true]);

        $this->withToken($token)
            ->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJson(['count' => 60]);
    }

    public function test_mark_all_read_marks_every_unread_notification_and_completes_todos(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $otherUser = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        foreach (range(1, 60) as $i) {
            Notification::create(['user_id' => (string) $user->id, 'title' => "Unread {$i}", 'type' => 'info']);
        }
        $dm = Notification::create(['user_id' => (string) $user->id, 'title' => 'DM', 'type' => 'info', 'data' => ['kind' => 'direct_message']]);
        $notMine = Notification::create(['user_id' => (string) $otherUser->id, 'title' => 'Not mine', 'type' => 'info']);

        $this->withToken($token)
            ->postJson('/api/notifications/mark-all-read')
            ->assertOk()
            ->assertJson(['updated' => 60]);

        $this->assertSame(0, Notification::query()
            ->where('user_id', (string) $user->id)
            ->where('is_read', false)
            ->where('id', '!=', $dm->id)
            ->count());
        $this->assertFalse($dm->fresh()->is_read);
        $this->assertFalse($notMine->fresh()->is_read);
        $this->assertSame(0, UserTodo::query()->where('user_id', $user->id)->whereNull('completed_at')->count());
        $this->assertSame(1, UserTodo::query()->where('user_id', $otherUser->id)->whereNull('completed_at')->count());

        $this->withToken($token)
            ->getJson('/api/notifications/unread-count')
            ->assertJson(['count' => 0]);
    }

    public function test_mark_all_read_requires_authentication(): void
    {
        $this->postJson('/api/notifications/mark-all-read')->assertUnauthorized();
        $this->getJson('/api/notifications/unread-count')->assertUnauthorized();
    }

    public function test_counts_returns_all_unread_and_critical_totals(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $otherUser = User::factory()->create(['is_approved' => true]);
        $token = $this->issueToken($user);

        foreach (range(1, 55) as $i) {
            Notification::create(['user_id' => (string) $user->id, 'title' => "Info {$i}", 'type' => 'info']);
        }
        Notification::create(['user_id' => (string) $user->id, 'title' => 'Error', 'type' => 'error', 'is_read' => true]);
        Notification::create(['user_id' => (string) $user->id, 'title' => 'Critical', 'type' => 'critical']);
        Notification::create(['user_id' => (string) $user->id, 'title' => 'DM', 'type' => 'critical', 'data' => ['kind' => 'direct_message']]);
        Notification::create(['user_id' => (string) $otherUser->id, 'title' => 'Not mine', 'type' => 'critical']);

        $this->withToken($token)
            ->getJson('/api/notifications/counts')
            ->assertOk()
            ->assertExactJson([
                'all' => 57,
                'unread' => 56,
                'critical' => 2,
                'filtered' => ['all' => 57, 'unread' => 56],
            ]);

        $this->withToken($token)
            ->getJson('/api/notifications/counts?type=error')
            ->assertOk()
            ->assertJson(['unread' => 56, 'filtered' => ['all' => 1, 'unread' => 0]]);

        $this->withToken($token)
            ->getJson('/api/notifications/counts?search=Info%205')
            ->assertOk()
            ->assertJson(['filtered' => ['all' => 7, 'unread' => 7]]);

        $titles = collect($this->withToken($token)
            ->getJson('/api/notifications?exclude_broadcasts=1&exclude_direct_messages=1&type[]=error&type[]=critical')
            ->assertOk()
            ->json())->pluck('title')->sort()->values()->all();

        $this->assertSame(['Critical', 'Error'], $titles);
    }
}
