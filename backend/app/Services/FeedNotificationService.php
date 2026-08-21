<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\PostReach;
use App\Models\User;
use App\Support\FeedLinks;
use App\Support\PermissionCatalog;
use Illuminate\Support\Facades\DB;

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

        if (! $author || ! $author->wantsNotification('feed_comments')) {
            return;
        }

        $commenterName = $commenter->displayName();
        $preview = $this->plainTextPreview($body);

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

    public function notifyCommentAuthorOnReply(Post $post, PostComment $parentComment, User $replier, string $body): void
    {
        $parentAuthorId = (int) $parentComment->author_user_id;

        if ($parentAuthorId === (int) $replier->id) {
            return;
        }

        $mentionedIds = app(MentionService::class)->extractUserIds($body);
        if (in_array($parentAuthorId, $mentionedIds, true)) {
            return;
        }

        $parentAuthor = User::query()
            ->where('is_approved', true)
            ->find($parentAuthorId);

        if (! $parentAuthor || ! $parentAuthor->wantsNotification('feed_comments')) {
            return;
        }

        $replierName = $replier->displayName();
        $preview = $this->plainTextPreview($body);

        $notification = Notification::create([
            'user_id' => (string) $parentAuthor->id,
            'type' => 'info',
            'priority' => 'medium',
            'title' => "{$replierName} replied to your comment",
            'message' => $preview,
            'category' => 'other',
            'is_read' => false,
            'is_broadcast' => false,
            'action_url' => FeedLinks::post($post->id, expandComments: true),
            'delivery_channels' => ['in_app'],
            'data' => [
                'kind' => 'post_comment_reply',
                'post_id' => $post->id,
                'parent_comment_id' => $parentComment->id,
                'author_user_id' => $replier->id,
            ],
        ]);

        app(PushNotificationService::class)->sendNotification($notification);
    }

    public function notifyModeratorsOfPendingPost(Post $post, User $author): void
    {
        if (! $post->isPending()) {
            return;
        }

        $moderators = PermissionService::usersWith(PermissionCatalog::FEED_MODERATE)
            ->where('is_approved', true)
            ->where('id', '!=', $author->id)
            ->get(['id']);

        if ($moderators->isEmpty()) {
            return;
        }

        $authorName = $author->displayName();
        $preview = $this->plainTextPreview((string) $post->body);
        if ($preview === '' && $post->resolvedImageUrls() !== []) {
            $preview = 'Shared an image';
        }
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

    public function notifyPostPublished(Post $post, User $author): void
    {
        if (! $post->isApproved()) {
            return;
        }

        $recipientIds = DB::table('push_subscriptions')
            ->join('users', 'users.id', '=', 'push_subscriptions.user_id')
            ->where('users.is_approved', true)
            ->where('users.id', '!=', $author->id)
            ->distinct()
            ->pluck('users.id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        if ($recipientIds === []) {
            return;
        }

        $recipients = User::query()
            ->whereIn('id', $recipientIds)
            ->get(['id', 'notification_settings']);

        $recipientIds = $recipients
            ->filter(fn (User $user) => $user->wantsNotification('feed_posts'))
            ->map(fn (User $user) => (int) $user->id)
            ->values()
            ->all();

        if ($recipientIds === []) {
            return;
        }

        $authorName = $author->displayName();
        $preview = $this->plainTextPreview((string) $post->body);
        if ($preview === '' && $post->resolvedImageUrls() !== []) {
            $preview = 'Shared an image';
        }
        $message = $preview !== ''
            ? "{$authorName}: {$preview}"
            : "{$authorName} shared a new post.";

        $push = app(PushNotificationService::class);
        $now = now();
        $reachedUserIds = [];

        foreach ($recipientIds as $recipientId) {
            $notification = Notification::create([
                'user_id' => (string) $recipientId,
                'type' => 'info',
                'priority' => 'medium',
                'category' => 'other',
                'title' => 'New feed post',
                'message' => $message,
                'action_url' => FeedLinks::post($post->id),
                'is_read' => false,
                'is_broadcast' => false,
                'delivery_channels' => ['in_app'],
                'data' => [
                    'kind' => 'feed_post_published',
                    'post_id' => $post->id,
                    'author_user_id' => $author->id,
                    'author_name' => $authorName,
                ],
            ]);

            foreach ($push->sendNotification($notification) as $successfulUserId) {
                $reachedUserIds[(int) $successfulUserId] = true;
            }
        }

        foreach (array_keys($reachedUserIds) as $userId) {
            PostReach::query()->firstOrCreate(
                [
                    'post_id' => $post->id,
                    'user_id' => $userId,
                ],
                [
                    'reached_at' => $now,
                ]
            );
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
        $preview = $this->plainTextPreview((string) $post->body, 80);
        if ($preview === '' && $post->resolvedImageUrls() !== []) {
            $preview = 'your image post';
        }
        if ($preview === '') {
            $preview = 'your post';
        }

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

    /**
     * Build a plain-text notification preview from rich post/comment HTML.
     */
    private function plainTextPreview(string $body, int $maxLength = 120): string
    {
        $preview = trim(preg_replace(MentionService::TOKEN_PATTERN, '@$2', $body) ?? $body);
        $preview = preg_replace('/<br\s*\/?>/i', ' ', $preview) ?? $preview;
        $preview = preg_replace('/<\/p>/i', ' ', $preview) ?? $preview;
        $preview = trim(html_entity_decode(strip_tags($preview), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $preview = trim(preg_replace('/\s+/u', ' ', $preview) ?? $preview);

        if (mb_strlen($preview) > $maxLength) {
            return mb_substr($preview, 0, $maxLength - 3).'...';
        }

        return $preview;
    }
}
