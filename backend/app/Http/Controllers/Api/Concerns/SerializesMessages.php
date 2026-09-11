<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Message;
use App\Models\User;
use App\Support\ReactionEmojis;

trait SerializesMessages
{
    /** Full allowlist for reaction validation — shared with Feed/Feed Comments. */
    public const MESSAGE_ALLOWED_REACTIONS = ReactionEmojis::ALLOWED;

    /**
     * @return array<string, mixed>
     */
    protected function serializeMessage(Message $message, User $viewer): array
    {
        $isDeleted = $message->deleted_at !== null;
        $isMine = (int) $message->sender_user_id === (int) $viewer->id;

        $reactions = (! $isDeleted && $message->relationLoaded('reactions'))
            ? $message->reactions
            : collect();
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

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            // The real body is never sent to ordinary participants once a
            // message is tombstoned — it stays in the database (untouched)
            // for moderation/audit purposes only.
            'body' => $isDeleted ? null : $message->body,
            'sender' => $this->serializeFeedAuthor($message->sender),
            'created_date' => $message->created_date,
            'is_mine' => $isMine,
            'is_edited' => ! $isDeleted && filled($message->edited_at),
            'edited_at' => $isDeleted ? null : $message->edited_at?->toISOString(),
            'is_deleted' => $isDeleted,
            'deleted_at' => $message->deleted_at?->toISOString(),
            'can_edit' => $isMine && ! $isDeleted,
            'can_delete' => $isMine && ! $isDeleted,
            'reaction_counts' => $reactionCounts,
            'my_reaction' => $myReaction,
            'available_reactions' => ReactionEmojis::QUICK,
        ];
    }
}
