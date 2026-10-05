<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageReplyTest extends TestCase
{
    use RefreshDatabase;

    private function approvedUser(): User
    {
        return User::factory()->create(['is_approved' => true, 'role' => 'user']);
    }

    /**
     * @return array{0: int, 1: int} conversation id, first message id
     */
    private function startConversation(User $from, User $to, string $body = 'Lunch at 1?'): array
    {
        $payload = $this->withToken(ApiTokenAuth::issueToken($from))
            ->postJson('/api/conversations', ['recipient_user_id' => $to->id, 'body' => $body])
            ->assertCreated()
            ->json();

        return [$payload['conversation']['id'], $payload['message']['id']];
    }

    public function test_reply_quotes_the_original_message(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();
        [$conversationId, $originalId] = $this->startConversation($alice, $bob);
        $bobToken = ApiTokenAuth::issueToken($bob);

        $reply = $this->withToken($bobToken)
            ->postJson("/api/conversations/{$conversationId}/messages", [
                'body' => 'Sure!',
                'reply_to_message_id' => $originalId,
            ])
            ->assertCreated()
            ->json('message');

        $this->assertSame($originalId, $reply['reply_to']['id']);
        $this->assertSame('Lunch at 1?', $reply['reply_to']['excerpt']);
        $this->assertSame($alice->id, $reply['reply_to']['sender']['id']);
        $this->assertFalse($reply['reply_to']['is_mine']);

        $thread = $this->withToken(ApiTokenAuth::issueToken($alice))
            ->getJson("/api/conversations/{$conversationId}/messages")
            ->assertOk()
            ->json('messages');

        $this->assertNull($thread[0]['reply_to']);
        $this->assertSame($originalId, $thread[1]['reply_to']['id']);
        $this->assertTrue($thread[1]['reply_to']['is_mine']);
    }

    public function test_cannot_reply_to_a_message_from_another_conversation(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();
        $carol = $this->approvedUser();
        [$aliceBobId] = $this->startConversation($alice, $bob);
        [, $aliceCarolMessageId] = $this->startConversation($alice, $carol, 'Secret');

        $this->withToken(ApiTokenAuth::issueToken($bob))
            ->postJson("/api/conversations/{$aliceBobId}/messages", [
                'body' => 'Peeking',
                'reply_to_message_id' => $aliceCarolMessageId,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reply_to_message_id');
    }

    public function test_reply_to_deleted_message_hides_its_body(): void
    {
        $alice = $this->approvedUser();
        $bob = $this->approvedUser();
        [$conversationId, $originalId] = $this->startConversation($alice, $bob);

        $this->withToken(ApiTokenAuth::issueToken($bob))
            ->postJson("/api/conversations/{$conversationId}/messages", [
                'body' => 'Replying',
                'reply_to_message_id' => $originalId,
            ])
            ->assertCreated();

        $this->withToken(ApiTokenAuth::issueToken($alice))
            ->deleteJson("/api/messages/{$originalId}")
            ->assertOk();

        $quote = $this->withToken(ApiTokenAuth::issueToken($bob))
            ->getJson("/api/conversations/{$conversationId}/messages")
            ->assertOk()
            ->json('messages.1.reply_to');

        $this->assertTrue($quote['is_deleted']);
        $this->assertNull($quote['excerpt']);
    }
}
