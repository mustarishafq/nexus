<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Api\Concerns\SerializesPosts;
use App\Http\Controllers\Controller;
use App\Models\Broadcast;
use App\Models\Post;
use App\Models\User;
use App\Support\ApiTokenAuth;
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
        ]);

        $limit = (int) ($validated['limit'] ?? 30);

        $posts = Post::query()
            ->with(['author.department', 'reactions'])
            ->withCount('comments')
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn (Post $post) => $this->serializePost($post, $viewer));

        $broadcasts = $this->activeBroadcastsQuery()
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

        return response()->json([
            'items' => $items,
            'total' => $items->count(),
        ]);
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

    private function activeBroadcastsQuery(): Builder
    {
        $now = now();

        return Broadcast::query()
            ->where(function ($inner) use ($now) {
                $inner->whereNull('broadcast_starts_at')
                    ->orWhere('broadcast_starts_at', '<=', $now);
            })
            ->where(function ($inner) use ($now) {
                $inner->whereNull('broadcast_ends_at')
                    ->orWhere('broadcast_ends_at', '>=', $now);
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
