<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;

class DirectMessageNotifier
{
    public function notifyRecipient(User $sender, User $recipient, Conversation $conversation, Message $message): void
    {
        if ($recipient->id === $sender->id) {
            return;
        }

        $senderName = $sender->displayName();
        $preview = mb_strlen($message->body) > 120 ? mb_substr($message->body, 0, 117).'...' : $message->body;

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
