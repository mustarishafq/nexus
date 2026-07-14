<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\ProfileMediaComment;
use App\Models\ProfileMediaReaction;
use App\Models\User;
use Illuminate\Support\Collection;

trait SerializesProfileMedia
{
    public const PROFILE_MEDIA_TYPES = ['avatar', 'cover'];

    public const PROFILE_MEDIA_REACTIONS = ['👍', '❤️', '👏', '🎉', '😂', '🔥'];

    /**
     * @return array<string, mixed>
     */
    protected function serializeProfileMedia(User $owner, string $mediaType, User $viewer, ?Collection $reactions = null, ?int $commentsCount = null): array
    {
        $reactions ??= ProfileMediaReaction::query()
            ->where('owner_user_id', $owner->id)
            ->where('media_type', $mediaType)
            ->get();

        $reactionCounts = [];
        $myReaction = null;

        foreach ($reactions as $reaction) {
            $reactionCounts[$reaction->reaction] = ($reactionCounts[$reaction->reaction] ?? 0) + 1;
            if ((int) $reaction->user_id === (int) $viewer->id) {
                $myReaction = [
                    'id' => $reaction->id,
                    'reaction' => $reaction->reaction,
                ];
            }
        }

        $imageUrl = $mediaType === 'avatar'
            ? $owner->profile_picture
            : $owner->cover_picture;

        return [
            'owner_user_id' => $owner->id,
            'media_type' => $mediaType,
            'image_url' => $imageUrl,
            'owner' => $this->serializeFeedAuthor($owner->loadMissing('department')),
            'comments_count' => $commentsCount ?? ProfileMediaComment::query()
                ->where('owner_user_id', $owner->id)
                ->where('media_type', $mediaType)
                ->count(),
            'reactions_count' => array_sum($reactionCounts),
            'reaction_counts' => $reactionCounts,
            'my_reaction' => $myReaction,
            'available_reactions' => self::PROFILE_MEDIA_REACTIONS,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function serializeProfileMediaComment(ProfileMediaComment $comment, User $viewer, bool $includeReplies = false): array
    {
        $reactions = $comment->relationLoaded('reactions') ? $comment->reactions : collect();
        $reactionCounts = [];
        $myReaction = null;

        foreach ($reactions as $reaction) {
            $reactionCounts[$reaction->reaction] = ($reactionCounts[$reaction->reaction] ?? 0) + 1;
            if ((int) $reaction->user_id === (int) $viewer->id) {
                $myReaction = [
                    'id' => $reaction->id,
                    'reaction' => $reaction->reaction,
                ];
            }
        }

        $payload = [
            'id' => $comment->id,
            'owner_user_id' => $comment->owner_user_id,
            'media_type' => $comment->media_type,
            'parent_comment_id' => $comment->parent_comment_id,
            'body' => $comment->body,
            'author' => $this->serializeFeedAuthor($comment->author),
            'created_date' => $comment->created_date,
            'can_delete' => $viewer->id === $comment->author_user_id || $viewer->role === 'admin',
            'reaction_counts' => $reactionCounts,
            'my_reaction' => $myReaction,
            'available_reactions' => self::PROFILE_MEDIA_REACTIONS,
        ];

        if ($includeReplies) {
            $replies = $comment->relationLoaded('replies') ? $comment->replies : collect();
            $payload['replies'] = $replies
                ->map(fn (ProfileMediaComment $reply) => $this->serializeProfileMediaComment($reply, $viewer))
                ->values()
                ->all();
        }

        return $payload;
    }
}
