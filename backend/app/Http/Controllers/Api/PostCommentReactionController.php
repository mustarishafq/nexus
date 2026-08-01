<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Api\Concerns\SerializesPostComments;
use App\Http\Controllers\Api\Concerns\SerializesPosts;
use App\Http\Controllers\Controller;
use App\Models\PostComment;
use App\Models\PostCommentReaction;
use App\Models\User;
use App\Services\GamificationService;
use App\Support\ApiTokenAuth;
use App\Support\UserRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PostCommentReactionController extends Controller
{
    use SerializesFeedAuthors;
    use SerializesPostComments;
    use SerializesPosts;

    public function store(Request $request, PostComment $postComment): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $postComment->loadMissing('post');

        if ($response = $this->ensureCommentIsInteractable($postComment, $viewer)) {
            return $response;
        }

        $validated = $request->validate([
            'reaction' => ['required', 'string', Rule::in(self::POST_REACTIONS)],
        ]);

        $existing = PostCommentReaction::query()
            ->where('post_comment_id', $postComment->id)
            ->where('user_id', $viewer->id)
            ->first();

        $createdNew = false;

        if ($existing && $existing->reaction === $validated['reaction']) {
            $existing->delete();
        } else {
            $createdNew = $existing === null;
            PostCommentReaction::query()->updateOrCreate(
                [
                    'post_comment_id' => $postComment->id,
                    'user_id' => $viewer->id,
                ],
                [
                    'reaction' => $validated['reaction'],
                ]
            );
        }

        $postComment->load(['author.department', 'reactions']);

        $payload = [
            'comment' => $this->serializeComment($postComment, $viewer),
        ];

        if ($createdNew && (int) $postComment->author_user_id !== (int) $viewer->id) {
            $offer = app(GamificationService::class)->offer(
                $viewer,
                'feed_comment_react',
                'post_comment_reaction',
                $postComment->id.'-'.$viewer->id,
            );
            $payload = array_merge($payload, app(GamificationService::class)->offerPayload($offer));
        }

        return response()->json($payload);
    }

    public function destroy(Request $request, PostComment $postComment): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $postComment->loadMissing('post');

        if ($response = $this->ensureCommentIsInteractable($postComment, $viewer)) {
            return $response;
        }

        PostCommentReaction::query()
            ->where('post_comment_id', $postComment->id)
            ->where('user_id', $viewer->id)
            ->delete();

        $postComment->load(['author.department', 'reactions']);

        return response()->json([
            'comment' => $this->serializeComment($postComment, $viewer),
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

    private function ensureCommentIsInteractable(PostComment $comment, User $viewer): ?JsonResponse
    {
        $post = $comment->post;

        if (! $post) {
            return response()->json(['message' => 'Post not found.'], 404);
        }

        if ($post->isApproved()) {
            return null;
        }

        if ($post->isPending() && ((int) $post->author_user_id === (int) $viewer->id || UserRoles::isHrOrAdmin($viewer))) {
            return response()->json(['message' => 'This post is awaiting approval.'], 422);
        }

        return response()->json(['message' => 'Post not found.'], 404);
    }
}
