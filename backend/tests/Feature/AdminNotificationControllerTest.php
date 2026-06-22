<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminNotificationControllerTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('a', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_send_requires_admin(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $target = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->postJson('/api/admin/notifications/send', [
                'user_ids' => [$target->id],
                'title' => 'Hello',
            ])
            ->assertForbidden();
    }

    public function test_admin_can_send_in_app_notification_to_selected_users(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $target = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($admin);

        $this->withToken($token)
            ->postJson('/api/admin/notifications/send', [
                'user_ids' => [$target->id],
                'title' => 'Team update',
                'message' => 'Please review the new policy.',
                'send_in_app' => true,
                'send_web_push' => false,
            ])
            ->assertOk()
            ->assertJsonPath('sent', 1);

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $target->id,
            'title' => 'Team update',
            'category' => 'announcement',
        ]);

        $notification = Notification::query()->where('user_id', (string) $target->id)->first();
        $this->assertSame('admin_manual', $notification->data['kind'] ?? null);
        $this->assertSame($admin->id, $notification->data['sent_by_user_id'] ?? null);
    }

    public function test_send_requires_at_least_one_delivery_channel(): void
    {
        $admin = User::factory()->create(['is_approved' => true, 'role' => 'admin']);
        $target = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($admin);

        $this->withToken($token)
            ->postJson('/api/admin/notifications/send', [
                'user_ids' => [$target->id],
                'title' => 'Hello',
                'send_in_app' => false,
                'send_web_push' => false,
            ])
            ->assertStatus(422);
    }
}
