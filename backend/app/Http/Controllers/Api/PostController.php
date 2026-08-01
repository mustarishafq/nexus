<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\SerializesFeedAuthors;
use App\Http\Controllers\Api\Concerns\SerializesPosts;
use App\Http\Controllers\Controller;
use App\Jobs\NotifyFeedPostJob;
use App\Models\Post;
use App\Models\PostEdit;
use App\Models\PostPoll;
use App\Models\User;
use App\Services\FeedNotificationService;
use App\Services\GamificationService;
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
            'poll' => ['nullable', 'array'],
            'poll.options' => ['required_with:poll', 'array', 'min:'.PostPoll::MIN_OPTIONS, 'max:'.PostPoll::MAX_OPTIONS],
            'poll.options.*' => ['required', 'string', 'max:'.PostPoll::MAX_OPTION_LENGTH],
            'poll.allow_multiple' => ['sometimes', 'boolean'],
            'poll.allow_add_options' => ['sometimes', 'boolean'],
            'polls' => ['nullable', 'array', 'max:'.PostPoll::MAX_PER_POST],
            'polls.*.options' => ['required', 'array', 'min:'.PostPoll::MIN_OPTIONS, 'max:'.PostPoll::MAX_OPTIONS],
            'polls.*.options.*' => ['required', 'string', 'max:'.PostPoll::MAX_OPTION_LENGTH],
            'polls.*.allow_multiple' => ['sometimes', 'boolean'],
            'polls.*.allow_add_options' => ['sometimes', 'boolean'],
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

        $pollPayloads = collect($validated['polls'] ?? []);
        if ($pollPayloads->isEmpty() && isset($validated['poll'])) {
            $pollPayloads = collect([$validated['poll']]);
        }

        $normalizedPolls = $pollPayloads
            ->map(function (array $poll) {
                $options = collect($poll['options'] ?? [])
                    ->map(fn ($label) => trim((string) $label))
                    ->filter()
                    ->unique()
                    ->values()
                    ->take(PostPoll::MAX_OPTIONS)
                    ->all();

                return [
                    'options' => $options,
                    'allow_multiple' => (bool) ($poll['allow_multiple'] ?? false),
                    'allow_add_options' => (bool) ($poll['allow_add_options'] ?? false),
                ];
            })
            ->filter(fn (array $poll) => count($poll['options']) >= PostPoll::MIN_OPTIONS)
            ->take(PostPoll::MAX_PER_POST)
            ->values()
            ->all();

        $hasPolls = $normalizedPolls !== [];

        if ($body === '' && $imageUrls === [] && ! $hasPolls) {
            return response()->json(['message' => 'Post must include text, an image, or a poll.'], 422);
        }

        if (($pollPayloads->isNotEmpty() || isset($validated['poll'])) && ! $hasPolls) {
            return response()->json([
                'message' => 'Each poll needs at least '.PostPoll::MIN_OPTIONS.' unique options.',
            ], 422);
        }

        $requiresApproval = AppSettings::userRequiresFeedPostApproval($viewer);
        $now = now();

        $post = DB::transaction(function () use ($viewer, $body, $imageUrl, $imageUrls, $requiresApproval, $now, $normalizedPolls) {
            $post = Post::create([
                'author_user_id' => $viewer->id,
                'body' => $body,
                'image_url' => $imageUrl,
                'image_urls' => $imageUrls === [] ? null : $imageUrls,
                'approval_status' => $requiresApproval ? Post::APPROVAL_PENDING : Post::APPROVAL_APPROVED,
                'approved_by_user_id' => $requiresApproval ? null : $viewer->id,
                'approved_at' => $requiresApproval ? null : $now,
            ]);

            foreach ($normalizedPolls as $sortOrder => $pollData) {
                $poll = $post->polls()->create([
                    'sort_order' => $sortOrder,
                    'allow_multiple' => $pollData['allow_multiple'],
                    'allow_add_options' => $pollData['allow_add_options'],
                ]);

                foreach ($pollData['options'] as $index => $label) {
                    $poll->options()->create([
                        'label' => $label,
                        'sort_order' => $index,
                    ]);
                }
            }

            return $post;
        });

        if ($requiresApproval) {
            NotifyFeedPostJob::dispatch(
                NotifyFeedPostJob::ACTION_PENDING_MODERATION,
                $post->id,
                $viewer->id,
            )->afterResponse();
        } else {
            NotifyFeedPostJob::dispatch(
                NotifyFeedPostJob::ACTION_PUBLISHED,
                $post->id,
                $viewer->id,
            )->afterResponse();

            if ($body !== '') {
                $this->notifyMentions($viewer, $post, $body);
            }
        }

        $post->load(['author', 'reactions', 'polls.options', 'polls.votes'])->loadCount(['comments', 'edits', 'views', 'reaches']);

        $payload = [
            'item' => $this->serializePost($post, $viewer),
        ];

        if (! $requiresApproval) {
            $gamification = app(GamificationService::class);
            $offer = $gamification->offer($viewer, 'feed_post', 'post', $post->id);
            $payload = array_merge($payload, $gamification->offerPayload($offer));
        }

        return response()->json($payload, 201);
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
        $hasPoll = $post->polls()->exists();

        if ($body === '' && $imageUrls === [] && ! $hasPoll) {
            return response()->json(['message' => 'Post must include text, an image, or a poll.'], 422);
        }

        $previousBody = (string) ($post->body ?? '');
        if ($previousBody === $body) {
            $post->load(['author', 'reactions', 'polls.options', 'polls.votes'])->loadCount(['comments', 'edits', 'views', 'reaches']);

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

        $post->load(['author', 'reactions', 'polls.options', 'polls.votes'])->loadCount(['comments', 'edits', 'views', 'reaches']);

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
            NotifyFeedPostJob::dispatch(
                NotifyFeedPostJob::ACTION_PUBLISHED,
                $post->id,
                $author->id,
            )->afterResponse();

            $body = trim((string) $post->body);
            if ($body !== '') {
                $this->notifyMentions($author, $post, $body);
            }

            app(GamificationService::class)->offer($author, 'feed_post', 'post', $post->id);
        }

        $post->load(['author', 'reactions', 'polls.options', 'polls.votes'])->loadCount(['comments', 'edits', 'views', 'reaches']);

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
