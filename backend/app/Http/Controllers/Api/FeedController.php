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
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'focus_post' => ['sometimes', 'integer', 'min:1'],
        ]);

        $limit = (int) ($validated['limit'] ?? 30);
        $focusPostId = isset($validated['focus_post']) ? (int) $validated['focus_post'] : null;

        $posts = Post::query()
            ->visibleTo($viewer)
            ->with(['author.department', 'reactions'])
            ->withCount(['comments', 'edits'])
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn (Post $post) => $this->serializePost($post, $viewer));

        $broadcasts = $this->activeBroadcastsQuery($viewer)
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
            'total' => $items->count(),
        ]);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, array<string, mixed>>  $items
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    private function ensurePostInFeedItems($items, int $postId, User $viewer)
    {
        $alreadyPresent = $items->contains(
            fn (array $item) => ($item['type'] ?? null) === 'post' && (int) $item['id'] === $postId
        );

        if ($alreadyPresent) {
            return $items;
        }

        $post = Post::query()
            ->visibleTo($viewer)
            ->with(['author.department', 'reactions'])
            ->withCount(['comments', 'edits'])
            ->find($postId);

        if (! $post) {
            return $items;
        }

        return $items
            ->push($this->serializePost($post, $viewer))
            ->sortByDesc(fn (array $item) => $item['created_date'])
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
