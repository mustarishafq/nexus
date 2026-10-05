<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Support\FeedLinks;

class DirectMessageNotifier
{
    public function notifyRecipient(User $sender, User $recipient, Conversation $conversation, Message $message): void
    {
        if ($recipient->id === $sender->id) {
            return;
        }

        $senderName = $sender->displayName();
        $body = $message->body;
        if (preg_match(FeedLinks::SHARE_LINK_PATTERN, $body)) {
            $note = trim(preg_replace(FeedLinks::SHARE_LINK_PATTERN, '', $body) ?? '');
            $body = $note !== '' ? $note : 'Shared a post with you';
        }
        $preview = mb_strlen($body) > 120 ? mb_substr($body, 0, 117).'...' : $body;

        // Unread counts drive the Messages badge. Push-only delivery avoids duplicate
        // in-app Notification records while still triggering the service worker.
        app(PushNotificationService::class)->sendToUser($recipient->id, [
            'id' => "dm-{$message->id}",
            'kind' => 'direct_message',
            'title' => "New message from {$senderName}",
            'message' => $preview,
            'type' => 'info',
            'priority' => 'medium',
            'category' => 'other',
            'action_url' => "/messages/{$conversation->id}",
            'conversation_id' => $conversation->id,
            'sender_user_id' => $sender->id,
            'created_at' => now()->toISOString(),
        ], "dm-conversation-{$conversation->id}");
    }
}
