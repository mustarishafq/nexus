<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\PostComment;
use App\Models\User;

trait SerializesPostComments
{
    /**
     * @return array<string, mixed>
     */
    protected function serializeComment(PostComment $comment, User $viewer, bool $includeReplies = false): array
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
            'post_id' => $comment->post_id,
            'parent_comment_id' => $comment->parent_comment_id,
            'body' => $comment->body,
            'author' => $this->serializeFeedAuthor($comment->author),
            'created_date' => $comment->created_date,
            'can_delete' => $viewer->id === $comment->author_user_id || $viewer->role === 'admin',
            'reaction_counts' => $reactionCounts,
            'my_reaction' => $myReaction,
            'available_reactions' => self::POST_REACTIONS,
        ];

        if ($includeReplies) {
            $replies = $comment->relationLoaded('replies') ? $comment->replies : collect();
            $payload['replies'] = $replies
                ->map(fn (PostComment $reply) => $this->serializeComment($reply, $viewer))
                ->values()
                ->all();
        }

        return $payload;
    }
}
