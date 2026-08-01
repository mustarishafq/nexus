<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Api\Concerns\SerializesPosts;
use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\PostReaction;
use App\Models\User;
use App\Services\GamificationService;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PostReactionController extends Controller
{
    use SerializesFeedAuthors;
    use SerializesPosts;

    public function store(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensurePostIsInteractable($post)) {
            return $response;
        }

        $validated = $request->validate([
            'reaction' => ['required', 'string', Rule::in(self::POST_REACTIONS)],
        ]);

        $existing = PostReaction::query()
            ->where('post_id', $post->id)
            ->where('user_id', $viewer->id)
            ->first();

        $createdNew = false;

        if ($existing && $existing->reaction === $validated['reaction']) {
            $existing->delete();
        } else {
            $createdNew = $existing === null;
            PostReaction::query()->updateOrCreate(
                [
                    'post_id' => $post->id,
                    'user_id' => $viewer->id,
                ],
                [
                    'reaction' => $validated['reaction'],
                ]
            );
        }

        $post->load(['author', 'reactions', 'polls.options', 'polls.votes'])->loadCount('comments');

        $payload = [
            'item' => $this->serializePost($post, $viewer),
        ];

        if ($createdNew && (int) $post->author_user_id !== (int) $viewer->id) {
            $offer = app(GamificationService::class)->offer(
                $viewer,
                'feed_react',
                'post_reaction',
                $post->id.'-'.$viewer->id,
            );
            $payload = array_merge($payload, app(GamificationService::class)->offerPayload($offer));
        }

        return response()->json($payload);
    }

    public function destroy(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensurePostIsInteractable($post)) {
            return $response;
        }

        PostReaction::query()
            ->where('post_id', $post->id)
            ->where('user_id', $viewer->id)
            ->delete();

        $post->load(['author', 'reactions', 'polls.options', 'polls.votes'])->loadCount('comments');

        return response()->json([
            'item' => $this->serializePost($post, $viewer),
        ]);
    }

    private function authenticatedUser(Request $request): ?User
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return null;
        }

        return $user;
    }

    private function ensurePostIsInteractable(Post $post): ?JsonResponse
    {
        if ($post->isApproved()) {
            return null;
        }

        return response()->json(['message' => 'This post is awaiting approval.'], 422);
    }
}
