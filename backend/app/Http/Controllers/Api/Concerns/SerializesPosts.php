<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Post;
use App\Models\PostPoll;
use App\Models\User;
use App\Services\PermissionService;
use App\Support\PermissionCatalog;
use App\Support\ReactionEmojis;

trait SerializesPosts
{
    /** @deprecated Use ReactionEmojis::QUICK — kept for callers that reference POST_REACTIONS. */
    public const POST_REACTIONS = ReactionEmojis::QUICK;

    /** Full allowlist for reaction validation. */
    public const POST_ALLOWED_REACTIONS = ReactionEmojis::ALLOWED;

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
        $canModerate = PermissionService::can($viewer, PermissionCatalog::FEED_MODERATE);
        $imageUrls = $post->resolvedImageUrls();
        $isAuthor = (int) $viewer->id === (int) $post->author_user_id;
        $editsCount = (int) ($post->edits_count ?? $post->edits()->count());
        $isEdited = $editsCount > 0 || filled($post->edited_at);
        $seenCount = (int) ($post->views_count ?? $post->views()->count());
        $reachCount = (int) ($post->reaches_count ?? $post->reaches()->count());
        $canViewInsights = $isAuthor || $canModerate;
        $polls = $this->serializePostPolls($post, $viewer, $isAuthor);
        $viewerHasSeen = $isAuthor || $this->viewerHasSeenPost($post, $viewer);

        return [
            'type' => 'post',
            'id' => $post->id,
            'body' => $post->body,
            'image_url' => $imageUrls[0] ?? null,
            'image_urls' => $imageUrls,
            'polls' => $polls,
            // Back-compat for older clients that still read a single poll.
            'poll' => $polls[0] ?? null,
            'approval_status' => $post->approval_status ?? Post::APPROVAL_APPROVED,
            'author' => $this->serializeFeedAuthor($post->author),
            'comments_count' => (int) ($post->comments_count ?? $post->comments()->count()),
            'reactions_count' => $reactionsCount,
            'reaction_counts' => $reactionCounts,
            'my_reaction' => $myReaction,
            'available_reactions' => ReactionEmojis::QUICK,
            'seen_count' => $seenCount,
            'reach_count' => $reachCount,
            'viewer_has_seen' => $viewerHasSeen,
            'can_view_insights' => $canViewInsights,
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

    protected function viewerHasSeenPost(Post $post, User $viewer): bool
    {
        if (isset($post->viewer_has_seen)) {
            return (bool) $post->viewer_has_seen;
        }

        if ($post->relationLoaded('views')) {
            return $post->views->contains(
                fn ($view) => (int) $view->user_id === (int) $viewer->id
            );
        }

        return $post->views()->where('user_id', $viewer->id)->exists();
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function serializePostPolls(Post $post, User $viewer, bool $isAuthor = false): array
    {
        $polls = $post->relationLoaded('polls')
            ? $post->polls
            : $post->polls()->with(['options', 'votes'])->get();

        return $polls
            ->map(fn (PostPoll $poll) => $this->serializeOnePostPoll($poll, $viewer, $isAuthor))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    protected function serializeOnePostPoll(PostPoll $poll, User $viewer, bool $isAuthor = false): array
    {
        if (! $poll->relationLoaded('options')) {
            $poll->load('options');
        }

        if (! $poll->relationLoaded('votes')) {
            $poll->load('votes');
        }

        $votes = $poll->votes;
        $myOptionIds = $votes
            ->where('user_id', (int) $viewer->id)
            ->pluck('post_poll_option_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $voterCount = $votes->pluck('user_id')->unique()->count();
        $countsByOption = $votes
            ->groupBy('post_poll_option_id')
            ->map->count();
        $hasVoted = $myOptionIds !== [];
        $revealCorrect = (bool) $poll->is_qna && ($hasVoted || $isAuthor);

        $options = $poll->options->map(function ($option) use ($countsByOption, $voterCount, $myOptionIds) {
            $votesCount = (int) ($countsByOption[$option->id] ?? 0);

            return [
                'id' => $option->id,
                'label' => $option->label,
                'sort_order' => (int) $option->sort_order,
                'votes_count' => $votesCount,
                'percent' => $voterCount > 0 ? (int) round(($votesCount / $voterCount) * 100) : 0,
                'voted' => in_array((int) $option->id, $myOptionIds, true),
            ];
        })->values()->all();

        $optionCount = count($options);

        return [
            'id' => $poll->id,
            'sort_order' => (int) $poll->sort_order,
            'allow_multiple' => (bool) $poll->allow_multiple,
            'allow_add_options' => (bool) $poll->allow_add_options,
            'is_qna' => (bool) $poll->is_qna,
            'can_add_options' => (bool) $poll->allow_add_options && $optionCount < PostPoll::ABSOLUTE_MAX_OPTIONS,
            'correct_option_id' => $revealCorrect ? ($poll->correct_option_id ? (int) $poll->correct_option_id : null) : null,
            'total_votes' => $voterCount,
            'has_voted' => $hasVoted,
            'my_option_id' => $myOptionIds[0] ?? null,
            'my_option_ids' => $myOptionIds,
            'options' => $options,
        ];
    }
}
