<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Api\Concerns\SerializesPosts;
use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\User;
use App\Services\MentionService;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostController extends Controller
{
    use SerializesFeedAuthors;
    use SerializesPosts;

    public function store(Request $request): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:2000'],
            'image_url' => ['nullable', 'string', 'max:2048'],
        ]);

        $body = trim($validated['body'] ?? '');
        $imageUrl = filled($validated['image_url'] ?? null) ? trim($validated['image_url']) : null;

        if ($body === '' && $imageUrl === null) {
            return response()->json(['message' => 'Post must include text or an image.'], 422);
        }

        $post = Post::create([
            'author_user_id' => $viewer->id,
            'body' => $body,
            'image_url' => $imageUrl,
        ]);

        if ($body !== '') {
            app(MentionService::class)->notifyMentionedUsers(
                $viewer,
                $body,
                'post',
                '/feed'
            );
        }

        $post->load(['author', 'reactions'])->loadCount('comments');

        return response()->json([
            'item' => $this->serializePost($post, $viewer),
        ], 201);
    }

    public function destroy(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($viewer->id !== $post->author_user_id && $viewer->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $post->delete();

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
}
