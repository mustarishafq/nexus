<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\MessageEdit;
use App\Models\MessageReaction;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageEditDeleteReactionTest extends TestCase
{
    use RefreshDatabase;

    private function approvedUser(array $attrs = []): User
    {
        return User::factory()->create(array_merge(['is_approved' => true, 'role' => 'user'], $attrs));
    }

    /**
     * @return array{0: User, 1: User, 2: int, 3: int} [alice, bob, conversationId, messageId]
     */
    private function conversationWithMessage(string $body = 'Original text'): array
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();

        $response = $this->withToken(ApiTokenAuth::issueToken($alice))
            ->postJson('/api/conversations', ['recipient_user_id' => $bob->id, 'body' => $body])
            ->assertCreated()
            ->json();

        return [$alice, $bob, $response['conversation']['id'], $response['message']['id']];
    }

    // --- Editing -----------------------------------------------------

    public function test_sender_can_edit_their_own_message(): void
    {
        [$alice, , , $messageId] = $this->conversationWithMessage('Original text');

        $response = $this->withToken(ApiTokenAuth::issueToken($alice))
            ->putJson("/api/messages/{$messageId}", ['body' => 'Edited text'])
            ->assertOk()
            ->json('message');

        $this->assertSame('Edited text', $response['body']);
        $this->assertTrue($response['is_edited']);
        $this->assertNotNull($response['edited_at']);
    }

    public function test_edited_message_persists_after_a_fresh_request(): void
    {
        [$alice, , $conversationId, $messageId] = $this->conversationWithMessage('Original text');
        $token = ApiTokenAuth::issueToken($alice);

        $originalCreatedDate = $this->withToken($token)
            ->getJson("/api/conversations/{$conversationId}/messages")
            ->json('messages.0.created_date');

        $this->withToken($token)
            ->putJson("/api/messages/{$messageId}", ['body' => 'Edited text'])
            ->assertOk();

        // Simulate a page refresh: fetch fresh from the server.
        $fresh = $this->withToken($token)
            ->getJson("/api/conversations/{$conversationId}/messages")
            ->assertOk()
            ->json('messages.0');

        $this->assertSame('Edited text', $fresh['body']);
        $this->assertTrue($fresh['is_edited']);
        $this->assertNotNull($fresh['edited_at']);
        // The original send timestamp must be preserved across an edit.
        $this->assertSame($originalCreatedDate, $fresh['created_date']);

        $this->assertDatabaseHas('messages', ['id' => $messageId, 'body' => 'Edited text']);
    }

    public function test_original_content_is_retained_for_audit_when_edited(): void
    {
        [$alice, , , $messageId] = $this->conversationWithMessage('Original text');

        $this->withToken(ApiTokenAuth::issueToken($alice))
            ->putJson("/api/messages/{$messageId}", ['body' => 'Edited text'])
            ->assertOk();

        $this->assertDatabaseHas('message_edits', [
            'message_id' => $messageId,
            'editor_user_id' => $alice->id,
            'body' => 'Original text',
        ]);
        $this->assertSame(1, MessageEdit::query()->where('message_id', $messageId)->count());
    }

    public function test_another_participant_cannot_edit_the_message(): void
    {
        [, $bob, , $messageId] = $this->conversationWithMessage('Original text');

        $this->withToken(ApiTokenAuth::issueToken($bob))
            ->putJson("/api/messages/{$messageId}", ['body' => 'Hacked text'])
            ->assertForbidden();

        $this->assertDatabaseHas('messages', ['id' => $messageId, 'body' => 'Original text']);
    }

    public function test_stranger_cannot_edit_the_message(): void
    {
        [, , , $messageId] = $this->conversationWithMessage('Original text');
        $stranger = $this->approvedUser();

        $this->withToken(ApiTokenAuth::issueToken($stranger))
            ->putJson("/api/messages/{$messageId}", ['body' => 'Hacked text'])
            ->assertForbidden();
    }

    public function test_unauthenticated_request_cannot_edit_a_message(): void
    {
        [, , , $messageId] = $this->conversationWithMessage('Original text');

        // conversationWithMessage() leaves Alice's token attached as a
        // default header (withToken persists it for the rest of the test).
        $this->withoutToken()
            ->putJson("/api/messages/{$messageId}", ['body' => 'Nope'])
            ->assertUnauthorized();
    }

    public function test_deleted_message_cannot_be_edited(): void
    {
        [$alice, , , $messageId] = $this->conversationWithMessage('Original text');
        $token = ApiTokenAuth::issueToken($alice);

        $this->withToken($token)->deleteJson("/api/messages/{$messageId}")->assertOk();

        $this->withToken($token)
            ->putJson("/api/messages/{$messageId}", ['body' => 'Resurrected'])
            ->assertStatus(422);
    }

    // --- Deletion ------------------------------------------------------

    public function test_sender_can_delete_their_own_message(): void
    {
        [$alice, , , $messageId] = $this->conversationWithMessage('Secret content');

        $response = $this->withToken(ApiTokenAuth::issueToken($alice))
            ->deleteJson("/api/messages/{$messageId}")
            ->assertOk()
            ->json('message');

        $this->assertTrue($response['is_deleted']);
        $this->assertNull($response['body']);
    }

    public function test_deleted_message_row_and_original_body_remain_in_database(): void
    {
        [$alice, , , $messageId] = $this->conversationWithMessage('Secret content');

        $this->withToken(ApiTokenAuth::issueToken($alice))
            ->deleteJson("/api/messages/{$messageId}")
            ->assertOk();

        // The row must not be physically removed, and the real content must
        // still be sitting in the database for moderation/audit purposes.
        $this->assertDatabaseHas('messages', [
            'id' => $messageId,
            'body' => 'Secret content',
        ]);
        // No SoftDeletes trait/global scope is used here, so a plain find()
        // proves the row is still a normal, queryable record.
        $stored = Message::query()->find($messageId);
        $this->assertNotNull($stored);
        $this->assertNotNull($stored->deleted_at);
        $this->assertSame('Secret content', $stored->body);
    }

    public function test_normal_api_response_never_exposes_deleted_content(): void
    {
        [$alice, $bob, $conversationId, $messageId] = $this->conversationWithMessage('Secret content');

        $this->withToken(ApiTokenAuth::issueToken($alice))
            ->deleteJson("/api/messages/{$messageId}")
            ->assertOk();

        // Both the sender and the other participant must only see the tombstone.
        foreach ([$alice, $bob] as $viewer) {
            $messages = $this->withToken(ApiTokenAuth::issueToken($viewer))
                ->getJson("/api/conversations/{$conversationId}/messages")
                ->assertOk()
                ->json('messages');

            $this->assertNull($messages[0]['body']);
            $this->assertTrue($messages[0]['is_deleted']);
        }
    }

    public function test_another_participant_cannot_delete_the_message(): void
    {
        [, $bob, , $messageId] = $this->conversationWithMessage('Secret content');

        $this->withToken(ApiTokenAuth::issueToken($bob))
            ->deleteJson("/api/messages/{$messageId}")
            ->assertForbidden();

        $this->assertDatabaseHas('messages', ['id' => $messageId, 'body' => 'Secret content']);
    }

    public function test_already_deleted_message_cannot_be_deleted_again(): void
    {
        [$alice, , , $messageId] = $this->conversationWithMessage('Secret content');
        $token = ApiTokenAuth::issueToken($alice);

        $this->withToken($token)->deleteJson("/api/messages/{$messageId}")->assertOk();

        $this->withToken($token)
            ->deleteJson("/api/messages/{$messageId}")
            ->assertStatus(422);
    }

    // --- Reactions -------------------------------------------------------

    public function test_participant_can_react_to_a_message(): void
    {
        [, $bob, , $messageId] = $this->conversationWithMessage('React to me');

        $response = $this->withToken(ApiTokenAuth::issueToken($bob))
            ->postJson("/api/messages/{$messageId}/reactions", ['reaction' => '👍'])
            ->assertOk()
            ->json('message');

        $this->assertSame('👍', $response['my_reaction']['reaction']);
        $this->assertSame(1, $response['reaction_counts']['👍']);

        $this->assertDatabaseHas('message_reactions', [
            'message_id' => $messageId,
            'user_id' => $bob->id,
            'reaction' => '👍',
        ]);
    }

    public function test_participant_can_toggle_off_and_switch_reaction(): void
    {
        [, $bob, , $messageId] = $this->conversationWithMessage('React to me');
        $token = ApiTokenAuth::issueToken($bob);

        $this->withToken($token)
            ->postJson("/api/messages/{$messageId}/reactions", ['reaction' => '👍'])
            ->assertOk();

        // Posting the same reaction again toggles it off.
        $toggledOff = $this->withToken($token)
            ->postJson("/api/messages/{$messageId}/reactions", ['reaction' => '👍'])
            ->assertOk()
            ->json('message');
        $this->assertNull($toggledOff['my_reaction']);
        $this->assertSame(0, MessageReaction::query()->where('message_id', $messageId)->count());

        // Reacting again, then switching to a different emoji, replaces it (one reaction per user).
        $this->withToken($token)
            ->postJson("/api/messages/{$messageId}/reactions", ['reaction' => '👍'])
            ->assertOk();
        $switched = $this->withToken($token)
            ->postJson("/api/messages/{$messageId}/reactions", ['reaction' => '🔥'])
            ->assertOk()
            ->json('message');
        $this->assertSame('🔥', $switched['my_reaction']['reaction']);
        $this->assertSame(1, MessageReaction::query()->where('message_id', $messageId)->count());

        // Explicit DELETE also removes it.
        $removed = $this->withToken($token)
            ->deleteJson("/api/messages/{$messageId}/reactions")
            ->assertOk()
            ->json('message');
        $this->assertNull($removed['my_reaction']);
    }

    public function test_non_participant_cannot_react_to_the_message(): void
    {
        [, , , $messageId] = $this->conversationWithMessage('React to me');
        $stranger = $this->approvedUser();

        $this->withToken(ApiTokenAuth::issueToken($stranger))
            ->postJson("/api/messages/{$messageId}/reactions", ['reaction' => '👍'])
            ->assertForbidden();

        $this->assertDatabaseCount('message_reactions', 0);
    }

    public function test_reactions_are_scoped_to_the_correct_message_and_user(): void
    {
        [$alice, $bob, $conversationId] = $this->conversationWithMessage('First');
        $secondMessageId = $this->withToken(ApiTokenAuth::issueToken($alice))
            ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Second'])
            ->assertCreated()
            ->json('message.id');

        $firstMessageId = $this->withToken(ApiTokenAuth::issueToken($bob))
            ->getJson("/api/conversations/{$conversationId}/messages")
            ->json('messages.0.id');

        $this->withToken(ApiTokenAuth::issueToken($bob))
            ->postJson("/api/messages/{$firstMessageId}/reactions", ['reaction' => '❤️'])
            ->assertOk();

        $messages = $this->withToken(ApiTokenAuth::issueToken($bob))
            ->getJson("/api/conversations/{$conversationId}/messages")
            ->json('messages');

        $first = collect($messages)->firstWhere('id', $firstMessageId);
        $second = collect($messages)->firstWhere('id', $secondMessageId);

        $this->assertSame('❤️', $first['my_reaction']['reaction']);
        $this->assertNull($second['my_reaction']);
    }

    public function test_cannot_react_to_a_deleted_message(): void
    {
        [$alice, $bob, , $messageId] = $this->conversationWithMessage('Secret content');

        $this->withToken(ApiTokenAuth::issueToken($alice))
            ->deleteJson("/api/messages/{$messageId}")
            ->assertOk();

        $this->withToken(ApiTokenAuth::issueToken($bob))
            ->postJson("/api/messages/{$messageId}/reactions", ['reaction' => '👍'])
            ->assertStatus(422);
    }
}
