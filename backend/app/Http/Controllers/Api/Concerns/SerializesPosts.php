<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Post;
use App\Models\User;

trait SerializesPosts
{
    public const POST_REACTIONS = ['👍', '❤️', '👏', '🎉', '😂', '🔥'];

    /**
     * @return array<string, mixed>
     */
    protected function serializePost(Post $post, User $viewer): array
    {
        $reactions = $post->relationLoaded('reactions') ? $post->reactions : $post->reactions()->get();
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

        $reactionsCount = array_sum($reactionCounts);

        return [
            'type' => 'post',
            'id' => $post->id,
            'body' => $post->body,
            'image_url' => $post->image_url,
            'author' => $this->serializeFeedAuthor($post->author),
            'comments_count' => (int) ($post->comments_count ?? $post->comments()->count()),
            'reactions_count' => $reactionsCount,
            'reaction_counts' => $reactionCounts,
            'my_reaction' => $myReaction,
            'available_reactions' => self::POST_REACTIONS,
            'created_date' => $post->created_date,
            'can_delete' => $viewer->id === $post->author_user_id || $viewer->role === 'admin',
        ];
    }
}
