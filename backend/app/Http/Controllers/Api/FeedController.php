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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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

        $postsQuery = Post::query()->visibleTo($viewer);

        if ($authorUserId) {
            $postsQuery->where('author_user_id', $authorUserId);
        }

        // Profile / author filter: posts only (no broadcasts).
        if ($authorUserId) {
            $total = (int) (clone $postsQuery)->count();
            $items = (clone $postsQuery)
                ->with(['author.department', 'reactions', 'polls.options', 'polls.votes'])
                ->withCount(['comments', 'edits', 'views', 'reaches'])
                ->withExists(['views as viewer_has_seen' => fn (Builder $views) => $views->where('user_id', $viewer->id)])
                ->latest()
                ->limit($limit)
                ->get()
                ->map(fn (Post $post) => $this->serializePost($post, $viewer))
                ->values();

            if ($focusPostId) {
                $items = $this->ensurePostInFeedItems($items, $focusPostId, $viewer, $authorUserId);
            }

            return response()->json([
                'items' => $items,
                'total' => $total,
                'unseen_count' => 0,
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

        $posts = (clone $postsQuery)
            ->with(['author.department', 'reactions', 'polls.options', 'polls.votes'])
            ->withCount(['comments', 'edits', 'views', 'reaches'])
            ->withExists(['views as viewer_has_seen' => fn (Builder $views) => $views->where('user_id', $viewer->id)])
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn (Post $post) => $this->serializePost($post, $viewer));

        $broadcasts = (clone $broadcastsQuery)
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn (Broadcast $broadcast) => $this->serializeBroadcast($broadcast));

        $items = $posts
            ->merge($broadcasts)
            ->sortByDesc(fn (array $item) => $item['created_date'])
            ->values()
            ->take($limit)
            ->values();

        if ($focusPostId) {
            $items = $this->ensurePostInFeedItems($items, $focusPostId, $viewer);
        }

        return response()->json([
            'items' => $items,
            'total' => $total,
            'unseen_count' => $unseenCount,
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
     * @param  \Illuminate\Support\Collection<int, array<string, mixed>>  $items
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
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

    private function authenticatedUser(Request $request): ?User
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return null;
        }

        return $user;
    }
}
