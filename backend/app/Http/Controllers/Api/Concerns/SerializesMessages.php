<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use App\Services\MentionService;
use App\Support\FeedLinks;
use App\Support\ReactionEmojis;
use Illuminate\Support\Collection;

trait SerializesMessages
{
    /** Full allowlist for reaction validation — shared with Feed/Feed Comments. */
    public const MESSAGE_ALLOWED_REACTIONS = ReactionEmojis::ALLOWED;

    private const SHARED_POST_EXCERPT_MAX = 200;

    /**
     * @param  array<int, array<string, mixed>>|null  $sharedPosts  Preloaded previews keyed by post id
     *                                                              (see sharedPostPreviews). Null resolves this message alone.
     * @return array<string, mixed>
     */
    protected function serializeMessage(Message $message, User $viewer, ?array $sharedPosts = null): array
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

        $sharedPostId = $isDeleted ? null : $this->sharedPostIdFromBody($message->body);
        $sharedPost = null;
        if ($sharedPostId !== null) {
            $sharedPosts ??= $this->sharedPostPreviews(collect([$message]), $viewer);
            $sharedPost = $sharedPosts[$sharedPostId] ?? ['id' => $sharedPostId, 'is_available' => false];
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
            'shared_post' => $sharedPost,
            'reply_to' => $isDeleted ? null : $this->serializeReplyTo($message, $viewer),
        ];
    }

    /**
     * Short quote of the message being replied to. A tombstoned original keeps
     * the link but never exposes its body.
     *
     * @return array<string, mixed>|null
     */
    private function serializeReplyTo(Message $message, User $viewer): ?array
    {
        // Callers eager-load replyTo.sender for thread/single-message responses;
        // inbox rows skip it to avoid a query per conversation.
        if (! $message->reply_to_message_id || ! $message->relationLoaded('replyTo')) {
            return null;
        }

        $original = $message->replyTo;

        if (! $original) {
            return null;
        }

        $isDeleted = $original->deleted_at !== null;

        return [
            'id' => $original->id,
            'sender' => $original->sender ? [
                'id' => $original->sender->id,
                'name' => $original->sender->displayName(),
            ] : null,
            'is_mine' => (int) $original->sender_user_id === (int) $viewer->id,
            'is_deleted' => $isDeleted,
            'excerpt' => $isDeleted ? null : $this->replyExcerpt((string) $original->body),
        ];
    }

    private function replyExcerpt(string $body): string
    {
        $text = preg_replace(MentionService::TOKEN_PATTERN, '@$2', $body) ?? $body;
        if (preg_match(FeedLinks::SHARE_LINK_PATTERN, $text)) {
            $text = trim(preg_replace(FeedLinks::SHARE_LINK_PATTERN, '', $text) ?? '');
            $text = $text !== '' ? $text : 'Shared a post';
        }
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);

        return mb_strlen($text) > 120 ? rtrim(mb_substr($text, 0, 119)).'…' : $text;
    }

    /**
     * Load previews for every post shared across these messages in one query,
     * limited to posts the viewer can see in the feed.
     *
     * @param  Collection<int, Message>  $messages
     * @return array<int, array<string, mixed>>
     */
    protected function sharedPostPreviews(Collection $messages, User $viewer): array
    {
        $postIds = $messages
            ->filter(fn (Message $message) => $message->deleted_at === null)
            ->map(fn (Message $message) => $this->sharedPostIdFromBody($message->body))
            ->filter()
            ->unique()
            ->values();

        if ($postIds->isEmpty()) {
            return [];
        }

        return Post::query()
            ->visibleTo($viewer)
            ->whereNull('deleted_at')
            ->whereIn('id', $postIds)
            ->with('author.department')
            ->get()
            ->mapWithKeys(fn (Post $post) => [$post->id => $this->serializeSharedPost($post)])
            ->all();
    }

    private function sharedPostIdFromBody(?string $body): ?int
    {
        if (! $body || ! preg_match(FeedLinks::SHARE_LINK_PATTERN, $body, $match)) {
            return null;
        }

        return (int) $match[1];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeSharedPost(Post $post): array
    {
        $imageUrls = $post->resolvedImageUrls();

        return [
            'id' => $post->id,
            'is_available' => true,
            'author' => $this->serializeFeedAuthor($post->author),
            'excerpt' => $this->sharedPostExcerpt((string) $post->body),
            'image_url' => $imageUrls[0] ?? null,
            'image_count' => count($imageUrls),
            'created_date' => $post->created_date,
            'path' => FeedLinks::post($post->id),
        ];
    }

    private function sharedPostExcerpt(string $body): string
    {
        $text = preg_replace(MentionService::TOKEN_PATTERN, '@$2', $body) ?? $body;
        $text = preg_replace('/<br\s*\/?>|<\/p>|<\/li>/i', ' ', $text) ?? $text;
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);

        if (mb_strlen($text) > self::SHARED_POST_EXCERPT_MAX) {
            return rtrim(mb_substr($text, 0, self::SHARED_POST_EXCERPT_MAX - 1)).'…';
        }

        return $text;
    }
}
