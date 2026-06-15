<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\Post;
use App\Models\User;
use App\Services\PushNotificationService;
use App\Support\FeedLinks;

class FeedNotificationService
{
    public function notifyPostAuthorOnComment(Post $post, User $commenter, string $body): void
    {
        $authorId = (int) $post->author_user_id;

        if ($authorId === (int) $commenter->id) {
            return;
        }

        $mentionedIds = app(MentionService::class)->extractUserIds($body);
        if (in_array($authorId, $mentionedIds, true)) {
            return;
        }

        $author = User::query()
            ->where('is_approved', true)
            ->find($authorId);

        if (! $author) {
            return;
        }

        $commenterName = $commenter->displayName();
        $preview = trim(preg_replace(MentionService::TOKEN_PATTERN, '@$2', $body) ?? $body);
        $preview = mb_strlen($preview) > 120 ? mb_substr($preview, 0, 117).'...' : $preview;

        $notification = Notification::create([
            'user_id' => (string) $author->id,
            'type' => 'info',
            'priority' => 'medium',
            'title' => "{$commenterName} commented on your post",
            'message' => $preview,
            'category' => 'other',
            'is_read' => false,
            'is_broadcast' => false,
            'action_url' => FeedLinks::post($post->id, expandComments: true),
            'delivery_channels' => ['in_app'],
            'data' => [
                'kind' => 'post_comment',
                'post_id' => $post->id,
                'author_user_id' => $commenter->id,
            ],
        ]);

        app(PushNotificationService::class)->sendNotification($notification);
    }
}
