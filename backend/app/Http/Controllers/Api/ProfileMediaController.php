<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Api\Concerns\SerializesProfileMedia;
use App\Http\Controllers\Controller;
use App\Models\ProfileMediaComment;
use App\Models\ProfileMediaCommentReaction;
use App\Models\ProfileMediaReaction;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProfileMediaController extends Controller
{
    use SerializesFeedAuthors;
    use SerializesProfileMedia;

    public function show(Request $request, User $user, string $mediaType): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensureValidMediaType($mediaType)) {
            return $response;
        }

        if ($response = $this->ensureOwnerIsVisible($user)) {
            return $response;
        }

        return response()->json([
            'item' => $this->serializeProfileMedia($user, $mediaType, $viewer),
        ]);
    }

    public function storeReaction(Request $request, User $user, string $mediaType): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensureValidMediaType($mediaType)) {
            return $response;
        }

        if ($response = $this->ensureOwnerIsVisible($user)) {
            return $response;
        }

        $validated = $request->validate([
            'reaction' => ['required', 'string', Rule::in(self::PROFILE_MEDIA_REACTIONS)],
        ]);

        $existing = ProfileMediaReaction::query()
            ->where('owner_user_id', $user->id)
            ->where('media_type', $mediaType)
            ->where('user_id', $viewer->id)
            ->first();

        if ($existing && $existing->reaction === $validated['reaction']) {
            $existing->delete();
        } else {
            ProfileMediaReaction::query()->updateOrCreate(
                [
                    'owner_user_id' => $user->id,
                    'media_type' => $mediaType,
                    'user_id' => $viewer->id,
                ],
                [
                    'reaction' => $validated['reaction'],
                ]
            );
        }

        return response()->json([
            'item' => $this->serializeProfileMedia($user, $mediaType, $viewer),
        ]);
    }

    public function destroyReaction(Request $request, User $user, string $mediaType): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensureValidMediaType($mediaType)) {
            return $response;
        }

        if ($response = $this->ensureOwnerIsVisible($user)) {
            return $response;
        }

        ProfileMediaReaction::query()
            ->where('owner_user_id', $user->id)
            ->where('media_type', $mediaType)
            ->where('user_id', $viewer->id)
            ->delete();

        return response()->json([
            'item' => $this->serializeProfileMedia($user, $mediaType, $viewer),
        ]);
    }

    public function comments(Request $request, User $user, string $mediaType): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensureValidMediaType($mediaType)) {
            return $response;
        }

        if ($response = $this->ensureOwnerIsVisible($user)) {
            return $response;
        }

        $allComments = ProfileMediaComment::query()
            ->where('owner_user_id', $user->id)
            ->where('media_type', $mediaType)
            ->with(['author.department', 'reactions'])
            ->orderBy('created_at')
            ->limit(200)
            ->get();

        $comments = $allComments
            ->filter(fn (ProfileMediaComment $comment) => $comment->parent_comment_id === null)
            ->values()
            ->map(fn (ProfileMediaComment $comment) => $this->serializeCommentTree($comment, $allComments, $viewer))
            ->all();

        return response()->json([
            'comments' => $comments,
        ]);
    }

    public function storeComment(Request $request, User $user, string $mediaType): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($response = $this->ensureValidMediaType($mediaType)) {
            return $response;
        }

        if ($response = $this->ensureOwnerIsVisible($user)) {
            return $response;
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:1000'],
            'parent_comment_id' => ['nullable', 'integer', 'exists:profile_media_comments,id'],
        ]);

        $body = trim($validated['body']);
        $parentCommentId = isset($validated['parent_comment_id'])
            ? (int) $validated['parent_comment_id']
            : null;

        if ($parentCommentId !== null) {
            $parentComment = ProfileMediaComment::query()
                ->where('id', $parentCommentId)
                ->where('owner_user_id', $user->id)
                ->where('media_type', $mediaType)
                ->first();

            if (! $parentComment) {
                return response()->json(['message' => 'Parent comment not found on this photo.'], 422);
            }
        }

        $comment = ProfileMediaComment::query()->create([
            'owner_user_id' => $user->id,
            'media_type' => $mediaType,
            'author_user_id' => $viewer->id,
            'parent_comment_id' => $parentCommentId,
            'body' => $body,
        ]);

        $comment->load(['author.department', 'reactions']);

        return response()->json([
            'comment' => $this->serializeProfileMediaComment($comment, $viewer),
        ], 201);
    }

    public function destroyComment(Request $request, ProfileMediaComment $profileMediaComment): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($viewer->id !== $profileMediaComment->author_user_id && $viewer->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $profileMediaComment->delete();

        return response()->json(null, 204);
    }

    public function storeCommentReaction(Request $request, ProfileMediaComment $profileMediaComment): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $owner = User::query()->find($profileMediaComment->owner_user_id);

        if (! $owner) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if ($response = $this->ensureOwnerIsVisible($owner)) {
            return $response;
        }

        $validated = $request->validate([
            'reaction' => ['required', 'string', Rule::in(self::PROFILE_MEDIA_REACTIONS)],
        ]);

        $existing = ProfileMediaCommentReaction::query()
            ->where('profile_media_comment_id', $profileMediaComment->id)
            ->where('user_id', $viewer->id)
            ->first();

        if ($existing && $existing->reaction === $validated['reaction']) {
            $existing->delete();
        } else {
            ProfileMediaCommentReaction::query()->updateOrCreate(
                [
                    'profile_media_comment_id' => $profileMediaComment->id,
                    'user_id' => $viewer->id,
                ],
                [
                    'reaction' => $validated['reaction'],
                ]
            );
        }

        $profileMediaComment->load(['author.department', 'reactions']);

        return response()->json([
            'comment' => $this->serializeProfileMediaComment($profileMediaComment, $viewer),
        ]);
    }

    public function destroyCommentReaction(Request $request, ProfileMediaComment $profileMediaComment): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        ProfileMediaCommentReaction::query()
            ->where('profile_media_comment_id', $profileMediaComment->id)
            ->where('user_id', $viewer->id)
            ->delete();

        $profileMediaComment->load(['author.department', 'reactions']);

        return response()->json([
            'comment' => $this->serializeProfileMediaComment($profileMediaComment, $viewer),
        ]);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, ProfileMediaComment>  $allComments
     * @return array<string, mixed>
     */
    private function serializeCommentTree(ProfileMediaComment $comment, $allComments, User $viewer): array
    {
        $payload = $this->serializeProfileMediaComment($comment, $viewer);
        $payload['replies'] = $allComments
            ->filter(fn (ProfileMediaComment $child) => (int) ($child->parent_comment_id ?? 0) === (int) $comment->id)
            ->values()
            ->map(fn (ProfileMediaComment $child) => $this->serializeCommentTree($child, $allComments, $viewer))
            ->all();

        return $payload;
    }

    private function authenticatedUser(Request $request): ?User
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return null;
        }

        return $user;
    }

    private function ensureValidMediaType(string $mediaType): ?JsonResponse
    {
        if (in_array($mediaType, self::PROFILE_MEDIA_TYPES, true)) {
            return null;
        }

        return response()->json(['message' => 'Invalid media type.'], 404);
    }

    private function ensureOwnerIsVisible(User $owner): ?JsonResponse
    {
        if ($owner->is_approved) {
            return null;
        }

        return response()->json(['message' => 'User not found.'], 404);
    }
}
