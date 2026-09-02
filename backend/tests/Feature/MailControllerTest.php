<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserMailCredential;
use App\Models\UserMailRecipientSuggestion;
use App\Services\MailMailboxService;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;
use Webklex\PHPIMAP\Client;

class MailControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_mail_status_requires_authentication(): void
    {
        $this->getJson('/api/mail/status')
            ->assertUnauthorized();
    }

    public function test_mail_status_reports_unconfigured_server(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->getJson('/api/mail/status')
            ->assertOk()
            ->assertJson([
                'configured' => false,
                'reachable' => false,
                'connected' => false,
                'email' => $user->email,
                'accounts' => [],
            ])
            ->assertJsonStructure([
                'folders' => [
                    ['id', 'label'],
                ],
            ]);
    }

    public function test_mail_status_reports_configured_server(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = ApiTokenAuth::issueToken($user);

        DB::table('app_settings')->insert([
            'system_name' => 'Nexus',
            'smtp_host' => 'mail.example.com',
            'smtp_port' => 587,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withToken($token)
            ->getJson('/api/mail/status')
            ->assertOk()
            ->assertJson([
                'configured' => true,
                'reachable' => true,
                'connected' => false,
            ]);
    }

    public function test_mail_status_stays_configured_when_inbox_push_disabled(): void
    {
        config(['mail.imap.enabled' => false]);

        $user = User::factory()->create(['is_approved' => true]);
        $token = ApiTokenAuth::issueToken($user);

        DB::table('app_settings')->insert([
            'system_name' => 'Nexus',
            'smtp_host' => 'mail.example.com',
            'imap_host' => 'mail.example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withToken($token)
            ->getJson('/api/mail/status')
            ->assertOk()
            ->assertJson([
                'configured' => true,
                'reachable' => true,
            ]);
    }

    public function test_mail_unread_count_requires_authentication(): void
    {
        $this->getJson('/api/mail/unread-count')
            ->assertUnauthorized();
    }

    public function test_mail_unread_count_returns_zero_when_not_connected(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->getJson('/api/mail/unread-count')
            ->assertOk()
            ->assertJson([
                'unread_count' => 0,
                'connected' => false,
            ]);
    }

    public function test_user_can_have_multiple_mail_credentials(): void
    {
        $user = User::factory()->create(['is_approved' => true]);

        DB::table('user_mail_credentials')->insert([
            [
                'user_id' => $user->id,
                'email' => 'primary@example.com',
                'label' => 'Primary',
                'is_primary' => true,
                'password' => 'encrypted-one',
                'verified_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'user_id' => $user->id,
                'email' => 'secondary@example.com',
                'label' => 'Secondary',
                'is_primary' => false,
                'password' => 'encrypted-two',
                'verified_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->assertDatabaseCount('user_mail_credentials', 2);
        $this->assertSame(2, DB::table('user_mail_credentials')->where('user_id', $user->id)->count());
    }

    public function test_recipient_suggestions_require_authentication(): void
    {
        $this->getJson('/api/mail/recipient-suggestions?q=ada')
            ->assertUnauthorized();
    }

    public function test_remember_recipients_and_suggest_from_history(): void
    {
        $user = User::factory()->create(['is_approved' => true, 'email' => 'me@example.com']);
        $token = ApiTokenAuth::issueToken($user);
        $mail = app(MailMailboxService::class);

        $mail->rememberRecipients(
            $user,
            'Ada Lovelace <ada@example.com>, bob@example.com',
            'carol@example.com',
            'me@example.com',
        );

        $this->assertDatabaseHas('user_mail_recipient_suggestions', [
            'user_id' => $user->id,
            'email' => 'ada@example.com',
        ]);
        $this->assertDatabaseHas('user_mail_recipient_suggestions', [
            'user_id' => $user->id,
            'email' => 'bob@example.com',
        ]);
        $this->assertDatabaseMissing('user_mail_recipient_suggestions', [
            'user_id' => $user->id,
            'email' => 'me@example.com',
        ]);

        $this->withToken($token)
            ->getJson('/api/mail/recipient-suggestions?q=ada')
            ->assertOk()
            ->assertJsonPath('suggestions.0.email', 'ada@example.com')
            ->assertJsonPath('suggestions.0.source', 'history');
    }

    public function test_recipient_suggestions_include_directory_users(): void
    {
        $viewer = User::factory()->create([
            'is_approved' => true,
            'full_name' => 'Viewer Person',
            'name' => 'viewer',
            'email' => 'viewer@example.com',
        ]);
        User::factory()->create([
            'is_approved' => true,
            'full_name' => 'Grace Hopper',
            'name' => 'grace',
            'email' => 'grace.hopper@example.com',
        ]);
        $token = ApiTokenAuth::issueToken($viewer);

        $this->withToken($token)
            ->getJson('/api/mail/recipient-suggestions?q=grace')
            ->assertOk()
            ->assertJsonFragment([
                'email' => 'grace.hopper@example.com',
                'source' => 'directory',
            ]);
    }

    public function test_save_draft_requires_connected_mailbox(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = ApiTokenAuth::issueToken($user);

        $this->withToken($token)
            ->putJson('/api/mail/drafts', [
                'to' => 'ada@example.com',
                'subject' => 'Hello',
                'body' => 'Draft body',
            ])
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Mail account not connected.']);
    }

    public function test_save_draft_returns_uid_from_service(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = ApiTokenAuth::issueToken($user);

        UserMailCredential::query()->create([
            'user_id' => $user->id,
            'email' => $user->email,
            'is_primary' => true,
            'password' => Crypt::encryptString('secret'),
            'verified_at' => now(),
        ]);

        $mailMock = Mockery::mock(MailMailboxService::class)->makePartial();
        $mailMock->shouldReceive('saveDraft')
            ->once()
            ->andReturn([
                'uid' => 42,
                'folder' => 'drafts',
                'account_id' => 1,
            ]);
        $this->app->instance(MailMailboxService::class, $mailMock);

        $this->withToken($token)
            ->putJson('/api/mail/drafts', [
                'to' => 'ada@example.com',
                'subject' => 'Hello',
                'body' => 'Draft body',
                'uid' => 10,
            ])
            ->assertOk()
            ->assertJson([
                'uid' => 42,
                'folder' => 'drafts',
            ]);
    }

    public function test_delete_draft_uses_service(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = ApiTokenAuth::issueToken($user);

        $mailMock = Mockery::mock(MailMailboxService::class)->makePartial();
        $mailMock->shouldReceive('deleteDraft')
            ->once()
            ->with(
                Mockery::on(fn (User $checked) => $checked->is($user)),
                99,
                null,
            );
        $this->app->instance(MailMailboxService::class, $mailMock);

        $this->withToken($token)
            ->deleteJson('/api/mail/drafts/99')
            ->assertOk()
            ->assertJson(['deleted' => true]);
    }

    public function test_remember_recipients_increments_use_count(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $mail = app(MailMailboxService::class);

        $mail->rememberRecipients($user, 'ada@example.com');
        $mail->rememberRecipients($user, 'Ada Lovelace <ada@example.com>');

        $row = UserMailRecipientSuggestion::query()
            ->where('user_id', $user->id)
            ->where('email', 'ada@example.com')
            ->first();

        $this->assertNotNull($row);
        $this->assertSame(2, (int) $row->use_count);
    }

    public function test_imap_is_enabled_without_php_imap_extension(): void
    {
        config(['mail.imap.enabled' => true]);

        $this->assertTrue(app(MailMailboxService::class)->isImapEnabled());
        $this->assertTrue(class_exists(Client::class));
    }

    public function test_mail_index_lists_headers_without_fetching_bodies(): void
    {
        $user = User::factory()->create(['is_approved' => true]);
        $token = ApiTokenAuth::issueToken($user);

        $mailMock = Mockery::mock(MailMailboxService::class)->makePartial();
        $mailMock->shouldReceive('listInbox')
            ->once()
            ->withArgs(function ($checkedUser, $limit, $query, $unreadOnly, $includeAttachments) use ($user) {
                return $checkedUser->is($user)
                    && $limit === 50
                    && $query === null
                    && $unreadOnly === false
                    && $includeAttachments === false;
            })
            ->andReturn([
                'messages' => [],
                'unread_count' => 0,
                'folder' => 'inbox',
                'account_id' => 1,
            ]);
        $this->app->instance(MailMailboxService::class, $mailMock);

        $this->withToken($token)
            ->getJson('/api/mail/messages')
            ->assertOk()
            ->assertJson([
                'messages' => [],
                'unread_count' => 0,
            ]);
    }
}
