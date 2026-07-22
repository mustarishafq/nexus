<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Post;
use App\Models\User;
use App\Support\UserRoles;

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
        $isPending = $post->isPending();
        $canModerate = UserRoles::isHrOrAdmin($viewer);
        $imageUrls = $post->resolvedImageUrls();
        $isAuthor = (int) $viewer->id === (int) $post->author_user_id;
        $editsCount = (int) ($post->edits_count ?? $post->edits()->count());
        $isEdited = $editsCount > 0 || filled($post->edited_at);

        return [
            'type' => 'post',
            'id' => $post->id,
            'body' => $post->body,
            'image_url' => $imageUrls[0] ?? null,
            'image_urls' => $imageUrls,
            'approval_status' => $post->approval_status ?? Post::APPROVAL_APPROVED,
            'author' => $this->serializeFeedAuthor($post->author),
            'comments_count' => (int) ($post->comments_count ?? $post->comments()->count()),
            'reactions_count' => $reactionsCount,
            'reaction_counts' => $reactionCounts,
            'my_reaction' => $myReaction,
            'available_reactions' => self::POST_REACTIONS,
            'created_date' => $post->created_date,
            'edited_at' => $post->edited_at?->toISOString(),
            'is_edited' => $isEdited,
            'edits_count' => $editsCount,
            'can_edit' => $isAuthor,
            'can_delete' => $isAuthor || $canModerate,
            'can_moderate' => $canModerate && $isPending,
            'is_pending' => $isPending,
        ];
    }
}
