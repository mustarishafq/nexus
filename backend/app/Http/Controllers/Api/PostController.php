<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Api\Concerns\SerializesPosts;
use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\PostEdit;
use App\Models\User;
use App\Services\FeedNotificationService;
use App\Services\MentionService;
use App\Support\ApiTokenAuth;
use App\Support\AppSettings;
use App\Support\FeedLinks;
use App\Support\UserRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            'image_urls' => ['nullable', 'array', 'max:'.Post::MAX_IMAGES],
            'image_urls.*' => ['string', 'max:2048'],
        ]);

        $body = trim($validated['body'] ?? '');
        $imageUrls = collect($validated['image_urls'] ?? [])
            ->map(fn ($url) => trim((string) $url))
            ->filter()
            ->unique()
            ->take(Post::MAX_IMAGES)
            ->values()
            ->all();

        if ($imageUrls === [] && filled($validated['image_url'] ?? null)) {
            $imageUrls = [trim((string) $validated['image_url'])];
        }

        $imageUrl = $imageUrls[0] ?? null;

        if ($body === '' && $imageUrls === []) {
            return response()->json(['message' => 'Post must include text or an image.'], 422);
        }

        $requiresApproval = AppSettings::userRequiresFeedPostApproval($viewer);
        $now = now();

        $post = Post::create([
            'author_user_id' => $viewer->id,
            'body' => $body,
            'image_url' => $imageUrl,
            'image_urls' => $imageUrls === [] ? null : $imageUrls,
            'approval_status' => $requiresApproval ? Post::APPROVAL_PENDING : Post::APPROVAL_APPROVED,
            'approved_by_user_id' => $requiresApproval ? null : $viewer->id,
            'approved_at' => $requiresApproval ? null : $now,
        ]);

        if ($requiresApproval) {
            app(FeedNotificationService::class)->notifyModeratorsOfPendingPost($post, $viewer);
        } elseif ($body !== '') {
            $this->notifyMentions($viewer, $post, $body);
        }

        $post->load(['author', 'reactions'])->loadCount(['comments', 'edits']);

        return response()->json([
            'item' => $this->serializePost($post, $viewer),
        ], 201);
    }

    public function update(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ((int) $viewer->id !== (int) $post->author_user_id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:2000'],
        ]);

        $body = trim($validated['body'] ?? '');
        $imageUrls = $post->resolvedImageUrls();

        if ($body === '' && $imageUrls === []) {
            return response()->json(['message' => 'Post must include text or an image.'], 422);
        }

        $previousBody = (string) ($post->body ?? '');
        if ($previousBody === $body) {
            $post->load(['author', 'reactions'])->loadCount(['comments', 'edits']);

            return response()->json([
                'item' => $this->serializePost($post, $viewer),
            ]);
        }

        DB::transaction(function () use ($post, $viewer, $body, $previousBody) {
            PostEdit::query()->create([
                'post_id' => $post->id,
                'editor_user_id' => $viewer->id,
                'body' => $previousBody,
            ]);

            $post->forceFill([
                'body' => $body,
                'edited_at' => now(),
            ])->save();
        });

        if ($body !== '' && ! $post->isPending()) {
            $this->notifyMentions($viewer, $post, $body);
        }

        $post->load(['author', 'reactions'])->loadCount(['comments', 'edits']);

        return response()->json([
            'item' => $this->serializePost($post, $viewer),
        ]);
    }

    public function edits(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $edits = $post->edits()
            ->with(['editor.department'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(function (PostEdit $edit) {
                return [
                    'id' => $edit->id,
                    'body' => $edit->body,
                    'created_date' => $edit->created_date,
                    'editor' => $this->serializeFeedAuthor($edit->editor),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'edits' => $edits,
        ]);
    }

    public function approve(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! UserRoles::isHrOrAdmin($viewer)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! $post->isPending()) {
            return response()->json(['message' => 'Only pending posts can be approved.'], 422);
        }

        $post->forceFill([
            'approval_status' => Post::APPROVAL_APPROVED,
            'approved_by_user_id' => $viewer->id,
            'approved_at' => now(),
        ])->save();

        $author = $post->author ?? User::query()->find($post->author_user_id);
        if ($author) {
            app(FeedNotificationService::class)->notifyAuthorOfReview($post, $viewer, true);

            $body = trim((string) $post->body);
            if ($body !== '') {
                $this->notifyMentions($author, $post, $body);
            }
        }

        $post->load(['author', 'reactions'])->loadCount('comments');

        return response()->json([
            'item' => $this->serializePost($post, $viewer),
        ]);
    }

    public function reject(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! UserRoles::isHrOrAdmin($viewer)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! $post->isPending()) {
            return response()->json(['message' => 'Only pending posts can be rejected.'], 422);
        }

        $post->loadMissing('author');
        app(FeedNotificationService::class)->notifyAuthorOfReview($post, $viewer, false);

        $post->delete();

        return response()->json(null, 204);
    }

    public function destroy(Request $request, Post $post): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($viewer->id !== $post->author_user_id && ! UserRoles::isHrOrAdmin($viewer)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $post->delete();

        return response()->json(null, 204);
    }

    private function notifyMentions(User $author, Post $post, string $body): void
    {
        app(MentionService::class)->notifyMentionedUsers(
            $author,
            $body,
            'post',
            FeedLinks::post($post->id),
            [],
            ['post_id' => $post->id]
        );
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
