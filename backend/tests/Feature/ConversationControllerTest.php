<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConversationControllerTest extends TestCase
{
    use RefreshDatabase;

    private function approvedUser(array $attrs = []): User
    {
        return User::factory()->create(array_merge(['is_approved' => true, 'role' => 'user'], $attrs));
    }

    public function test_starting_a_conversation_persists_message_with_authenticated_sender(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();

        $response = $this->withToken(ApiTokenAuth::issueToken($alice))
            ->postJson('/api/conversations', [
                'recipient_user_id' => $bob->id,
                'body' => 'Hey Bob!',
                // A malicious/buggy client trying to impersonate someone else —
                // the server must ignore this and use the authenticated user.
                'sender_user_id' => $bob->id,
            ])
            ->assertCreated()
            ->json();

        $this->assertSame('Hey Bob!', $response['message']['body']);
        $this->assertSame($alice->id, $response['message']['sender']['id']);
        $this->assertTrue($response['message']['is_mine']);

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $response['conversation']['id'],
            'sender_user_id' => $alice->id,
            'body' => 'Hey Bob!',
        ]);
    }

    public function test_message_history_persists_across_requests(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();
        $aliceToken = ApiTokenAuth::issueToken($alice);
        $bobToken = ApiTokenAuth::issueToken($bob);

        $conversationId = $this->withToken($aliceToken)
            ->postJson('/api/conversations', ['recipient_user_id' => $bob->id, 'body' => 'First message'])
            ->assertCreated()
            ->json('conversation.id');

        $this->withToken($bobToken)
            ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Reply from Bob'])
            ->assertCreated();

        // Simulate a page refresh: fetch the thread fresh as each participant.
        $aliceView = $this->withToken($aliceToken)
            ->getJson("/api/conversations/{$conversationId}/messages")
            ->assertOk()
            ->json('messages');

        $this->assertCount(2, $aliceView);
        $this->assertSame('First message', $aliceView[0]['body']);
        $this->assertTrue($aliceView[0]['is_mine']);
        $this->assertSame('Reply from Bob', $aliceView[1]['body']);
        $this->assertFalse($aliceView[1]['is_mine']);

        $bobView = $this->withToken($bobToken)
            ->getJson("/api/conversations/{$conversationId}/messages")
            ->assertOk()
            ->json('messages');

        $this->assertCount(2, $bobView);
        $this->assertFalse($bobView[0]['is_mine']);
        $this->assertTrue($bobView[1]['is_mine']);
    }

    public function test_non_participant_cannot_view_or_send_messages(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();
        $stranger = $this->approvedUser();

        $conversationId = $this->withToken(ApiTokenAuth::issueToken($alice))
            ->postJson('/api/conversations', ['recipient_user_id' => $bob->id, 'body' => 'Private chat'])
            ->assertCreated()
            ->json('conversation.id');

        $strangerToken = ApiTokenAuth::issueToken($stranger);

        $this->withToken($strangerToken)
            ->getJson("/api/conversations/{$conversationId}/messages")
            ->assertForbidden();

        $this->withToken($strangerToken)
            ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Butting in'])
            ->assertForbidden();

        $this->withToken($strangerToken)
            ->patchJson("/api/conversations/{$conversationId}/read")
            ->assertForbidden();

        $this->withToken($strangerToken)
            ->deleteJson("/api/conversations/{$conversationId}")
            ->assertForbidden();

        $this->assertDatabaseCount('messages', 1);
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/conversations')->assertUnauthorized();
    }

    public function test_index_only_returns_the_viewers_own_conversations(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();
        $carol = $this->approvedUser();

        $this->withToken(ApiTokenAuth::issueToken($alice))
            ->postJson('/api/conversations', ['recipient_user_id' => $bob->id, 'body' => 'Hi Bob'])
            ->assertCreated();

        $carolConversations = $this->withToken(ApiTokenAuth::issueToken($carol))
            ->getJson('/api/conversations')
            ->assertOk()
            ->json('conversations');

        $this->assertCount(0, $carolConversations);

        $aliceConversations = $this->withToken(ApiTokenAuth::issueToken($alice))
            ->getJson('/api/conversations')
            ->assertOk()
            ->json('conversations');

        $this->assertCount(1, $aliceConversations);
        $this->assertSame($bob->id, $aliceConversations[0]['other_user']['id']);
    }

    public function test_user_cannot_message_self(): void
    {
        $alice = $this->approvedUser();

        $this->withToken(ApiTokenAuth::issueToken($alice))
            ->postJson('/api/conversations', ['recipient_user_id' => $alice->id, 'body' => 'Talking to myself'])
            ->assertStatus(422);
    }

    public function test_unread_count_tracks_and_clears_on_read(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();
        $aliceToken = ApiTokenAuth::issueToken($alice);
        $bobToken = ApiTokenAuth::issueToken($bob);

        $conversationId = $this->withToken($aliceToken)
            ->postJson('/api/conversations', ['recipient_user_id' => $bob->id, 'body' => 'Ping'])
            ->assertCreated()
            ->json('conversation.id');

        $bobInbox = $this->withToken($bobToken)
            ->getJson('/api/conversations')
            ->assertOk()
            ->json('conversations');
        $this->assertSame(1, $bobInbox[0]['unread_count']);
        $this->assertSame(1, $this->withToken($bobToken)->getJson('/api/conversations')->json('unread_total'));

        $this->withToken($bobToken)
            ->patchJson("/api/conversations/{$conversationId}/read")
            ->assertOk();

        $bobInboxAfterRead = $this->withToken($bobToken)
            ->getJson('/api/conversations')
            ->assertOk()
            ->json('conversations');
        $this->assertSame(0, $bobInboxAfterRead[0]['unread_count']);
    }

    public function test_participant_can_delete_conversation(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();
        $aliceToken = ApiTokenAuth::issueToken($alice);

        $conversationId = $this->withToken($aliceToken)
            ->postJson('/api/conversations', ['recipient_user_id' => $bob->id, 'body' => 'Bye'])
            ->assertCreated()
            ->json('conversation.id');

        $this->withToken($aliceToken)
            ->deleteJson("/api/conversations/{$conversationId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('conversations', ['id' => $conversationId]);
        $this->assertDatabaseMissing('messages', ['conversation_id' => $conversationId]);
    }

    public function test_starting_a_second_time_reuses_existing_conversation(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();
        $aliceToken = ApiTokenAuth::issueToken($alice);

        $firstId = $this->withToken($aliceToken)
            ->postJson('/api/conversations', ['recipient_user_id' => $bob->id, 'body' => 'First'])
            ->assertCreated()
            ->json('conversation.id');

        $secondId = $this->withToken($aliceToken)
            ->postJson('/api/conversations', ['recipient_user_id' => $bob->id, 'body' => 'Second'])
            ->assertOk()
            ->json('conversation.id');

        $this->assertSame($firstId, $secondId);
        $this->assertSame(1, Conversation::query()->count());
        $this->assertSame(2, Message::query()->where('conversation_id', $firstId)->count());
    }
}
