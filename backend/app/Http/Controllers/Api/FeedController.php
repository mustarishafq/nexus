<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Api\Concerns\SerializesPosts;
use App\Http\Controllers\Controller;
use App\Models\Broadcast;
use App\Models\Post;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\BroadcastAudience;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Throwable;

class FeedController extends Controller
{
    use SerializesFeedAuthors;
    use SerializesPosts;

    public function index(Request $request): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'author_user_id' => ['sometimes', 'integer', 'min:1', 'exists:users,id'],
            'focus_post' => ['sometimes', 'integer', 'min:1'],
            'before' => ['sometimes', 'string', 'max:120'],
            'limit' => [
                'sometimes',
                'integer',
                'min:1',
                Rule::when(
                    $request->filled('author_user_id'),
                    ['max:100'],
                    ['max:50']
                ),
            ],
        ]);

        $authorUserId = isset($validated['author_user_id']) ? (int) $validated['author_user_id'] : null;
        $defaultLimit = $authorUserId ? 100 : 30;
        $limit = (int) ($validated['limit'] ?? $defaultLimit);
        $focusPostId = isset($validated['focus_post']) ? (int) $validated['focus_post'] : null;
        $cursor = $this->parseFeedCursor($validated['before'] ?? null);

        $postsQuery = Post::query()->visibleTo($viewer);

        if ($authorUserId) {
            $postsQuery->where('author_user_id', $authorUserId);
        }

        // Profile / author filter: posts only (no broadcasts).
        if ($authorUserId) {
            $total = (int) (clone $postsQuery)->count();
            $fetchLimit = $limit + 1;
            $pageQuery = $this->applyFeedCursor(clone $postsQuery, $cursor, 'post');
            $pageItems = $pageQuery
                ->with(['author.department', 'reactions', 'polls.options', 'polls.votes'])
                ->withCount(['comments', 'edits', 'views', 'reaches'])
                ->withExists(['views as viewer_has_seen' => fn (Builder $views) => $views->where('user_id', $viewer->id)])
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit($fetchLimit)
                ->get()
                ->map(fn (Post $post) => $this->serializePost($post, $viewer))
                ->values();

            $hasMore = $pageItems->count() > $limit;
            $items = $pageItems->take($limit)->values();

            // Deep-link pin only on the first page.
            if ($focusPostId && ! $cursor) {
                $items = $this->ensurePostInFeedItems($items, $focusPostId, $viewer, $authorUserId);
            }

            return response()->json([
                'items' => $items,
                'total' => $total,
                'unseen_count' => 0,
                'has_more' => $hasMore,
                'next_before' => $hasMore && $items->isNotEmpty()
                    ? $this->encodeFeedCursor($items->last())
                    : null,
            ]);
        }

        $broadcastsQuery = $this->activeBroadcastsQuery($viewer);
        $total = (int) $postsQuery->count() + (int) (clone $broadcastsQuery)->count();
        $unseenCount = (int) Post::query()
            ->visibleTo($viewer)
            ->where('approval_status', Post::APPROVAL_APPROVED)
            ->where('author_user_id', '!=', $viewer->id)
            ->whereDoesntHave('views', fn (Builder $views) => $views->where('user_id', $viewer->id))
            ->count();

        $fetchLimit = $limit + 1;

        $posts = $this->applyFeedCursor(clone $postsQuery, $cursor, 'post')
            ->with(['author.department', 'reactions', 'polls.options', 'polls.votes'])
            ->withCount(['comments', 'edits', 'views', 'reaches'])
            ->withExists(['views as viewer_has_seen' => fn (Builder $views) => $views->where('user_id', $viewer->id)])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($fetchLimit)
            ->get()
            ->map(fn (Post $post) => $this->serializePost($post, $viewer));

        $broadcasts = $this->applyFeedCursor(clone $broadcastsQuery, $cursor, 'broadcast')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($fetchLimit)
            ->get()
            ->map(fn (Broadcast $broadcast) => $this->serializeBroadcast($broadcast));

        $merged = $this->sortFeedItems($posts->merge($broadcasts));
        $hasMore = $merged->count() > $limit;
        $items = $merged->take($limit)->values();

        // Deep-link pin only on the first page.
        if ($focusPostId && ! $cursor) {
            $items = $this->ensurePostInFeedItems($items, $focusPostId, $viewer);
        }

        $nextBefore = null;
        if ($hasMore) {
            // Cursor must track the chronological page, not a pinned deep-link post.
            $cursorSource = $merged->take($limit)->values();
            if ($cursorSource->isNotEmpty()) {
                $nextBefore = $this->encodeFeedCursor($cursorSource->last());
            }
        }

        return response()->json([
            'items' => $items,
            'total' => $total,
            'unseen_count' => $unseenCount,
            'has_more' => $hasMore,
            'next_before' => $nextBefore,
        ]);
    }

    public function activeDiscussions(Request $request): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);

        $limit = (int) ($validated['limit'] ?? 5);
        $since = now()->subDays(7);

        $items = Post::query()
            ->visibleTo($viewer)
            ->where(function (Builder $query) use ($since) {
                $query->where('created_at', '>=', $since)
                    ->orWhereHas('reactions', fn (Builder $reactions) => $reactions->where('created_at', '>=', $since))
                    ->orWhereHas('comments', fn (Builder $comments) => $comments->where('created_at', '>=', $since));
            })
            ->where(function (Builder $query) {
                $query->whereHas('reactions')
                    ->orWhereHas('comments');
            })
            ->with(['author.department', 'reactions', 'polls.options', 'polls.votes'])
            ->withCount(['comments', 'reactions', 'edits', 'views', 'reaches'])
            ->orderByRaw('(comments_count + reactions_count) DESC')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (Post $post) => $this->serializePost($post, $viewer))
            ->values();

        return response()->json([
            'items' => $items,
        ]);
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $items
     * @return Collection<int, array<string, mixed>>
     */
    private function ensurePostInFeedItems($items, int $postId, User $viewer, ?int $authorUserId = null)
    {
        $isFocusedPost = static fn (array $item): bool => ($item['type'] ?? null) === 'post'
            && (int) ($item['id'] ?? 0) === $postId;

        $existing = $items->first($isFocusedPost);

        if ($existing) {
            // Pin the deep-linked post to the top so clients don't scroll past
            // a full page of newer items looking for an older post.
            return collect([$existing])
                ->merge($items->reject($isFocusedPost)->values())
                ->values();
        }

        $postQuery = Post::query()->visibleTo($viewer);

        if ($authorUserId) {
            $postQuery->where('author_user_id', $authorUserId);
        }

        $post = $postQuery
            ->with(['author.department', 'reactions', 'polls.options', 'polls.votes'])
            ->withCount(['comments', 'edits', 'views', 'reaches'])
            ->withExists(['views as viewer_has_seen' => fn (Builder $views) => $views->where('user_id', $viewer->id)])
            ->find($postId);

        if (! $post) {
            return $items;
        }

        return collect([$this->serializePost($post, $viewer)])
            ->merge($items->values())
            ->values();
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeBroadcast(Broadcast $broadcast): array
    {
        return [
            'type' => 'broadcast',
            'id' => $broadcast->id,
            'title' => $broadcast->title,
            'message' => $broadcast->message,
            'priority' => $broadcast->priority ?? 'medium',
            'created_date' => $broadcast->created_date,
            'can_delete' => false,
        ];
    }

    private function activeBroadcastsQuery(User $viewer): Builder
    {
        $now = now();

        $query = Broadcast::query()
            ->where(function ($inner) use ($now) {
                $inner->whereNull('broadcast_starts_at')
                    ->orWhere('broadcast_starts_at', '<=', $now);
            })
            ->where(function ($inner) use ($now) {
                $inner->whereNull('broadcast_ends_at')
                    ->orWhere('broadcast_ends_at', '>=', $now);
            });

        return BroadcastAudience::scopeVisibleToUser($query, $viewer);
    }

    /**
     * Stable feed order: newest created_at, then broadcasts before posts, then higher id.
     *
     * @param  Collection<int, array<string, mixed>>  $items
     * @return Collection<int, array<string, mixed>>
     */
    private function sortFeedItems(Collection $items): Collection
    {
        return $items
            ->sort(function (array $a, array $b): int {
                $cmp = strcmp((string) ($b['created_date'] ?? ''), (string) ($a['created_date'] ?? ''));
                if ($cmp !== 0) {
                    return $cmp;
                }

                $rankA = ($a['type'] ?? '') === 'broadcast' ? 0 : 1;
                $rankB = ($b['type'] ?? '') === 'broadcast' ? 0 : 1;
                if ($rankA !== $rankB) {
                    return $rankA <=> $rankB;
                }

                return ((int) ($b['id'] ?? 0)) <=> ((int) ($a['id'] ?? 0));
            })
            ->values();
    }

    /**
     * @return array{created_at: Carbon, type: string, id: int, type_rank: int}|null
     */
    private function parseFeedCursor(?string $before): ?array
    {
        if ($before === null || $before === '') {
            return null;
        }

        $parts = explode('|', $before, 3);
        if (count($parts) !== 3) {
            return null;
        }

        [$createdDate, $type, $id] = $parts;
        if (! in_array($type, ['post', 'broadcast'], true)) {
            return null;
        }
        if (! ctype_digit((string) $id)) {
            return null;
        }

        try {
            // created_date is ISO-8601 UTC; DB created_at is stored in app timezone.
            $createdAt = Carbon::parse($createdDate)->timezone(config('app.timezone'));
        } catch (Throwable) {
            return null;
        }

        return [
            'created_at' => $createdAt,
            'type' => $type,
            'id' => (int) $id,
            'type_rank' => $type === 'broadcast' ? 0 : 1,
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function encodeFeedCursor(array $item): string
    {
        return ($item['created_date'] ?? '').'|'.($item['type'] ?? '').'|'.($item['id'] ?? '');
    }

    /**
     * Restrict a posts/broadcasts query to items older than the cursor in feed order.
     */
    private function applyFeedCursor(Builder $query, ?array $cursor, string $itemType): Builder
    {
        if (! $cursor) {
            return $query;
        }

        $typeRank = $itemType === 'broadcast' ? 0 : 1;
        $cursorAt = $cursor['created_at'];
        $cursorRank = $cursor['type_rank'];
        $cursorId = $cursor['id'];

        return $query->where(function (Builder $outer) use ($cursorAt, $typeRank, $cursorRank, $cursorId) {
            $outer->where('created_at', '<', $cursorAt);

            if ($typeRank > $cursorRank) {
                // Same timestamp, but this type sorts after the cursor type.
                $outer->orWhere('created_at', '=', $cursorAt);
            } elseif ($typeRank === $cursorRank) {
                $outer->orWhere(function (Builder $tie) use ($cursorAt, $cursorId) {
                    $tie->where('created_at', '=', $cursorAt)
                        ->where('id', '<', $cursorId);
                });
            }
        });
    }

    private function authenticatedUser(Request $request): ?User
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return null;
        }

        return $user;
    }
}
