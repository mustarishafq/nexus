<?php

namespace App\Jobs;

use App\Models\Post;
use App\Models\User;
use App\Services\FeedNotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class NotifyFeedPostJob implements ShouldQueue
{
    use Queueable;

    public const ACTION_PUBLISHED = 'published';

    public const ACTION_PENDING_MODERATION = 'pending_moderation';

    public int $tries = 2;

    public int $timeout = 120;

    public function __construct(
        public string $action,
        public int $postId,
        public int $actorId,
    ) {}

    public function handle(FeedNotificationService $notifications): void
    {
        $post = Post::query()->find($this->postId);
        $actor = User::query()->find($this->actorId);

        if (! $post || ! $actor) {
            return;
        }

        match ($this->action) {
            self::ACTION_PUBLISHED => $notifications->notifyPostPublished($post, $actor),
            self::ACTION_PENDING_MODERATION => $notifications->notifyModeratorsOfPendingPost($post, $actor),
            default => null,
        };
    }

    public function failed(?Throwable $exception): void
    {
        Log::warning('Feed post notification job failed.', [
            'action' => $this->action,
            'post_id' => $this->postId,
            'actor_id' => $this->actorId,
            'error' => $exception?->getMessage(),
        ]);
    }
}
