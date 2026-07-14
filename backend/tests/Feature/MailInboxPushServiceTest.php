<?php

namespace Tests\Feature;

use App\Jobs\CheckMailInboxForUserJob;
use App\Models\User;
use App\Models\UserMailCredential;
use App\Models\UserMailWatchState;
use App\Services\MailInboxPushService;
use App\Services\MailMailboxService;
use App\Services\PushNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

class MailInboxPushServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_first_scan_initializes_without_sending_push(): void
    {
        config([
            'services.web_push.public_key' => 'test-public',
            'services.web_push.private_key' => 'test-private',
            'services.web_push.subject' => 'mailto:test@example.com',
        ]);

        DB::table('app_settings')->insert([
            'system_name' => 'Nexus',
            'smtp_host' => 'mail.example.com',
            'imap_host' => 'mail.example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'notification_settings' => ['mail_inbox' => true],
        ]);

        UserMailCredential::query()->create([
            'user_id' => $user->id,
            'email' => $user->email,
            'is_primary' => true,
            'password' => Crypt::encryptString('secret'),
            'verified_at' => now(),
        ]);

        DB::table('push_subscriptions')->insert([
            'user_id' => (string) $user->id,
            'endpoint' => 'https://push.example.test/subscription/1',
            'public_key' => str_repeat('a', 87),
            'auth_token' => str_repeat('b', 22),
            'content_encoding' => 'aes128gcm',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $mailMock = Mockery::mock(MailMailboxService::class);
        $mailMock->shouldReceive('isServerConfigured')->andReturn(true);
        $mailMock->shouldReceive('listInbox')
            ->once()
            ->with(
                Mockery::on(fn (User $checkedUser) => $checkedUser->is($user)),
                25,
                null,
                false,
                false,
            )
            ->andReturn([
                'messages' => [
                    [
                        'uid' => 101,
                        'subject' => 'Hello',
                        'from' => 'sender@example.com',
                        'seen' => false,
                    ],
                ],
                'unread_count' => 1,
            ]);

        $pushMock = Mockery::mock(PushNotificationService::class);
        $pushMock->shouldReceive('isEnabled')->andReturn(true);
        $pushMock->shouldNotReceive('sendToUser');

        $service = new MailInboxPushService($mailMock, $pushMock);
        $summary = $service->checkAll();

        $this->assertSame(1, $summary['checked']);
        $this->assertSame(0, $summary['notified']);

        $state = UserMailWatchState::query()->where('user_id', $user->id)->first();
        $this->assertNotNull($state);
        $this->assertNotNull($state->initialized_at);
        $this->assertSame(['101'], $state->seen_uids);
    }

    public function test_new_unread_messages_trigger_web_push(): void
    {
        config([
            'services.web_push.public_key' => 'test-public',
            'services.web_push.private_key' => 'test-private',
            'services.web_push.subject' => 'mailto:test@example.com',
        ]);

        DB::table('app_settings')->insert([
            'system_name' => 'Nexus',
            'smtp_host' => 'mail.example.com',
            'imap_host' => 'mail.example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'notification_settings' => ['mail_inbox' => true],
        ]);

        UserMailCredential::query()->create([
            'user_id' => $user->id,
            'email' => $user->email,
            'is_primary' => true,
            'password' => Crypt::encryptString('secret'),
            'verified_at' => now(),
        ]);

        DB::table('push_subscriptions')->insert([
            'user_id' => (string) $user->id,
            'endpoint' => 'https://push.example.test/subscription/1',
            'public_key' => str_repeat('a', 87),
            'auth_token' => str_repeat('b', 22),
            'content_encoding' => 'aes128gcm',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        UserMailWatchState::query()->create([
            'user_id' => $user->id,
            'seen_uids' => ['100'],
            'initialized_at' => now()->subMinute(),
        ]);

        $mailMock = Mockery::mock(MailMailboxService::class);
        $mailMock->shouldReceive('isServerConfigured')->andReturn(true);
        $mailMock->shouldReceive('listInbox')
            ->once()
            ->andReturn([
                'messages' => [
                    [
                        'uid' => 102,
                        'subject' => 'New subject',
                        'from' => 'boss@example.com',
                        'seen' => false,
                        'date' => 'Mon, 1 Jan 2026 10:00:00 +0000',
                    ],
                    [
                        'uid' => 100,
                        'subject' => 'Old subject',
                        'from' => 'old@example.com',
                        'seen' => true,
                    ],
                ],
                'unread_count' => 1,
            ]);

        $pushMock = Mockery::mock(PushNotificationService::class);
        $pushMock->shouldReceive('isEnabled')->andReturn(true);
        $pushMock->shouldReceive('sendToUser')
            ->once()
            ->with(
                $user->id,
                Mockery::on(function (array $payload) {
                    return $payload['id'] === 'mail-102'
                        && $payload['title'] === 'boss@example.com'
                        && $payload['message'] === 'New subject'
                        && $payload['action_url'] === '/email/102';
                }),
                'mail-'.$user->id.'-102',
            );

        $service = new MailInboxPushService($mailMock, $pushMock);
        $summary = $service->checkAll();

        $this->assertSame(1, $summary['checked']);
        $this->assertSame(1, $summary['notified']);
    }

    public function test_users_with_mail_inbox_disabled_are_skipped(): void
    {
        config([
            'services.web_push.public_key' => 'test-public',
            'services.web_push.private_key' => 'test-private',
            'services.web_push.subject' => 'mailto:test@example.com',
        ]);

        DB::table('app_settings')->insert([
            'system_name' => 'Nexus',
            'smtp_host' => 'mail.example.com',
            'imap_host' => 'mail.example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user = User::factory()->create([
            'is_approved' => true,
            'notification_settings' => ['mail_inbox' => false],
        ]);

        UserMailCredential::query()->create([
            'user_id' => $user->id,
            'email' => $user->email,
            'is_primary' => true,
            'password' => Crypt::encryptString('secret'),
            'verified_at' => now(),
        ]);

        DB::table('push_subscriptions')->insert([
            'user_id' => (string) $user->id,
            'endpoint' => 'https://push.example.test/subscription/1',
            'public_key' => str_repeat('a', 87),
            'auth_token' => str_repeat('b', 22),
            'content_encoding' => 'aes128gcm',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $mailMock = Mockery::mock(MailMailboxService::class);
        $mailMock->shouldReceive('isServerConfigured')->andReturn(true);
        $mailMock->shouldNotReceive('listInbox');

        $pushMock = Mockery::mock(PushNotificationService::class);
        $pushMock->shouldReceive('isEnabled')->andReturn(true);
        $pushMock->shouldNotReceive('sendToUser');

        $service = new MailInboxPushService($mailMock, $pushMock);
        $summary = $service->checkAll();

        $this->assertSame(0, $summary['checked']);
        $this->assertSame(1, $summary['skipped']);
    }

    public function test_dispatch_checks_queues_staggered_jobs(): void
    {
        Queue::fake();

        config([
            'services.web_push.public_key' => 'test-public',
            'services.web_push.private_key' => 'test-private',
            'services.web_push.subject' => 'mailto:test@example.com',
        ]);

        DB::table('app_settings')->insert([
            'system_name' => 'Nexus',
            'smtp_host' => 'mail.example.com',
            'imap_host' => 'mail.example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $users = User::factory()->count(3)->create([
            'is_approved' => true,
            'notification_settings' => ['mail_inbox' => true],
        ]);

        foreach ($users as $user) {
            UserMailCredential::query()->create([
                'user_id' => $user->id,
                'email' => $user->email,
                'is_primary' => true,
                'password' => Crypt::encryptString('secret'),
                'verified_at' => now(),
            ]);

            DB::table('push_subscriptions')->insert([
                'user_id' => (string) $user->id,
                'endpoint' => 'https://push.example.test/subscription/'.$user->id,
                'public_key' => str_repeat('a', 87),
                'auth_token' => str_repeat('b', 22),
                'content_encoding' => 'aes128gcm',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $mailMock = Mockery::mock(MailMailboxService::class);
        $mailMock->shouldReceive('isServerConfigured')->andReturn(true);

        $pushMock = Mockery::mock(PushNotificationService::class);
        $pushMock->shouldReceive('isEnabled')->andReturn(true);

        $service = new MailInboxPushService($mailMock, $pushMock);
        $summary = $service->dispatchChecks();

        $this->assertSame(3, $summary['dispatched']);
        $this->assertSame(0, $summary['skipped']);

        Queue::assertPushed(CheckMailInboxForUserJob::class, 3);
        Queue::assertPushed(CheckMailInboxForUserJob::class, function (CheckMailInboxForUserJob $job) use ($users) {
            return in_array($job->userId, $users->pluck('id')->all(), true);
        });
    }
}
