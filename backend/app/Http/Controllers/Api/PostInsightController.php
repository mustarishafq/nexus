<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\PostReach;
use App\Models\PostView;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\UserRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostInsightController extends Controller
{
    use SerializesFeedAuthors;

    public function markSeenBatch(Request $request): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'post_ids' => ['required', 'array', 'min:1', 'max:50'],
            'post_ids.*' => ['integer', 'min:1'],
        ]);

        $postIds = collect($validated['post_ids'])
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $visiblePosts = Post::query()
            ->visibleTo($viewer)
            ->whereIn('id', $postIds)
            ->where('approval_status', Post::APPROVAL_APPROVED)
            ->where('author_user_id', '!=', $viewer->id)
            ->get(['id']);

        $now = now();
        $marked = [];

        foreach ($visiblePosts as $post) {
            PostView::query()->firstOrCreate(
                [
                    'post_id' => $post->id,
                    'user_id' => $viewer->id,
                ],
                [
                    'seen_at' => $now,
                ]
            );
            $marked[] = $post->id;
        }

        return response()->json([
            'marked_post_ids' => $marked,
        ]);
    }

    public function markSeen(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->viewerCanSeePost($viewer, $post)) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $post->isApproved() || (int) $post->author_user_id === (int) $viewer->id) {
            return response()->json([
                'marked' => false,
            ]);
        }

        PostView::query()->firstOrCreate(
            [
                'post_id' => $post->id,
                'user_id' => $viewer->id,
            ],
            [
                'seen_at' => now(),
            ]
        );

        return response()->json([
            'marked' => true,
        ]);
    }

    public function listSeen(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->viewerCanSeePost($viewer, $post)) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $this->viewerCanViewInsights($viewer, $post)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $views = PostView::query()
            ->where('post_id', $post->id)
            ->with(['user.department'])
            ->orderByDesc('seen_at')
            ->limit(200)
            ->get()
            ->map(function (PostView $view) {
                return [
                    'user' => $this->serializeFeedAuthor($view->user),
                    'seen_at' => $view->seen_at?->toISOString(),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'views' => $views,
            'total' => count($views),
        ]);
    }

    public function listReaches(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->viewerCanSeePost($viewer, $post)) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $this->viewerCanViewInsights($viewer, $post)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $reaches = PostReach::query()
            ->where('post_id', $post->id)
            ->with(['user.department'])
            ->orderByDesc('reached_at')
            ->limit(200)
            ->get()
            ->map(function (PostReach $reach) {
                return [
                    'user' => $this->serializeFeedAuthor($reach->user),
                    'reached_at' => $reach->reached_at?->toISOString(),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'reaches' => $reaches,
            'total' => count($reaches),
        ]);
    }

    private function viewerCanSeePost(User $viewer, Post $post): bool
    {
        return Post::query()
            ->visibleTo($viewer)
            ->whereKey($post->id)
            ->exists();
    }

    private function viewerCanViewInsights(User $viewer, Post $post): bool
    {
        return (int) $viewer->id === (int) $post->author_user_id
            || UserRoles::isHrOrAdmin($viewer);
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
