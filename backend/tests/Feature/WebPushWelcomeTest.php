<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WebPushWelcomeTest extends TestCase
{
    use RefreshDatabase;

    private function issueToken(User $user): string
    {
        $token = str_repeat('w', 80);
        $user->forceFill(['remember_token' => hash('sha256', $token)])->save();

        return $token;
    }

    public function test_new_push_subscription_sends_welcome_notification(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($user);

        $this->withToken($token)
            ->postJson('/api/push-subscriptions', [
                'endpoint' => 'https://push.example.test/subscription/1',
                'keys' => [
                    'p256dh' => str_repeat('a', 87),
                    'auth' => str_repeat('b', 22),
                ],
                'contentEncoding' => 'aes128gcm',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => (string) $user->id,
            'title' => 'Welcome to web push',
        ]);

        $notification = Notification::query()->where('user_id', (string) $user->id)->first();
        $this->assertSame('web_push_welcome', $notification->data['kind'] ?? null);
    }

    public function test_existing_push_subscription_does_not_resend_welcome(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'role' => 'user']);
        $token = $this->issueToken($user);
        $payload = [
            'endpoint' => 'https://push.example.test/subscription/1',
            'keys' => [
                'p256dh' => str_repeat('a', 87),
                'auth' => str_repeat('b', 22),
            ],
            'contentEncoding' => 'aes128gcm',
        ];

        $this->withToken($token)->postJson('/api/push-subscriptions', $payload)->assertCreated();
        $this->withToken($token)->postJson('/api/push-subscriptions', $payload)->assertCreated();

        $this->assertSame(1, Notification::query()->where('user_id', (string) $user->id)->count());
    }
}
