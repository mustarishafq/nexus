<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Api\Concerns\SerializesPostComments;
use App\Http\Controllers\Api\Concerns\SerializesPosts;
use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use App\Services\FeedNotificationService;
use App\Services\GamificationService;
use App\Services\MentionService;
use App\Services\PermissionService;
use App\Support\ApiTokenAuth;
use App\Support\FeedLinks;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class PostCommentController extends Controller
{
    use SerializesFeedAuthors;
    use SerializesPostComments;
    use SerializesPosts;

    public function index(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensurePostIsVisible($post, $viewer)) {
            return $response;
        }

        $allComments = $post->comments()
            ->with(['author.department', 'reactions'])
            ->orderBy('created_at')
            ->limit(200)
            ->get();

        $comments = $allComments
            ->filter(fn (PostComment $comment) => $comment->parent_comment_id === null)
            ->values()
            ->map(fn (PostComment $comment) => $this->serializeCommentTree($comment, $allComments, $viewer))
            ->all();

        return response()->json([
            'comments' => $comments,
        ]);
    }

    /**
     * @param  Collection<int, PostComment>  $allComments
     * @return array<string, mixed>
     */
    private function serializeCommentTree(PostComment $comment, $allComments, User $viewer): array
    {
        $payload = $this->serializeComment($comment, $viewer);
        $payload['replies'] = $allComments
            ->filter(fn (PostComment $child) => (int) ($child->parent_comment_id ?? 0) === (int) $comment->id)
            ->values()
            ->map(fn (PostComment $child) => $this->serializeCommentTree($child, $allComments, $viewer))
            ->all();

        return $payload;
    }

    public function store(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensurePostIsInteractable($post, $viewer)) {
            return $response;
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:1000'],
            'parent_comment_id' => ['nullable', 'integer', 'exists:post_comments,id'],
        ]);

        $body = trim($validated['body']);
        $parentCommentId = isset($validated['parent_comment_id'])
            ? (int) $validated['parent_comment_id']
            : null;
        $parentComment = null;

        if ($parentCommentId !== null) {
            $parentComment = PostComment::query()
                ->where('id', $parentCommentId)
                ->where('post_id', $post->id)
                ->first();

            if (! $parentComment) {
                return response()->json(['message' => 'Parent comment not found on this post.'], 422);
            }
        }

        $comment = $post->comments()->create([
            'author_user_id' => $viewer->id,
            'parent_comment_id' => $parentCommentId,
            'body' => $body,
        ]);

        app(MentionService::class)->notifyMentionedUsers(
            $viewer,
            $body,
            'comment',
            FeedLinks::post($post->id, expandComments: true),
            [],
            ['post_id' => $post->id]
        );

        if ($parentComment) {
            app(FeedNotificationService::class)->notifyCommentAuthorOnReply($post, $parentComment, $viewer, $body);

            if ((int) $post->author_user_id !== (int) $parentComment->author_user_id) {
                app(FeedNotificationService::class)->notifyPostAuthorOnComment($post, $viewer, $body);
            }
        } else {
            app(FeedNotificationService::class)->notifyPostAuthorOnComment($post, $viewer, $body);
        }

        $comment->load(['author.department', 'reactions']);

        $offer = app(GamificationService::class)->offer($viewer, 'feed_comment', 'post_comment', $comment->id);

        return response()->json(array_merge([
            'comment' => $this->serializeComment($comment, $viewer),
        ], app(GamificationService::class)->offerPayload($offer)), 201);
    }

    public function destroy(Request $request, PostComment $postComment): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($viewer->id !== $postComment->author_user_id && $viewer->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $postComment->loadMissing('post');
        $post = $postComment->post;
        if (! $post) {
            return response()->json(['message' => 'Post not found.'], 404);
        }
        if ($response = $this->rejectIfPostDeleted($post)) {
            return $response;
        }

        $postComment->delete();

        return response()->json(null, 204);
    }

    private function authenticatedUser(Request $request): ?User
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return null;
        }

        return $user;
    }

    private function ensurePostIsVisible(Post $post, User $viewer): ?JsonResponse
    {
        $visible = Post::query()
            ->visibleTo($viewer)
            ->whereKey($post->id)
            ->exists();

        if (! $visible) {
            return response()->json(['message' => 'Post not found.'], 404);
        }

        return null;
    }

    private function ensurePostIsInteractable(Post $post, User $viewer): ?JsonResponse
    {
        if ($response = $this->ensurePostIsVisible($post, $viewer)) {
            return $response;
        }

        if ($response = $this->rejectIfPostDeleted($post)) {
            return $response;
        }

        if ($post->isApproved()) {
            return null;
        }

        if ($post->isPending() && ((int) $post->author_user_id === (int) $viewer->id || PermissionService::can($viewer, PermissionCatalog::FEED_MODERATE))) {
            return response()->json(['message' => 'This post is awaiting approval.'], 422);
        }

        return response()->json(['message' => 'Post not found.'], 404);
    }
}
