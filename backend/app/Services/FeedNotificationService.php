<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\Post;
use App\Models\User;
use App\Support\FeedLinks;
use App\Support\UserRoles;

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

    public function notifyModeratorsOfPendingPost(Post $post, User $author): void
    {
        if (! $post->isPending()) {
            return;
        }

        $moderators = User::query()
            ->where('is_approved', true)
            ->whereIn('role', [UserRoles::ADMIN, UserRoles::HR])
            ->where('id', '!=', $author->id)
            ->get(['id']);

        if ($moderators->isEmpty()) {
            return;
        }

        $authorName = $author->displayName();
        $preview = trim(preg_replace(MentionService::TOKEN_PATTERN, '@$2', (string) $post->body) ?? (string) $post->body);
        if ($preview === '' && $post->resolvedImageUrls() !== []) {
            $preview = 'Shared an image';
        }
        $preview = mb_strlen($preview) > 120 ? mb_substr($preview, 0, 117).'...' : $preview;
        $message = $preview !== ''
            ? "{$authorName} submitted a post for review: {$preview}"
            : "{$authorName} submitted a post for review.";

        foreach ($moderators as $moderator) {
            $notification = Notification::create([
                'user_id' => (string) $moderator->id,
                'type' => 'info',
                'priority' => 'medium',
                'category' => 'approval',
                'title' => 'Feed post approval needed',
                'message' => $message,
                'action_url' => FeedLinks::post($post->id),
                'is_read' => false,
                'is_broadcast' => false,
                'delivery_channels' => ['in_app'],
                'data' => [
                    'kind' => 'feed_post_pending',
                    'post_id' => $post->id,
                    'author_user_id' => $author->id,
                    'author_name' => $authorName,
                ],
            ]);

            app(PushNotificationService::class)->sendNotification($notification);
        }
    }

    public function notifyAuthorOfReview(Post $post, User $reviewer, bool $approved): void
    {
        $author = $post->relationLoaded('author')
            ? $post->author
            : User::query()->where('is_approved', true)->find($post->author_user_id);

        if (! $author || (int) $author->id === (int) $reviewer->id) {
            return;
        }

        $reviewerName = $reviewer->displayName();
        $preview = trim(preg_replace(MentionService::TOKEN_PATTERN, '@$2', (string) $post->body) ?? (string) $post->body);
        if ($preview === '' && $post->resolvedImageUrls() !== []) {
            $preview = 'your image post';
        }
        $preview = $preview !== ''
            ? (mb_strlen($preview) > 80 ? mb_substr($preview, 0, 77).'...' : $preview)
            : 'your post';

        $notification = Notification::create([
            'user_id' => (string) $author->id,
            'type' => $approved ? 'success' : 'warning',
            'priority' => 'medium',
            'category' => 'approval',
            'title' => $approved ? 'Feed post approved' : 'Feed post rejected',
            'message' => $approved
                ? "{$reviewerName} approved your post: {$preview}"
                : "{$reviewerName} rejected your post: {$preview}",
            'action_url' => $approved ? FeedLinks::post($post->id) : '/feed',
            'is_read' => false,
            'is_broadcast' => false,
            'delivery_channels' => ['in_app'],
            'data' => [
                'kind' => $approved ? 'feed_post_approved' : 'feed_post_rejected',
                'post_id' => $post->id,
                'reviewer_user_id' => $reviewer->id,
                'reviewer_name' => $reviewerName,
            ],
        ]);

        app(PushNotificationService::class)->sendNotification($notification);
    }
}
