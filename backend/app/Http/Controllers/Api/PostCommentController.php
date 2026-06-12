<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use App\Services\FeedNotificationService;
use App\Services\MentionService;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostCommentController extends Controller
{
    use SerializesFeedAuthors;

    public function index(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $comments = $post->comments()
            ->with('author.department')
            ->orderBy('created_at')
            ->limit(100)
            ->get()
            ->map(fn (PostComment $comment) => $this->serializeComment($comment, $viewer))
            ->values();

        return response()->json([
            'comments' => $comments,
        ]);
    }

    public function store(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:1000'],
        ]);

        $body = trim($validated['body']);

        $comment = $post->comments()->create([
            'author_user_id' => $viewer->id,
            'body' => $body,
        ]);

        app(MentionService::class)->notifyMentionedUsers(
            $viewer,
            $body,
            'comment',
            '/feed'
        );

        app(FeedNotificationService::class)->notifyPostAuthorOnComment($post, $viewer, $body);

        $comment->load('author');

        return response()->json([
            'comment' => $this->serializeComment($comment, $viewer),
        ], 201);
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

        $postComment->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeComment(PostComment $comment, User $viewer): array
    {
        return [
            'id' => $comment->id,
            'post_id' => $comment->post_id,
            'body' => $comment->body,
            'author' => $this->serializeFeedAuthor($comment->author),
            'created_date' => $comment->created_date,
            'can_delete' => $viewer->id === $comment->author_user_id || $viewer->role === 'admin',
        ];
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
