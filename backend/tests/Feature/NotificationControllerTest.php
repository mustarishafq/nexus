<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
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
}
